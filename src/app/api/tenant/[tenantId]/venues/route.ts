import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

export async function GET(_req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
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
    const items = await db.venue.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(items);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
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
    const item = await db.venue.create({
      data: {
        tenantId,
        name: data.name,
        location: data.location,
        capacity: data.capacity || 0,
        contact: data.contact,
        email: data.email,
        phone: data.phone,
        amenities: typeof data.amenities === 'string' ? data.amenities : JSON.stringify(data.amenities || []),
        pricePerHour: data.pricePerHour || 0,
        isActive: data.isActive ?? true,
      }
    });
    return NextResponse.json(item);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
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
  try {
    const data = await req.json();
    const { id, ...fields } = data;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.venue.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Venue not found' }, { status: 404 });

    const item = await db.venue.update({ where: { id }, data: whitelistFields('Venue', fields) });
    return NextResponse.json(item);
  } catch (error: any) {
    try {
      const data = await req.json();
      const { id, ...fields } = data;
      const safeFields = whitelistFields('Venue', fields);
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(safeFields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "Venue" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);
      const updated = await pgQueryOne(`SELECT * FROM "Venue" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json(updated);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
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
  try {
    const { id } = await req.json();
    const existing = await db.venue.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    await db.venue.update({ where: { id }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
