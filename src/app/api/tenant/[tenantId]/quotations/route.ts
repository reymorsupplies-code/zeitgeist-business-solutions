import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
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
    const items = await db.quotation.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
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
  try {
    const data = await req.json();
    const count = await db.quotation.count({ where: { tenantId } });
    const validUntil = data.validUntil ? new Date(data.validUntil) : new Date(Date.now() + 15 * 86400000);
    const item = await db.quotation.create({
      data: {
        tenantId,
        quoteNumber: data.quoteNumber || `COT-${String(count + 1).padStart(3, '0')}`,
        clientName: data.clientName || '',
        clientEmail: data.clientEmail || '',
        clientPhone: data.clientPhone || '',
        items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
        subtotal: data.subtotal || 0,
        discount: data.discount || 0,
        taxRate: data.taxRate || 0.125,
        taxAmount: data.taxAmount || 0,
        totalAmount: data.totalAmount || 0,
        status: data.status || 'pendiente',
        validUntil,
        notes: data.notes || '',
      }
    });
    return NextResponse.json(item);
  } catch (error: any) {
    try {
      const count = await pgQuery<any[]>(`SELECT COUNT(*)::int as c FROM "Quotation" WHERE "tenantId" = $1`, [tenantId]);
      const cn = (count[0]?.c || 0) + 1;
      const now = new Date().toISOString();
      const vu = data.validUntil || new Date(Date.now() + 15 * 86400000).toISOString();
      await pgQuery(
        `INSERT INTO "Quotation" ("tenantId","quoteNumber","clientName","clientEmail","clientPhone","items","subtotal","discount","taxRate","taxAmount","totalAmount","status","validUntil","notes","isDeleted","createdAt","updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,$15,$16)`,
        [tenantId, `COT-${String(cn).padStart(3,'0')}`, data.clientName||'', data.clientEmail||'', data.clientPhone||'', typeof data.items==='string'?data.items:JSON.stringify(data.items||[]), data.subtotal||0, data.discount||0, data.taxRate||0.125, data.taxAmount||0, data.totalAmount||0, data.status||'pendiente', vu, data.notes||'', now, now]
      );
      const created = await pgQueryOne(`SELECT * FROM "Quotation" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
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
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    const updated = await db.quotation.update({ where: { id }, data: fields });
    return NextResponse.json(updated);
  } catch {
    try {
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(fields)) {
        setParts.push(`"${k}" = ${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "Quotation" SET ${setParts.join(', ')} WHERE id = $${pIdx}`, [...paramValues, id]);
      const updated = await pgQueryOne(`SELECT * FROM "Quotation" WHERE id = $1`, [id]);
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
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    await db.quotation.update({ where: { id }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "Quotation" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1`, [id]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
