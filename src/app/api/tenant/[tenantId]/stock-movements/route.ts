import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }
  try {
    const url = new URL(_req.url);
    const type = url.searchParams.get('type');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    let sql = `SELECT sm.*, i.name as "ingredientName", i.unit, i.category
               FROM "StockMovement" sm
               LEFT JOIN "Ingredient" i ON i.id = sm."ingredientId"
               WHERE sm."tenantId" = $1`;
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (type && type !== 'all') {
      sql += ` AND sm.type = $${paramIdx++}`;
      queryParams.push(type);
    }
    if (fromDate) {
      sql += ` AND sm."createdAt" >= $${paramIdx++}`;
      queryParams.push(fromDate);
    }
    if (toDate) {
      sql += ` AND sm."createdAt" <= $${paramIdx++}`;
      queryParams.push(toDate);
    }
    sql += ` ORDER BY sm."createdAt" DESC LIMIT 200`;

    const movements = await pgQuery<any[]>(sql, queryParams);
    return NextResponse.json(movements);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }
  try {
    const body = await req.json();
    const { ingredientId, type, quantity, unitCost, reason, reference, batchNumber, expiryDate, method } = body;

    if (!ingredientId || !type || !quantity) {
      return NextResponse.json({ error: 'Ingredient ID, type, and quantity are required' }, { status: 400 });
    }

    // Get current stock (parameterized)
    const ingredient = await pgQuery<any>(
      `SELECT quantity, name FROM "Ingredient" WHERE id = $1 AND "tenantId" = $2`,
      [ingredientId, tenantId]
    );
    if (!ingredient || ingredient.length === 0) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }

    const previousStock = ingredient[0].quantity || 0;
    let newStock = previousStock;

    if (type === 'entry') {
      newStock = previousStock + Math.abs(quantity);
    } else if (type === 'exit') {
      newStock = Math.max(0, previousStock - Math.abs(quantity));
    } else if (type === 'adjustment') {
      newStock = Math.abs(quantity);
    }

    // Create stock movement record (parameterized)
    const movementId = `sm-${Date.now()}`;
    await pgQuery(`
      INSERT INTO "StockMovement" (
        id, "tenantId", "ingredientId", type, quantity, "previousStock", "newStock",
        "unitCost", reason, reference, "batchNumber", "expiryDate", method
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13
      )
    `, [
      movementId, tenantId, ingredientId, type, Math.abs(quantity),
      previousStock, newStock, unitCost || 0,
      reason || null,
      reference || null,
      batchNumber || null,
      expiryDate || null,
      method || 'fifo'
    ]);

    // Update ingredient stock (parameterized)
    await pgQuery(`
      UPDATE "Ingredient" SET quantity = $1, "updatedAt" = NOW()
      WHERE id = $2 AND "tenantId" = $3
    `, [newStock, ingredientId, tenantId]);

    return NextResponse.json({
      id: movementId,
      ingredientId,
      type,
      quantity: Math.abs(quantity),
      previousStock,
      newStock,
      ingredientName: ingredient[0].name,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
