import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  const barcode = req.nextUrl.searchParams.get('barcode');
  if (!barcode || barcode.trim() === '') {
    return NextResponse.json({ error: 'Barcode query parameter is required' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, price, "costPrice" AS cost, unit, barcode, category, stock
       FROM "RetailProduct"
       WHERE "tenantId" = $1 AND barcode = $2 AND "isDeleted" = false AND "isActive" = true
       LIMIT 1`,
      [tenantId, barcode.trim()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ found: false });
    }

    const row = result.rows[0];
    return NextResponse.json({
      found: true,
      product: {
        id: row.id,
        name: row.name,
        price: Number(row.price) || 0,
        cost: Number(row.cost) || 0,
        unit: row.unit || '',
        barcode: row.barcode || '',
        category: row.category || '',
        stock: Number(row.stock) || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
