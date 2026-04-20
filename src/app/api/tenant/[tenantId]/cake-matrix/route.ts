import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Cake Matrix API ──
// Manages pricing matrix for cakes: sizes × flavors × prices
// Also stores portion counts per size for the portion calculator

const DEFAULT_SIZES = ['6"', '8"', '10"', '12"', '14"', '16"'];
const DEFAULT_FLAVORS = ['Vainilla', 'Chocolate', 'Red Velvet', 'Fresa', 'Zanahoria', 'Limon', 'Dulce de Leche'];

// Standard portion counts per cake size (round tiers)
const PORTION_MAP: Record<string, number> = {
  '4"': 6, '5"': 8, '6"': 12, '7"': 16, '8"': 24,
  '9"': 32, '10"': 38, '12"': 56, '14"': 78, '16"': 100,
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(_req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    // Create table if not exists
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "CakeMatrix" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId" TEXT NOT NULL,
        "size" TEXT NOT NULL,
        "flavor" TEXT NOT NULL,
        "price" DOUBLE PRECISION DEFAULT 0,
        "servings" INTEGER DEFAULT 0,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE("tenantId", "size", "flavor")
      );
      CREATE INDEX IF NOT EXISTS "idx_cake_matrix_tenant" ON "CakeMatrix"("tenantId");
    `);

    const rows = await pgQuery(
      `SELECT * FROM "CakeMatrix" WHERE "tenantId" = $1 AND "isActive" = true ORDER BY 
        CASE size 
          WHEN '4"' THEN 1 WHEN '5"' THEN 2 WHEN '6"' THEN 3 WHEN '7"' THEN 4 
          WHEN '8"' THEN 5 WHEN '9"' THEN 6 WHEN '10"' THEN 7 WHEN '12"' THEN 8 
          WHEN '14"' THEN 9 WHEN '16"' THEN 10 ELSE 99 END, flavor`,
      [tenantId]
    );

    // Extract unique sizes and flavors from data
    const sizes = [...new Set(rows.map((r: any) => r.size))].sort((a: any, b: any) => {
      const order = DEFAULT_SIZES.indexOf(a) - DEFAULT_SIZES.indexOf(b);
      return order !== 0 ? order : a.localeCompare(b);
    });
    const flavors = [...new Set(rows.map((r: any) => r.flavor))];

    // Build price grid: { "size-flavor": price }
    const priceGrid: Record<string, number> = {};
    const servingGrid: Record<string, number> = {};
    rows.forEach((r: any) => {
      priceGrid[`${r.size}-${r.flavor}`] = r.price || 0;
      servingGrid[`${r.size}`] = r.servings || PORTION_MAP[r.size] || 0;
    });

    return NextResponse.json({
      matrix: rows,
      sizes,
      flavors,
      priceGrid,
      servingGrid,
      portionMap: PORTION_MAP,
      defaultSizes: DEFAULT_SIZES,
      defaultFlavors: DEFAULT_FLAVORS,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    // Ensure table exists
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "CakeMatrix" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId" TEXT NOT NULL,
        "size" TEXT NOT NULL,
        "flavor" TEXT NOT NULL,
        "price" DOUBLE PRECISION DEFAULT 0,
        "servings" INTEGER DEFAULT 0,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE("tenantId", "size", "flavor")
      );
    `);

    const data = await req.json();

    // Option A: Save full grid (upsert all size×flavor combinations)
    if (data.type === 'full_grid' && Array.isArray(data.entries)) {
      let upserted = 0;
      for (const entry of data.entries) {
        const servings = PORTION_MAP[entry.size] || entry.servings || 0;
        await pgQuery(
          `INSERT INTO "CakeMatrix" ("tenantId", "size", "flavor", "price", "servings")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ("tenantId", "size", "flavor") 
           DO UPDATE SET "price" = $4, "servings" = $5, "updatedAt" = NOW()`,
          [tenantId, entry.size, entry.flavor, entry.price || 0, servings]
        );
        upserted++;
      }
      return NextResponse.json({ success: true, upserted });
    }

    // Option B: Save single cell
    if (data.size && data.flavor !== undefined) {
      const servings = PORTION_MAP[data.size] || data.servings || 0;
      const result = await pgQueryOne(
        `INSERT INTO "CakeMatrix" ("tenantId", "size", "flavor", "price", "servings")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("tenantId", "size", "flavor") 
         DO UPDATE SET "price" = $4, "servings" = $5, "updatedAt" = NOW()
         RETURNING *`,
        [tenantId, data.size, data.flavor, data.price || 0, servings]
      );
      return NextResponse.json({ success: true, entry: result });
    }

    // Option C: Add new size or flavor
    if (data.type === 'add_size' && data.size) {
      // Insert default entries for all existing flavors with this new size
      const existingFlavors = data.existingFlavors || DEFAULT_FLAVORS;
      for (const flavor of existingFlavors) {
        await pgQuery(
          `INSERT INTO "CakeMatrix" ("tenantId", "size", "flavor", "price", "servings")
           VALUES ($1, $2, $3, 0, $4)
           ON CONFLICT ("tenantId", "size", "flavor") DO NOTHING`,
          [tenantId, data.size, flavor, PORTION_MAP[data.size] || 0]
        );
      }
      return NextResponse.json({ success: true, size: data.size });
    }

    if (data.type === 'add_flavor' && data.flavor) {
      const existingSizes = data.existingSizes || DEFAULT_SIZES;
      for (const size of existingSizes) {
        await pgQuery(
          `INSERT INTO "CakeMatrix" ("tenantId", "size", "flavor", "price", "servings")
           VALUES ($1, $2, $3, 0, $4)
           ON CONFLICT ("tenantId", "size", "flavor") DO NOTHING`,
          [tenantId, size, data.flavor, PORTION_MAP[size] || 0]
        );
      }
      return NextResponse.json({ success: true, flavor: data.flavor });
    }

    return NextResponse.json({ error: 'Invalid request. Provide type, size, flavor, or entries.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await pgQuery(
      `UPDATE "CakeMatrix" SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
