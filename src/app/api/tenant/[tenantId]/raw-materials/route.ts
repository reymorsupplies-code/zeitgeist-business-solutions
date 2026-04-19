import { NextRequest, NextResponse } from 'next/server';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth';

// ─── GET: List all raw materials for tenant ───
// Supports query params: ?category=flour&low_stock=true
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth guard
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
    const category = url.searchParams.get('category');
    const lowStock = url.searchParams.get('low_stock');

    let sql = `SELECT * FROM "RawMaterial" WHERE "tenantId" = $1 AND "isDeleted" = false`;
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (category) {
      sql += ` AND category = $${paramIdx++}`;
      queryParams.push(category);
    }

    if (lowStock === 'true') {
      sql += ` AND quantity <= "minStock"`;
    }

    sql += ` ORDER BY "createdAt" DESC`;

    const materials = await pgQuery<any>(sql, queryParams);
    return NextResponse.json(materials);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create new raw material ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth guard
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const data = await req.json();
    const id = `rm-${Date.now()}`;

    const result = await pgQuery<any>(
      `INSERT INTO "RawMaterial" (
        id, "tenantId", name, sku, category, unit, quantity, "minStock",
        "unitCost", "supplierId", "expiryDays", "storageCondition",
        "batchNumber", "entryDate", "expiryDate", method, notes,
        "isDeleted", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, NOW(), NOW()
      ) RETURNING *`,
      [
        id,
        tenantId,
        data.name || null,
        data.sku || null,
        data.category || null,
        data.unit || null,
        data.quantity ?? 0,
        data.minStock ?? 0,
        data.unitCost ?? 0,
        data.supplierId || null,
        data.expiryDays || null,
        data.storageCondition || null,
        data.batchNumber || null,
        data.entryDate || null,
        data.expiryDate || null,
        data.method || 'fifo',
        data.notes || null,
        false,
      ]
    );

    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PUT: Update raw material by id ───
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth guard
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const data = await req.json();
    const { id, ...fields } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Build SET clause with parameterized values only
    const allowedFields = [
      'name', 'sku', 'category', 'unit', 'quantity', 'minStock',
      'unitCost', 'supplierId', 'expiryDays', 'storageCondition',
      'batchNumber', 'entryDate', 'expiryDate', 'method', 'notes',
    ];

    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        setParts.push(`"${field}" = $${pIdx++}`);
        paramValues.push(fields[field]);
      }
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    setParts.push(`"updatedAt" = NOW()`);
    paramValues.push(id);
    paramValues.push(tenantId);

    const sql = `UPDATE "RawMaterial" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`;

    await pgQuery(sql, paramValues);

    const updated = await pgQueryOne(
      `SELECT * FROM "RawMaterial" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
      [id, tenantId]
    );

    if (!updated) {
      return NextResponse.json({ error: 'Raw material not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Soft delete raw material by id ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth guard
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pgQuery(
      `UPDATE "RawMaterial" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
