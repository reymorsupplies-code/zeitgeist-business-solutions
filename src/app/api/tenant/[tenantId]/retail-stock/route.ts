import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: Retail stock movements ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const productId = url.searchParams.get('productId');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    // Use StockMovement table which is shared, but filter by retail context
    let sql = `SELECT sm.*, rp.name as "productName", rp.sku, rp.category
               FROM "StockMovement" sm
               LEFT JOIN "RetailProduct" rp ON rp.id = sm."ingredientId"
               WHERE sm."tenantId" = $1`;
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (type && type !== 'all') { sql += ` AND sm.type = $${paramIdx++}`; queryParams.push(type); }
    if (productId) { sql += ` AND sm."ingredientId" = $${paramIdx++}`; queryParams.push(productId); }
    if (fromDate) { sql += ` AND sm."createdAt" >= $${paramIdx++}`; queryParams.push(fromDate); }
    if (toDate) { sql += ` AND sm."createdAt" <= $${paramIdx++}`; queryParams.push(toDate); }
    sql += ` ORDER BY sm."createdAt" DESC LIMIT $${paramIdx}`;
    queryParams.push(limit);

    const movements = await pgQuery<any>(sql, queryParams);

    // Also get sales-based deductions
    const salesSql = `SELECT ps.id, ps."saleNumber", ps.items, ps."createdAt", ps."customerName", ps."totalAmount"
                      FROM "POSSale" ps
                      WHERE ps."tenantId" = $1 AND ps.status = 'completed' AND ps."isDeleted" = false
                      ${fromDate ? `AND ps."createdAt" >= $${paramIdx++}` : ''}
                      ORDER BY ps."createdAt" DESC LIMIT $${paramIdx}`;
    const salesParams: any[] = [tenantId];
    if (fromDate) salesParams.push(fromDate);
    salesParams.push(limit);
    const sales = await pgQuery<any>(salesSql, salesParams);

    return NextResponse.json({ movements, sales });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: Record stock movement + update product quantity ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();
    const { productId, type, quantity, unitCost, reason, reference, batchNumber, method } = body;

    if (!productId || !type || !quantity) {
      return NextResponse.json({ error: 'Product ID, type, and quantity are required' }, { status: 400 });
    }

    // Get current stock (read-only for audit trail)
    const product = await pgQuery<any>(
      `SELECT quantity, name FROM "RetailProduct" WHERE id = $1 AND "tenantId" = $2`,
      [productId, tenantId]
    );
    if (!product || product.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const previousStock = product[0].quantity || 0;
    const absQty = Math.abs(quantity);
    let newStock = previousStock;

    if (type === 'entry') {
      newStock = previousStock + absQty;
      // Atomic stock increment
      await pgQuery(`UPDATE "RetailProduct" SET quantity = quantity + $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [absQty, productId, tenantId]);
    } else if (type === 'exit') {
      if (previousStock < absQty) {
        return NextResponse.json({ error: `Insufficient stock. Available: ${previousStock}, requested: ${absQty}` }, { status: 400 });
      }
      newStock = previousStock - absQty;
      // Atomic stock decrement with guard
      await pgQuery(`UPDATE "RetailProduct" SET quantity = GREATEST(0, quantity - $1), "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3 AND quantity >= $1`, [absQty, productId, tenantId]);
    } else if (type === 'adjustment') {
      newStock = Math.max(0, absQty);
      // Atomic absolute set
      await pgQuery(`UPDATE "RetailProduct" SET quantity = GREATEST(0, $1), "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [absQty, productId, tenantId]);
    }

    // Create stock movement record (after successful update)
    const movementId = `sm-${Date.now()}`;
    await pgQuery(
      `INSERT INTO "StockMovement" (id, "tenantId", "ingredientId", type, quantity, "previousStock", "newStock", "unitCost", reason, reference, "batchNumber", "expiryDate", method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12)`,
      [movementId, tenantId, productId, type, absQty, previousStock, newStock, unitCost || 0, reason || null, reference || null, batchNumber || null, method || 'fifo']
    );

    return NextResponse.json({
      id: movementId,
      productId,
      type,
      quantity: absQty,
      previousStock,
      newStock,
      productName: product[0].name,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
