import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: List register shifts ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const dateFrom = url.searchParams.get('from');
  const dateTo = url.searchParams.get('to');
  const staffName = url.searchParams.get('staffName');
  const limit = parseInt(url.searchParams.get('limit') || '100');

  try {
    const where: any = { tenantId, isDeleted: false };
    if (status && status !== 'all') where.status = status;
    if (staffName) where.staffName = { contains: staffName, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.openedAt = {};
      if (dateFrom) where.openedAt.gte = new Date(dateFrom);
      if (dateTo) where.openedAt.lte = new Date(dateTo);
    }

    const shifts = await db.registerShift.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // If status=open, include summary stats
    let summary: any = null;
    if (status === 'open') {
      const openShifts = shifts.filter((s: any) => s.status === 'open');
      if (openShifts.length > 0) {
        const currentShift = openShifts[0];
        // Aggregate POS sales for the current open shift
        const salesResult = await db.pOSSale.aggregate({
          _sum: { totalAmount: true },
          _count: true,
          where: {
            tenantId,
            status: 'completed',
            isDeleted: false,
            createdAt: { gte: currentShift.openedAt },
          },
        });
        summary = {
          currentShiftId: currentShift.id,
          runningTotal: salesResult._sum.totalAmount || 0,
          transactionCount: salesResult._count,
          openedAt: currentShift.openedAt,
          elapsed: Math.floor((Date.now() - new Date(currentShift.openedAt).getTime()) / 60000),
        };
      }
    }

    return NextResponse.json({ shifts, summary });
  } catch {
    try {
      let sql = `SELECT * FROM "RegisterShift" WHERE "tenantId" = $1 AND "isDeleted" = false`;
      const params: any[] = [tenantId];
      let idx = 2;
      if (status && status !== 'all') { sql += ` AND status = $${idx++}`; params.push(status); }
      if (staffName) { sql += ` AND "staffName" ILIKE $${idx++}`; params.push(`%${staffName}%`); }
      if (dateFrom) { sql += ` AND "openedAt" >= $${idx++}`; params.push(dateFrom); }
      if (dateTo) { sql += ` AND "openedAt" <= $${idx++}`; params.push(dateTo); }
      sql += ` ORDER BY "createdAt" DESC LIMIT ${limit}`;
      const shifts = await pgQuery<any>(sql, params);

      let summary: any = null;
      if (status === 'open') {
        const openShifts = shifts.filter((s: any) => s.status === 'open');
        if (openShifts.length > 0) {
          const current = openShifts[0];
          const salesRes = await pgQueryOne<any>(
            `SELECT COALESCE(SUM("totalAmount"), 0)::float as total, COUNT(*)::int as cnt FROM "POSSale" WHERE "tenantId" = $1 AND status = 'completed' AND "isDeleted" = false AND "createdAt" >= $2`,
            [tenantId, current.openedAt]
          );
          summary = {
            currentShiftId: current.id,
            runningTotal: salesRes?.total || 0,
            transactionCount: salesRes?.cnt || 0,
            openedAt: current.openedAt,
            elapsed: Math.floor((Date.now() - new Date(current.openedAt).getTime()) / 60000),
          };
        }
      }

      return NextResponse.json({ shifts, summary });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── POST: Open new shift ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    if (!data.staffName || data.startingCash === undefined || data.startingCash === null) {
      return NextResponse.json({ error: 'staffName and startingCash are required' }, { status: 400 });
    }

    // Check for existing open shift
    const existingOpen = await db.registerShift.findFirst({
      where: { tenantId, status: 'open', isDeleted: false },
    });
    if (existingOpen) {
      return NextResponse.json({ error: 'An open shift already exists. Close it before opening a new one.', existingShift: existingOpen }, { status: 409 });
    }

    // Generate shift number
    const count = await db.registerShift.count({ where: { tenantId } });
    const shiftNumber = `SHIFT-${String(count + 1).padStart(5, '0')}`;

    const shift = await db.registerShift.create({
      data: {
        tenantId,
        shiftNumber,
        staffName: data.staffName,
        staffId: data.staffId || null,
        startingCash: data.startingCash,
        status: 'open',
      },
    });

    return NextResponse.json(shift);
  } catch (error: any) {
    try {
      const data = await req.json();
      if (!data.staffName || data.startingCash === undefined || data.startingCash === null) {
        return NextResponse.json({ error: 'staffName and startingCash are required' }, { status: 400 });
      }

      // Check for existing open shift
      const existing = await pgQueryOne<any>(
        `SELECT * FROM "RegisterShift" WHERE "tenantId" = $1 AND status = 'open' AND "isDeleted" = false`,
        [tenantId]
      );
      if (existing) {
        return NextResponse.json({ error: 'An open shift already exists. Close it before opening a new one.', existingShift: existing }, { status: 409 });
      }

      const count = await pgQueryOne<any>(`SELECT COUNT(*)::int as c FROM "RegisterShift" WHERE "tenantId" = $1`, [tenantId]);
      const cn = (count?.c || 0) + 1;
      const shiftNumber = `SHIFT-${String(cn).padStart(5, '0')}`;
      const now = new Date().toISOString();

      await pgQuery(
        `INSERT INTO "RegisterShift" ("tenantId","shiftNumber","staffName","staffId","startingCash","status","isDeleted","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,'open',false,$6,$7)`,
        [tenantId, shiftNumber, data.staffName, data.staffId || null, data.startingCash, now, now]
      );

      const created = await pgQueryOne<any>(`SELECT * FROM "RegisterShift" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
      return NextResponse.json(created);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── PUT: Close shift or update notes ───
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const body = await req.json();
  const { id, action, closingCash, notes } = body;
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const shift = await db.registerShift.findFirst({ where: { id, tenantId, isDeleted: false } });
    if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });

    // Update notes
    if (action === 'updateNotes' && notes !== undefined) {
      const updated = await db.registerShift.update({
        where: { id },
        data: { notes },
      });
      return NextResponse.json(updated);
    }

    // Close shift
    if (action === 'close') {
      if (shift.status === 'closed') {
        return NextResponse.json({ error: 'Shift is already closed' }, { status: 400 });
      }
      if (closingCash === undefined || closingCash === null) {
        return NextResponse.json({ error: 'closingCash is required to close shift' }, { status: 400 });
      }

      const openedAt = new Date(shift.openedAt);
      const now = new Date();

      // Aggregate POS sales for this shift period
      const salesAgg = await db.pOSSale.aggregate({
        _sum: {
          totalAmount: true,
        },
        _count: true,
        where: {
          tenantId,
          status: 'completed',
          isDeleted: false,
          createdAt: { gte: openedAt, lte: now },
        },
      });

      // Aggregate by payment method
      const cashSalesAgg = await db.pOSSale.aggregate({
        _sum: { totalAmount: true },
        where: { tenantId, status: 'completed', isDeleted: false, paymentMethod: 'cash', createdAt: { gte: openedAt, lte: now } },
      });
      const cardSalesAgg = await db.pOSSale.aggregate({
        _sum: { totalAmount: true },
        where: { tenantId, status: 'completed', isDeleted: false, paymentMethod: 'card', createdAt: { gte: openedAt, lte: now } },
      });
      const transferSalesAgg = await db.pOSSale.aggregate({
        _sum: { totalAmount: true },
        where: { tenantId, status: 'completed', isDeleted: false, paymentMethod: 'transfer', createdAt: { gte: openedAt, lte: now } },
      });

      const cashSales = cashSalesAgg._sum.totalAmount || 0;
      const cardSales = cardSalesAgg._sum.totalAmount || 0;
      const transferSales = transferSalesAgg._sum.totalAmount || 0;
      const totalSales = salesAgg._sum.totalAmount || 0;
      const transactionCount = salesAgg._count || 0;

      // Aggregate refunds for this period
      const refundsAgg = await db.return.aggregate({
        _sum: { totalRefund: true },
        _count: true,
        where: {
          tenantId,
          isDeleted: false,
          createdAt: { gte: openedAt, lte: now },
        },
      });
      const totalRefunds = refundsAgg._sum.totalRefund || 0;
      const refundCount = refundsAgg._count || 0;

      // Aggregate gift card sales (redemptions)
      const giftCardAgg = await db.pOSSale.aggregate({
        _sum: { totalAmount: true },
        where: {
          tenantId,
          status: 'completed',
          isDeleted: false,
          paymentMethod: 'gift_card',
          createdAt: { gte: openedAt, lte: now },
        },
      });
      const giftCardSales = giftCardAgg._sum.totalAmount || 0;

      // Aggregate layaway deposits for this period
      const layawayAgg = await db.layaway.aggregate({
        _sum: { depositAmount: true },
        where: {
          tenantId,
          isDeleted: false,
          createdAt: { gte: openedAt, lte: now },
        },
      });
      const layawayDeposits = layawayAgg._sum.depositAmount || 0;

      const expectedCash = shift.startingCash + cashSales - totalRefunds;
      const discrepancy = Math.round((closingCash - expectedCash) * 100) / 100;

      const updated = await db.registerShift.update({
        where: { id },
        data: {
          status: 'closed',
          closedAt: now,
          closingCash,
          expectedCash,
          cashSales,
          cardSales,
          transferSales,
          totalSales,
          totalRefunds,
          giftCardSales,
          layawayDeposits,
          transactionCount,
          refundCount,
          discrepancy,
          notes: notes || shift.notes,
        },
      });

      return NextResponse.json(updated);
    }

    // Generic field update
    const { id: _id, action: _a, closingCash: _cc, ...fields } = body;
    const updated = await db.registerShift.update({
      where: { id, tenantId },
      data: whitelistFields('RegisterShift', fields),
    });
    return NextResponse.json(updated);
  } catch {
    try {
      const shift = await pgQueryOne<any>(`SELECT * FROM "RegisterShift" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`, [id, tenantId]);
      if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });

      // Update notes
      if (action === 'updateNotes' && notes !== undefined) {
        await pgQuery(`UPDATE "RegisterShift" SET notes = $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [notes, id, tenantId]);
        const updated = await pgQueryOne<any>(`SELECT * FROM "RegisterShift" WHERE id = $1`, [id]);
        return NextResponse.json(updated);
      }

      // Close shift
      if (action === 'close') {
        if (shift.status === 'closed') return NextResponse.json({ error: 'Shift is already closed' }, { status: 400 });
        if (closingCash === undefined || closingCash === null) return NextResponse.json({ error: 'closingCash is required' }, { status: 400 });

        const now = new Date().toISOString();
        const openedAt = shift.openedAt;

        // Aggregate POS sales
        const salesRes = await pgQueryOne<any>(
          `SELECT
            COALESCE(SUM(CASE WHEN "paymentMethod" = 'cash' THEN "totalAmount" ELSE 0 END), 0)::float as cash_sales,
            COALESCE(SUM(CASE WHEN "paymentMethod" = 'card' THEN "totalAmount" ELSE 0 END), 0)::float as card_sales,
            COALESCE(SUM(CASE WHEN "paymentMethod" = 'transfer' THEN "totalAmount" ELSE 0 END), 0)::float as transfer_sales,
            COALESCE(SUM("totalAmount"), 0)::float as total_sales,
            COUNT(*)::int as transaction_count
          FROM "POSSale"
          WHERE "tenantId" = $1 AND status = 'completed' AND "isDeleted" = false AND "createdAt" >= $2 AND "createdAt" <= $3`,
          [tenantId, openedAt, now]
        );

        const cashSales = salesRes?.cash_sales || 0;
        const cardSales = salesRes?.card_sales || 0;
        const transferSales = salesRes?.transfer_sales || 0;
        const totalSales = salesRes?.total_sales || 0;
        const transactionCount = salesRes?.transaction_count || 0;

        // Aggregate refunds
        const refundRes = await pgQueryOne<any>(
          `SELECT COALESCE(SUM("totalRefund"), 0)::float as total_refunds, COUNT(*)::int as refund_count FROM "Return" WHERE "tenantId" = $1 AND "isDeleted" = false AND "createdAt" >= $2 AND "createdAt" <= $3`,
          [tenantId, openedAt, now]
        );
        const totalRefunds = refundRes?.total_refunds || 0;
        const refundCount = refundRes?.refund_count || 0;

        // Gift card sales
        const gcRes = await pgQueryOne<any>(
          `SELECT COALESCE(SUM("totalAmount"), 0)::float as gc_total FROM "POSSale" WHERE "tenantId" = $1 AND status = 'completed' AND "isDeleted" = false AND "paymentMethod" = 'gift_card' AND "createdAt" >= $2 AND "createdAt" <= $3`,
          [tenantId, openedAt, now]
        );
        const giftCardSales = gcRes?.gc_total || 0;

        // Layaway deposits
        const layRes = await pgQueryOne<any>(
          `SELECT COALESCE(SUM("depositAmount"), 0)::float as lay_total FROM "Layaway" WHERE "tenantId" = $1 AND "isDeleted" = false AND "createdAt" >= $2 AND "createdAt" <= $3`,
          [tenantId, openedAt, now]
        );
        const layawayDeposits = layRes?.lay_total || 0;

        const expectedCash = shift.startingCash + cashSales - totalRefunds;
        const discrepancy = Math.round((closingCash - expectedCash) * 100) / 100;

        await pgQuery(
          `UPDATE "RegisterShift" SET status = 'closed', "closedAt" = $1, "closingCash" = $2, "expectedCash" = $3,
            "cashSales" = $4, "cardSales" = $5, "transferSales" = $6, "totalSales" = $7,
            "totalRefunds" = $8, "giftCardSales" = $9, "layawayDeposits" = $10,
            "transactionCount" = $11, "refundCount" = $12, "discrepancy" = $13,
            notes = COALESCE($14, notes), "updatedAt" = NOW()
          WHERE id = $15 AND "tenantId" = $16`,
          [now, closingCash, expectedCash, cashSales, cardSales, transferSales, totalSales, totalRefunds, giftCardSales, layawayDeposits, transactionCount, refundCount, discrepancy, notes || null, id, tenantId]
        );

        const updated = await pgQueryOne<any>(`SELECT * FROM "RegisterShift" WHERE id = $1`, [id]);
        return NextResponse.json(updated);
      }

      // Generic update
      const { id: _id2, action: _a2, closingCash: _cc2, ...fields } = body;
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(fields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "RegisterShift" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);
      const updated = await pgQueryOne<any>(`SELECT * FROM "RegisterShift" WHERE id = $1`, [id]);
      return NextResponse.json(updated);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── DELETE: Soft delete (only closed shifts) ───
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const shift = await db.registerShift.findFirst({ where: { id, tenantId, isDeleted: false } });
    if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    if (shift.status === 'open') return NextResponse.json({ error: 'Cannot delete an open shift. Close it first.' }, { status: 400 });

    await db.registerShift.update({ where: { id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      const shift = await pgQueryOne<any>(`SELECT * FROM "RegisterShift" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`, [id, tenantId]);
      if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
      if (shift.status === 'open') return NextResponse.json({ error: 'Cannot delete an open shift. Close it first.' }, { status: 400 });

      await pgQuery(`UPDATE "RegisterShift" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
