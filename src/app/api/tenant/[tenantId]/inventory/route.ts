import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── Idempotent table creation ───
const ENSURE_TABLE = `CREATE TABLE IF NOT EXISTS "InventoryItem" (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  name       TEXT NOT NULL,
  sku        TEXT,
  category   TEXT,
  quantity   NUMERIC DEFAULT 0,
  "reorderLevel" NUMERIC DEFAULT 0,
  unit       TEXT,
  "costPrice"  NUMERIC DEFAULT 0,
  "salePrice"  NUMERIC DEFAULT 0,
  location   TEXT,
  notes      TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_InventoryItem_tenantId" ON "InventoryItem"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_InventoryItem_sku" ON "InventoryItem"(sku);
CREATE INDEX IF NOT EXISTS "idx_InventoryItem_category" ON "InventoryItem"(category);`;

async function ensureTable() {
  await pgQuery(ENSURE_TABLE);
}

// ─── GET: List inventory items scoped to tenant ───
// Supports query params: ?category=xxx&low_stock=true&search=xxx
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
    await ensureTable();

    const url = new URL(_req.url);
    const category = url.searchParams.get('category');
    const lowStock = url.searchParams.get('low_stock');
    const search = url.searchParams.get('search');
    const activeOnly = url.searchParams.get('active');

    let sql = `SELECT * FROM "InventoryItem" WHERE "tenantId" = $1`;
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (activeOnly === 'true') {
      sql += ` AND "isActive" = true`;
    }

    if (category) {
      sql += ` AND category = $${paramIdx++}`;
      queryParams.push(category);
    }

    if (lowStock === 'true') {
      sql += ` AND quantity <= "reorderLevel"`;
    }

    if (search) {
      sql += ` AND (name ILIKE $${paramIdx} OR sku ILIKE $${paramIdx} OR category ILIKE $${paramIdx})`;
      queryParams.push(`%${search}%`);
      paramIdx++;
    }

    sql += ` ORDER BY "createdAt" DESC`;

    const items = await pgQuery<any>(sql, queryParams);

    // Get summary stats
    const stats = await pgQueryOne<any>(
      `SELECT
         COUNT(*) AS "totalItems",
         COUNT(CASE WHEN quantity <= "reorderLevel" THEN 1 END) AS "lowStockCount",
         COALESCE(SUM(quantity), 0) AS "totalQuantity",
         COALESCE(SUM(quantity * "costPrice"), 0) AS "totalValue"
       FROM "InventoryItem"
       WHERE "tenantId" = $1 AND "isActive" = true`,
      [tenantId]
    );

    return NextResponse.json({
      items,
      stats: {
        totalItems: Number(stats?.totalItems) || 0,
        lowStockCount: Number(stats?.lowStockCount) || 0,
        totalQuantity: Number(stats?.totalQuantity) || 0,
        totalValue: Number(stats?.totalValue) || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create inventory item ───
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
    await ensureTable();

    const data = await req.json();

    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    const result = await pgQuery<any>(
      `INSERT INTO "InventoryItem" (
        "tenantId", name, sku, category, quantity, "reorderLevel", unit,
        "costPrice", "salePrice", location, notes, "isActive", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) RETURNING *`,
      [
        tenantId,
        data.name.trim(),
        data.sku || null,
        data.category || null,
        Number(data.quantity) || 0,
        Number(data.reorderLevel) || 0,
        data.unit || null,
        Number(data.costPrice) || 0,
        Number(data.salePrice) || 0,
        data.location || null,
        data.notes || null,
        data.isActive !== undefined ? data.isActive : true,
      ]
    );

    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PUT: Update inventory item ───
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    await ensureTable();

    const data = await req.json();
    const { id, ...fields } = data;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Verify item belongs to this tenant
    const existing = await pgQueryOne(
      `SELECT id FROM "InventoryItem" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Inventory item not found or access denied' }, { status: 404 });
    }

    const allowedFields = [
      'name', 'sku', 'category', 'quantity', 'reorderLevel', 'unit',
      'costPrice', 'salePrice', 'location', 'notes', 'isActive',
    ];

    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        setParts.push(`"${field}" = $${pIdx++}`);
        // Numeric fields
        if (['quantity', 'reorderLevel', 'costPrice', 'salePrice'].includes(field)) {
          paramValues.push(Number(fields[field]) || 0);
        } else {
          paramValues.push(fields[field]);
        }
      }
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    setParts.push(`"updatedAt" = NOW()`);
    paramValues.push(id);

    const sql = `UPDATE "InventoryItem" SET ${setParts.join(', ')} WHERE id = $${pIdx}`;
    await pgQuery(sql, paramValues);

    const updated = await pgQueryOne(
      `SELECT * FROM "InventoryItem" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PATCH: Partial update inventory item (e.g. adjust quantity) ───
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    await ensureTable();

    const { id, ...fields } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Verify item belongs to this tenant
    const existing = await pgQueryOne(
      `SELECT id FROM "InventoryItem" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Inventory item not found or access denied' }, { status: 404 });
    }

    const allowedFields = [
      'name', 'sku', 'category', 'quantity', 'reorderLevel', 'unit',
      'costPrice', 'salePrice', 'location', 'notes', 'isActive',
    ];

    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        setParts.push(`"${field}" = $${pIdx++}`);
        if (['quantity', 'reorderLevel', 'costPrice', 'salePrice'].includes(field)) {
          paramValues.push(Number(fields[field]) || 0);
        } else {
          paramValues.push(fields[field]);
        }
      }
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    setParts.push(`"updatedAt" = NOW()`);
    paramValues.push(id);

    const sql = `UPDATE "InventoryItem" SET ${setParts.join(', ')} WHERE id = $${pIdx}`;
    await pgQuery(sql, paramValues);

    const updated = await pgQueryOne(
      `SELECT * FROM "InventoryItem" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Delete inventory item ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    await ensureTable();

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Verify item belongs to this tenant
    const existing = await pgQueryOne(
      `SELECT id FROM "InventoryItem" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Inventory item not found or access denied' }, { status: 404 });
    }

    await pgQuery(
      `DELETE FROM "InventoryItem" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
