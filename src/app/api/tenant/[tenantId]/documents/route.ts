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
    const items = await db.tenantDocument.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(items);
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
  const data = await req.json();
  try {
    const item = await db.tenantDocument.create({
      data: {
        tenantId,
        name: data.name || '',
        type: data.type || 'Otro',
        content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || {}),
        fileUrl: data.fileUrl || data.fileName || '',
      }
    });
    return NextResponse.json(item);
  } catch (error: any) {
    try {
      const now = new Date().toISOString();
      await pgQuery(
        `INSERT INTO "TenantDocument" ("tenantId","name","type","category","content","fileUrl","issueDate","expiryDate","tags","notes","isDeleted","createdAt","updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12)`,
        [tenantId, data.name||'', data.type||'Otro', data.category||'', typeof data.content==='string'?data.content:JSON.stringify(data.content||{}), data.fileUrl||data.fileName||'', data.issueDate?data.issueDate:now, data.expiryDate||null, typeof data.tags==='string'?data.tags:JSON.stringify(data.tags||[]), data.notes||'', now, now]
      );
      const created = await pgQueryOne(`SELECT * FROM "TenantDocument" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
      return NextResponse.json(created);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  // Tenant isolation — verify tenantId from JWT
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    const updated = await db.tenantDocument.update({ where: { id, tenantId }, data: whitelistFields('TenantDocument', fields) });
    return NextResponse.json(updated);
  } catch {
    try {
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(fields)) {
        if (v === null || v === undefined) {
          setParts.push(`"${k}" = NULL`);
        } else {
          setParts.push(`"${k}" = ${pIdx++}`);
          paramValues.push(v);
        }
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "TenantDocument" SET ${setParts.join(', ')} WHERE id = $${pIdx}`, [...paramValues, id]);
      const updated = await pgQueryOne(`SELECT * FROM "TenantDocument" WHERE id = $1`, [id]);
      return NextResponse.json(updated);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  // Tenant isolation — verify tenantId from JWT
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    await db.tenantDocument.update({ where: { id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "TenantDocument" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
