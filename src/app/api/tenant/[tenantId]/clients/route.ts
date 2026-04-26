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
    const clients = await db.client.findMany({ where: { tenantId, isDeleted: false }, orderBy: { name: 'asc' } });
    return NextResponse.json(clients);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
    const client = await db.client.create({
      data: { tenantId, name: data.name, email: data.email, phone: data.phone, address: data.address, notes: data.notes, tags: typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags || []) }
    });
    return NextResponse.json(client);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
    const existing = await db.client.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }
    const updated = await db.client.update({ where: { id }, data: whitelistFields('Client', fields) });
    return NextResponse.json(updated);
  } catch {
    try {
      const safeFields = whitelistFields('Client', fields);
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(safeFields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "Client" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);
      const updated = await pgQueryOne(`SELECT * FROM "Client" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
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
    const existing = await db.client.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }
    await db.client.update({ where: { id }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "Client" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
