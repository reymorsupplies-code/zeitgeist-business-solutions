import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: List layaways ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    const where: any = { tenantId, isDeleted: false };
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { layawayNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Check for expired layaways
    const expiredLayaways = await db.layaway.findMany({
      where: { tenantId, isDeleted: false, status: 'active', expiryDate: { lt: new Date() } },
    });
    for (const lay of expiredLayaways) {
      await db.layaway.update({
        where: { id: lay.id },
        data: { status: 'expired' },
      });
      // Restore stock for expired layaways (atomic)
      const items = typeof lay.items === 'string' ? JSON.parse(lay.items) : (lay.items || []);
      for (const item of items) {
        if (item.productId) {
          try {
            await db.$executeRaw`UPDATE "RetailProduct" SET quantity = quantity + ${item.quantity || 0} WHERE id = ${item.productId} AND "tenantId" = ${tenantId}`;
          } catch { /* best-effort */ }
        }
      }
    }

    const layaways = await db.layaway.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json(layaways);
  } catch {
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');

      let sql = `SELECT * FROM "Layaway" WHERE "tenantId" = $1 AND "isDeleted" = false`;
      const params: any[] = [tenantId];
      let pIdx = 2;

      if (status && status !== 'all') { sql += ` AND status = $${pIdx++}`; params.push(status); }
      if (search) { sql += ` AND ("layawayNumber" ILIKE $${pIdx} OR "customerName" ILIKE $${pIdx})`; params.push(`%${search}%`); pIdx++; }
      sql += ` ORDER BY "createdAt" DESC LIMIT 200`;

      // Mark expired
      await pgQuery(`UPDATE "Layaway" SET status = 'expired', "updatedAt" = NOW() WHERE "tenantId" = $1 AND "isDeleted" = false AND status = 'active' AND "expiryDate" < NOW()`, [tenantId]);

      const layaways = await pgQuery<any>(sql, params);
      return NextResponse.json(layaways);
    } catch (err: any) {
        console.error('[layaways] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── POST: Create layaway ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  try {
    if (!data.customerName || !data.customerPhone || !data.items || data.items.length === 0) {
      return NextResponse.json({ error: 'Customer name, phone, and items are required' }, { status: 400 });
    }

    const depositPct = data.depositPercentage || 20;
    const totalAmount = (data.items || []).reduce((s: number, i: any) => s + (i.lineTotal || 0), 0);
    const depositAmount = data.depositAmount || 0;

    const effectiveMinDeposit = data.depositPercentage || 20;
    const requiredDeposit = (totalAmount * effectiveMinDeposit) / 100;
    if (depositAmount < requiredDeposit) {
      return NextResponse.json({ error: `Minimum deposit is ${effectiveMinDeposit}% (${requiredDeposit.toFixed(2)})` }, { status: 400 });
    }

    // Check stock availability
    for (const item of data.items) {
      if (item.productId) {
        const product = await db.retailProduct.findFirst({ where: { id: item.productId, tenantId } });
        if (!product || product.quantity < item.quantity) {
          return NextResponse.json({ error: `Insufficient stock for "${item.name}" (available: ${product?.quantity || 0})` }, { status: 400 });
        }
      }
    }

    // Generate layaway number with retry loop for unique constraint
    const payments = depositAmount > 0 ? [{
      date: new Date().toISOString(),
      amount: depositAmount,
      method: data.paymentMethod || 'cash',
      reference: data.reference || '',
    }] : [];

    let layaway: any;
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const count = await db.layaway.count({ where: { tenantId } });
        const layawayNumber = `LAY-${String(count + 1).padStart(5, '0')}`;
        layaway = await db.layaway.create({
          data: {
            tenantId,
            layawayNumber,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            customerEmail: data.customerEmail || null,
            items: JSON.stringify(data.items),
            totalAmount,
            depositAmount,
            balanceRemaining: totalAmount - depositAmount,
            payments: JSON.stringify(payments),
            status: 'active',
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            expiryDate: new Date(data.expiryDate),
            depositPercentage: depositPct,
            notes: data.notes || null,
          },
        });
        break;
      } catch (err: any) {
        if (err.code === 'P2002' && attempts < maxAttempts - 1) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    // Reserve stock (reduce quantity - atomic)
    for (const item of data.items) {
      if (item.productId) {
        try {
          await db.$executeRaw`UPDATE "RetailProduct" SET quantity = GREATEST(0, quantity - ${item.quantity}) WHERE id = ${item.productId} AND "tenantId" = ${tenantId}`;
        } catch { /* best-effort */ }
      }
    }

    return NextResponse.json(layaway);
  } catch (err: any) {
    // Fallback to pg
    try {
      // data already parsed

      if (!data.customerName || !data.customerPhone || !data.items || data.items.length === 0) {
        return NextResponse.json({ error: 'Customer name, phone, and items are required' }, { status: 400 });
      }

      const depositPct = data.depositPercentage || 20;
      const totalAmount = (data.items || []).reduce((s: number, i: any) => s + (i.lineTotal || 0), 0);
      const depositAmount = data.depositAmount || 0;

      const effectiveMinDeposit = data.depositPercentage || 20;
      const requiredDeposit = (totalAmount * effectiveMinDeposit) / 100;
      if (depositAmount < requiredDeposit) {
        return NextResponse.json({ error: `Minimum deposit is ${effectiveMinDeposit}% (${requiredDeposit.toFixed(2)})` }, { status: 400 });
      }

      // Check stock
      for (const item of data.items) {
        if (item.productId) {
          const prod = await pgQueryOne<any>(`SELECT quantity FROM "RetailProduct" WHERE id = $1 AND "tenantId" = $2`, [item.productId, tenantId]);
          if (!prod || prod.quantity < item.quantity) {
            return NextResponse.json({ error: `Insufficient stock for "${item.name}"` }, { status: 400 });
          }
        }
      }

      // Generate layaway number with retry loop for unique constraint (pg fallback)
      const payments = depositAmount > 0 ? [{ date: new Date().toISOString(), amount: depositAmount, method: data.paymentMethod || 'cash', reference: data.reference || '' }] : [];

      let created: any;
      let pgAttempts = 0;
      const pgMaxAttempts = 3;
      while (pgAttempts < pgMaxAttempts) {
        try {
          const count = await pgQuery<any>(`SELECT COUNT(*)::int as c FROM "Layaway" WHERE "tenantId" = $1`, [tenantId]);
          const cn = (count[0]?.c || 0) + 1;
          const layawayNumber = `LAY-${String(cn).padStart(5, '0')}`;
          const now = new Date().toISOString();

          await pgQuery(
            `INSERT INTO "Layaway" ("tenantId","layawayNumber","customerName","customerPhone","customerEmail","items","totalAmount","depositAmount","balanceRemaining","payments","status","dueDate","expiryDate","depositPercentage","notes","isDeleted","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,$16,$17)`,
            [tenantId, layawayNumber, data.customerName, data.customerPhone, data.customerEmail || null, JSON.stringify(data.items), totalAmount, depositAmount, totalAmount - depositAmount, JSON.stringify(payments), 'active', data.dueDate ? new Date(data.dueDate).toISOString() : null, new Date(data.expiryDate).toISOString(), depositPct, data.notes || null, now, now]
          );

          // Reserve stock (atomic)
          for (const item of data.items) {
            if (item.productId) {
              try { await pgQuery(`UPDATE "RetailProduct" SET quantity = GREATEST(0, quantity - $1), "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [item.quantity, item.productId, tenantId]); } catch { /* best-effort */ }
            }
          }

          created = await pgQueryOne(`SELECT * FROM "Layaway" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
          break;
        } catch (pgErr: any) {
          if (pgErr.code === '23505' && pgAttempts < pgMaxAttempts - 1) {
            pgAttempts++;
            continue;
          }
          throw pgErr;
        }
      }
      return NextResponse.json(created);
    } catch (pgErr: any) {
        console.error('[layaways] Error:', pgErr);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── PUT: Update layaway (add payment, cancel, update details) ───
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const { id, action, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const layaway = await db.layaway.findFirst({ where: { id, tenantId } });
    if (!layaway) return NextResponse.json({ error: 'Layaway not found' }, { status: 404 });

    // ── ADD PAYMENT ──
    if (action === 'addPayment') {
      const { paymentAmount, paymentMethod, paymentReference } = fields;
      if (!paymentAmount || paymentAmount <= 0) return NextResponse.json({ error: 'Valid payment amount required' }, { status: 400 });

      if (paymentAmount > layaway.balanceRemaining) {
        return NextResponse.json({ error: `Payment exceeds remaining balance of ${layaway.balanceRemaining.toFixed(2)}` }, { status: 400 });
      }

      const currentPayments = typeof layaway.payments === 'string' ? JSON.parse(layaway.payments) : (layaway.payments || []);
      currentPayments.push({
        date: new Date().toISOString(),
        amount: paymentAmount,
        method: paymentMethod || 'cash',
        reference: paymentReference || '',
      });

      const totalPaid = currentPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const newBalance = Number(layaway.totalAmount) - totalPaid;
      const isPaidInFull = newBalance <= 0.01; // floating point tolerance

      await db.layaway.update({
        where: { id },
        data: {
          payments: JSON.stringify(currentPayments),
          balanceRemaining: Math.max(0, newBalance),
          status: isPaidInFull ? 'completed' : layaway.status,
        },
      });

      const final = await db.layaway.findFirst({ where: { id, tenantId } });
      return NextResponse.json(final);
    }

    // ── CANCEL LAYAWAY ──
    if (action === 'cancel') {
      if (layaway.status !== 'active') {
        return NextResponse.json({ error: 'Only active layaways can be cancelled' }, { status: 400 });
      }

      // Restore reserved stock (atomic)
      const items = typeof layaway.items === 'string' ? JSON.parse(layaway.items) : (layaway.items || []);
      for (const item of items) {
        if (item.productId) {
          try {
            await db.$executeRaw`UPDATE "RetailProduct" SET quantity = quantity + ${item.quantity || 0} WHERE id = ${item.productId} AND "tenantId" = ${tenantId}`;
          } catch { /* best-effort */ }
        }
      }

      await db.layaway.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      const final = await db.layaway.findFirst({ where: { id, tenantId } });
      return NextResponse.json(final);
    }

    // ── UPDATE DETAILS ──
    const allowedFields = ['customerName', 'customerPhone', 'customerEmail', 'notes', 'dueDate', 'expiryDate'];
    const updateData: any = {};
    for (const key of allowedFields) {
      if (fields[key] !== undefined) {
        updateData[key] = key === 'dueDate' || key === 'expiryDate' ? new Date(fields[key]) : fields[key];
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.layaway.update({ where: { id }, data: updateData });
    }

    const final = await db.layaway.findFirst({ where: { id, tenantId } });
    return NextResponse.json(final);
  } catch {
    try {
      const layaway = await pgQueryOne<any>(`SELECT * FROM "Layaway" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      if (!layaway) return NextResponse.json({ error: 'Layaway not found' }, { status: 404 });

      if (action === 'addPayment') {
        const { paymentAmount, paymentMethod, paymentReference } = fields;
        if (!paymentAmount || paymentAmount <= 0) return NextResponse.json({ error: 'Valid payment amount required' }, { status: 400 });

        if (paymentAmount > layaway.balanceRemaining) {
          return NextResponse.json({ error: `Payment exceeds remaining balance of ${layaway.balanceRemaining.toFixed(2)}` }, { status: 400 });
        }

        const currentPayments = typeof layaway.payments === 'string' ? JSON.parse(layaway.payments) : (layaway.payments || []);
        currentPayments.push({ date: new Date().toISOString(), amount: paymentAmount, method: paymentMethod || 'cash', reference: paymentReference || '' });
        const totalPaid = currentPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
        const newBalance = layaway.totalAmount - totalPaid;
        const isPaidInFull = newBalance <= 0.01;

        await pgQuery(
          `UPDATE "Layaway" SET payments = $1, "balanceRemaining" = $2, status = $3, "updatedAt" = NOW() WHERE id = $4 AND "tenantId" = $5`,
          [JSON.stringify(currentPayments), Math.max(0, newBalance), isPaidInFull ? 'completed' : layaway.status, id, tenantId]
        );

        const final = await pgQueryOne(`SELECT * FROM "Layaway" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
        return NextResponse.json(final);
      }

      if (action === 'cancel') {
        if (layaway.status !== 'active') return NextResponse.json({ error: 'Only active layaways can be cancelled' }, { status: 400 });

        const items = typeof layaway.items === 'string' ? JSON.parse(layaway.items) : (layaway.items || []);
        for (const item of items) {
          if (item.productId) {
            try { await pgQuery(`UPDATE "RetailProduct" SET quantity = quantity + $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [item.quantity || 0, item.productId, tenantId]); } catch { /* best-effort */ }
          }
        }
        await pgQuery(`UPDATE "Layaway" SET status = 'cancelled', "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
        const final = await pgQueryOne(`SELECT * FROM "Layaway" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
        return NextResponse.json(final);
      }

      // Update details
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      const allowedFields = ['customerName', 'customerPhone', 'customerEmail', 'notes', 'dueDate', 'expiryDate'];
      for (const key of allowedFields) {
        if (fields[key] !== undefined) {
          setParts.push(`"${key}" = $${pIdx++}`);
          paramValues.push(key === 'dueDate' || key === 'expiryDate' ? new Date(fields[key]).toISOString() : fields[key]);
        }
      }
      if (setParts.length > 0) {
        setParts.push(`"updatedAt" = NOW()`);
        await pgQuery(`UPDATE "Layaway" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);
      }

      const final = await pgQueryOne(`SELECT * FROM "Layaway" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json(final);
    } catch (err: any) {
        console.error('[layaways] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── DELETE: Soft delete (restore stock if still active) ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const layaway = await db.layaway.findFirst({ where: { id, tenantId } });
    if (layaway && (layaway.status === 'active' || layaway.status === 'expired')) {
      // Restore reserved stock (atomic)
      const items = typeof layaway.items === 'string' ? JSON.parse(layaway.items) : (layaway.items || []);
      for (const item of items) {
        if (item.productId) {
          try {
            await db.$executeRaw`UPDATE "RetailProduct" SET quantity = quantity + ${item.quantity || 0} WHERE id = ${item.productId} AND "tenantId" = ${tenantId}`;
          } catch { /* best-effort */ }
        }
      }
    }

    await db.layaway.update({ where: { id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      const layaway = await pgQueryOne<any>(`SELECT * FROM "Layaway" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      if (layaway && (layaway.status === 'active' || layaway.status === 'expired')) {
        const items = typeof layaway.items === 'string' ? JSON.parse(layaway.items) : (layaway.items || []);
        for (const item of items) {
          if (item.productId) {
            try { await pgQuery(`UPDATE "RetailProduct" SET quantity = quantity + $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [item.quantity || 0, item.productId, tenantId]); } catch { /* best-effort */ }
          }
        }
      }

      await pgQuery(`UPDATE "Layaway" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[layaways] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}
