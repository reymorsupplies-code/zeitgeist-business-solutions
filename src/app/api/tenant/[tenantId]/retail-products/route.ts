import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

export async function GET(req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
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
    const items = await db.retailProduct.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(items);
  } catch (error: any) { console.error('[retail-products] Error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function POST(req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
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
    const data = await req.json();
    const item = await db.retailProduct.create({
      data: {
        tenantId,
        name: data.name,
        sku: data.sku,
        category: data.category,
        price: data.price || 0,
        cost: data.cost || 0,
        quantity: data.quantity || 0,
        minStock: data.minStock || 0,
        supplier: data.supplier,
        barcode: data.barcode,
        imageUrl: data.imageUrl,
        taxCategory: data.taxCategory || 'standard',
        settings: data.settings || '{}',
        isActive: data.isActive ?? true,
      }
    });
    return NextResponse.json(item);
  } catch (error: any) { console.error('[retail-products] Error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function PUT(req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const existing = await db.retailProduct.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    const updated = await db.retailProduct.update({ where: { id }, data: whitelistFields('RetailProduct', fields) });
    return NextResponse.json(updated);
  } catch {
    try {
      const safeFields = whitelistFields('RetailProduct', fields);
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(safeFields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "RetailProduct" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);
      const updated = await pgQueryOne(`SELECT * FROM "RetailProduct" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json(updated);
    } catch (err: any) {
        console.error('[retail-products] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

export async function DELETE(req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const existing = await db.retailProduct.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    await db.retailProduct.update({ where: { id }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "RetailProduct" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[retail-products] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}
