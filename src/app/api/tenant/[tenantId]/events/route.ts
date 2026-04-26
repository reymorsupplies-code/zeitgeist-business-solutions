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
    const items = await db.event.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
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
    const item = await db.event.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        clientName: data.clientName,
        venue: data.venue,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        setupDate: data.setupDate ? new Date(data.setupDate) : null,
        guestCount: data.guestCount || 0,
        budget: data.budget || 0,
        status: data.status || 'planning',
        notes: data.notes,
      }
    });
    return NextResponse.json(item);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PUT(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
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
    const existing = await db.event.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    const updated = await db.event.update({ where: { id }, data: whitelistFields('Event', fields) });
    return NextResponse.json(updated);
  } catch {
    try {
      const safeFields = whitelistFields('Event', fields);
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(safeFields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "Event" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);
      const updated = await pgQueryOne(`SELECT * FROM "Event" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json(updated);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

export async function DELETE(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
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
    const existing = await db.event.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    await db.event.update({ where: { id }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "Event" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
