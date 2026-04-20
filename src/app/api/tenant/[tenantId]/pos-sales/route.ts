import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields, checkRateLimit } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: List POS sales ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('from');
  const dateTo = url.searchParams.get('to');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '100');

  try {
    const where: any = { tenantId, isDeleted: false };
    if (status && status !== 'all') where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const sales = await db.pOSSale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json(sales);
  } catch {
    try {
      let sql = `SELECT * FROM "POSSale" WHERE "tenantId" = $1 AND "isDeleted" = false`;
      const params: any[] = [tenantId];
      let idx = 2;
      if (status && status !== 'all') { sql += ` AND status = $${idx++}`; params.push(status); }
      if (dateFrom) { sql += ` AND "createdAt" >= $${idx++}`; params.push(dateFrom); }
      if (dateTo) { sql += ` AND "createdAt" <= $${idx++}`; params.push(dateTo); }
      sql += ` ORDER BY "createdAt" DESC LIMIT 100`;
      const sales = await pgQuery<any>(sql, params);
      return NextResponse.json(sales);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── POST: Create POS sale + deduct stock ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(`pos-sales-post:${req.headers.get('x-forwarded-for') || 'unknown'}`, 30, 60_000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  try {
    // Generate sale number
    const count = await db.pOSSale.count({ where: { tenantId } });
    const saleNumber = `SL-${String(count + 1).padStart(5, '0')}`;

    const sale = await db.pOSSale.create({
      data: {
        tenantId,
        saleNumber,
        items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
        subtotal: data.subtotal || 0,
        discountPct: data.discountPct || 0,
        discountAmount: data.discountAmount || 0,
        taxAmount: data.taxAmount || 0,
        totalAmount: data.totalAmount || 0,
        paymentMethod: data.paymentMethod || 'cash',
        cashReceived: data.cashReceived || 0,
        changeAmount: data.changeAmount || 0,
        currency: data.currency || 'TTD',
        customerName: data.customerName || '',
        staffName: data.staffName || '',
        status: data.status || 'completed',
      },
    });

    // Deduct stock for each item (atomic)
    if (sale.status === 'completed' && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.productId && item.qty > 0) {
          try {
            await db.$executeRaw`UPDATE "RetailProduct" SET quantity = GREATEST(0, quantity - ${item.qty}) WHERE id = ${item.productId} AND "tenantId" = ${tenantId}`;
          } catch { /* stock deduction best-effort */ }
        }
      }
    }

    return NextResponse.json(sale);
  } catch (error: any) {
    try {
      // pg fallback — data already parsed
      const count = await pgQuery<any>(`SELECT COUNT(*)::int as c FROM "POSSale" WHERE "tenantId" = $1`, [tenantId]);
      const cn = (count[0]?.c || 0) + 1;
      const saleNumber = `SL-${String(cn).padStart(5, '0')}`;
      const itemsStr = typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []);
      const now = new Date().toISOString();

      await pgQuery(
        `INSERT INTO "POSSale" ("tenantId","saleNumber","items","subtotal","discountPct","discountAmount","taxAmount","totalAmount","paymentMethod","cashReceived","changeAmount","currency","customerName","staffName","status","isDeleted","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,$16,$17)`,
        [tenantId, saleNumber, itemsStr, data.subtotal || 0, data.discountPct || 0, data.discountAmount || 0, data.taxAmount || 0, data.totalAmount || 0, data.paymentMethod || 'cash', data.cashReceived || 0, data.changeAmount || 0, data.currency || 'TTD', data.customerName || '', data.staffName || '', data.status || 'completed', now, now]
      );

      // Deduct stock
      if (data.status === 'completed' && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.productId && item.qty > 0) {
            try {
              await pgQuery(`UPDATE "RetailProduct" SET quantity = GREATEST(0, quantity - $1), "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [item.qty, item.productId, tenantId]);
            } catch { /* best-effort */ }
          }
        }
      }

      const created = await pgQueryOne(`SELECT * FROM "POSSale" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
      return NextResponse.json(created);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── PUT: Update sale status (void, hold) ───
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(`pos-sales-put:${req.headers.get('x-forwarded-for') || 'unknown'}`, 30, 60_000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const updated = await db.pOSSale.update({
      where: { id, tenantId },
      data: whitelistFields('POSSale', fields),
    });

    // If voiding a completed sale, restore stock (atomic)
    if (fields.status === 'voided') {
      const sale = await db.pOSSale.findFirst({ where: { id, tenantId } });
      if (sale) {
        const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
        for (const item of items) {
          if (item.productId && item.qty > 0) {
            try {
              await db.$executeRaw`UPDATE "RetailProduct" SET quantity = quantity + ${item.qty} WHERE id = ${item.productId} AND "tenantId" = ${tenantId}`;
            } catch { /* best-effort */ }
          }
        }
      }
    }

    return NextResponse.json(updated);
  } catch {
    try {
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(fields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "POSSale" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);

      // Restore stock if voiding
      if (fields.status === 'voided') {
        const sale = await pgQueryOne<any>(`SELECT * FROM "POSSale" WHERE id = $1`, [id]);
        if (sale) {
          const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
          for (const item of items) {
            if (item.productId && item.qty > 0) {
              try { await pgQuery(`UPDATE "RetailProduct" SET quantity = quantity + $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [item.qty, item.productId, tenantId]); } catch { /* best-effort */ }
            }
          }
        }
      }

      const updated = await pgQueryOne(`SELECT * FROM "POSSale" WHERE id = $1`, [id]);
      return NextResponse.json(updated);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── DELETE: Soft delete ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await db.pOSSale.update({ where: { id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "POSSale" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
