import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: List returns ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  let status: string | null = null;
  let search: string | null = null;
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  try {
    const url = new URL(req.url);
    status = url.searchParams.get('status');
    search = url.searchParams.get('search');
    dateFrom = url.searchParams.get('from');
    dateTo = url.searchParams.get('to');

    const where: any = { tenantId, isDeleted: false };
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.returnNumber = { contains: search, mode: 'insensitive' };
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const returns = await db.return.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { sale: { select: { saleNumber: true } } },
    });
    return NextResponse.json(returns);
  } catch {
    try {
      let sql = `SELECT r.*, s."saleNumber" as "saleNumber" FROM "Return" r LEFT JOIN "POSSale" s ON r."saleId" = s.id WHERE r."tenantId" = $1 AND r."isDeleted" = false`;
      const params: any[] = [tenantId];
      let idx = 2;
      if (status && status !== 'all') { sql += ` AND r.status = $${idx++}`; params.push(status); }
      if (search) { sql += ` AND r."returnNumber" ILIKE $${idx++}`; params.push(`%${search}%`); }
      if (dateFrom) { sql += ` AND r."createdAt" >= $${idx++}`; params.push(dateFrom); }
      if (dateTo) { sql += ` AND r."createdAt" <= $${idx++}`; params.push(dateTo); }
      sql += ` ORDER BY r."createdAt" DESC`;
      const returns = await pgQuery<any>(sql, params);
      return NextResponse.json(returns);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── POST: Create return ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();

    // Validate sale exists and belongs to tenant
    const sale = await db.pOSSale.findFirst({ where: { id: data.saleId, tenantId } });
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    // Generate return number
    const count = await db.return.count({ where: { tenantId } });
    const returnNumber = `RET-${String(count + 1).padStart(5, '0')}`;

    const itemsStr = typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []);
    const totalRefund = (data.items || []).reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);

    const ret = await db.return.create({
      data: {
        tenantId,
        saleId: data.saleId,
        returnNumber,
        items: itemsStr,
        totalRefund,
        refundMethod: data.refundMethod || 'cash',
        reason: data.reason || 'other',
        status: 'pending',
        processedBy: data.processedBy || null,
        notes: data.notes || '',
      },
    });
    return NextResponse.json(ret);
  } catch (error: any) {
    try {
      const data = await req.json();

      // Validate sale (pg fallback)
      const sale = await pgQueryOne<any>(`SELECT id FROM "POSSale" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`, [data.saleId, tenantId]);
      if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

      const count = await pgQuery<any>(`SELECT COUNT(*)::int as c FROM "Return" WHERE "tenantId" = $1`, [tenantId]);
      const cn = (count[0]?.c || 0) + 1;
      const returnNumber = `RET-${String(cn).padStart(5, '0')}`;
      const itemsStr = typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []);
      const totalRefund = (data.items || []).reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
      const now = new Date().toISOString();

      await pgQuery(
        `INSERT INTO "Return" ("tenantId","saleId","returnNumber","items","totalRefund","refundMethod","reason","status","processedBy","notes","isDeleted","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,false,$10,$11)`,
        [tenantId, data.saleId, returnNumber, itemsStr, totalRefund, data.refundMethod || 'cash', data.reason || 'other', data.processedBy || null, data.notes || '', now, now]
      );

      const created = await pgQueryOne(`SELECT * FROM "Return" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
      return NextResponse.json(created);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── PUT: Update return (approve/reject/complete) ───
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    // Validate return belongs to tenant
    const existing = await db.return.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Return not found' }, { status: 404 });

    const updateData: any = { ...fields, updatedAt: new Date() };

    const updated = await db.return.update({
      where: { id, tenantId },
      data: updateData,
    });

    // On approve: restore stock for returned items
    if (fields.status === 'approved') {
      const ret = await db.return.findFirst({ where: { id, tenantId } });
      if (ret) {
        const items = typeof ret.items === 'string' ? JSON.parse(ret.items) : (ret.items || []);
        for (const item of items) {
          if (item.productId && item.quantity > 0) {
            try {
              const product = await db.retailProduct.findFirst({ where: { id: item.productId, tenantId } });
              if (product) {
                await db.retailProduct.update({
                  where: { id: item.productId },
                  data: { quantity: product.quantity + item.quantity },
                });
              }
            } catch { /* stock restore best-effort */ }
          }
        }
      }
    }

    const final = await db.return.findFirst({ where: { id, tenantId } });
    return NextResponse.json(final);
  } catch {
    try {
      const existing = await pgQueryOne<any>(`SELECT * FROM "Return" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`, [id, tenantId]);
      if (!existing) return NextResponse.json({ error: 'Return not found' }, { status: 404 });

      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(fields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "Return" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);

      // On approve: restore stock
      if (fields.status === 'approved') {
        const ret = await pgQueryOne<any>(`SELECT * FROM "Return" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
        if (ret) {
          const items = typeof ret.items === 'string' ? JSON.parse(ret.items) : (ret.items || []);
          for (const item of items) {
            if (item.productId && item.quantity > 0) {
              try {
                await pgQuery(`UPDATE "RetailProduct" SET quantity = quantity + $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [item.quantity, item.productId, tenantId]);
              } catch { /* best-effort */ }
            }
          }
        }
      }

      const final = await pgQueryOne(`SELECT * FROM "Return" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json(final);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── DELETE: Soft delete ───
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await db.return.update({ where: { id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "Return" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
