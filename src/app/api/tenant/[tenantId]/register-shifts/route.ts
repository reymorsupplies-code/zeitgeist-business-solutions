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
      sql += ` ORDER BY "createdAt" DESC LIMIT $${idx}`;
      params.push(limit);
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
        console.error('[register-shifts] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    // Generate shift number with retry loop for unique constraint
    let shift: any;
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const count = await db.registerShift.count({ where: { tenantId } });
        const shiftNumber = `SHIFT-${String(count + 1).padStart(5, '0')}`;
        shift = await db.registerShift.create({
          data: {
            tenantId,
            shiftNumber,
            staffName: data.staffName,
            staffId: data.staffId || null,
            startingCash: data.startingCash,
            status: 'open',
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

      // Generate shift number with retry loop for unique constraint (pg fallback)
      let created: any;
      let pgAttempts = 0;
      const pgMaxAttempts = 3;
      while (pgAttempts < pgMaxAttempts) {
        try {
          const count = await pgQueryOne<any>(`SELECT COUNT(*)::int as c FROM "RegisterShift" WHERE "tenantId" = $1`, [tenantId]);
          const cn = (count?.c || 0) + 1;
          const shiftNumber = `SHIFT-${String(cn).padStart(5, '0')}`;
          const now = new Date().toISOString();

          await pgQuery(
            `INSERT INTO "RegisterShift" ("tenantId","shiftNumber","staffName","staffId","startingCash","status","isDeleted","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,'open',false,$6,$7)`,
            [tenantId, shiftNumber, data.staffName, data.staffId || null, data.startingCash, now, now]
          );

          created = await pgQueryOne<any>(`SELECT * FROM "RegisterShift" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
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
    } catch (err: any) {
        console.error('[register-shifts] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── PUT: Close shift or update notes ───
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

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
      // NOTE: Split payments are included in totalSales but NOT broken down into
      // cash/card/transfer. The POSSale model stores a single paymentMethod per sale,
      // so 'split' sales are counted in totalSales but excluded from individual method
      // breakdowns. A future enhancement could store splitDetails as a JSON field.
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

      let cashSales = Number(cashSalesAgg._sum.totalAmount ?? 0);
      const cardSales = Number(cardSalesAgg._sum.totalAmount ?? 0);
      const transferSales = Number(transferSalesAgg._sum.totalAmount ?? 0);
      const totalSales = Number(salesAgg._sum.totalAmount ?? 0);
      const transactionCount = salesAgg._count || 0;

      // Aggregate refunds for this period
      const refundsAgg = await db.productReturn.aggregate({
        _sum: { totalRefund: true },
        _count: true,
        where: {
          tenantId,
          isDeleted: false,
          status: { in: ['approved', 'completed'] },
          createdAt: { gte: openedAt, lte: now },
        },
      });
      const totalRefunds = refundsAgg._sum.totalRefund || 0;
      const refundCount = refundsAgg._count || 0;

      // Aggregate cash refunds only (for expected cash calc)
      const cashRefundsAgg = await db.productReturn.aggregate({
        _sum: { totalRefund: true },
        where: {
          tenantId,
          isDeleted: false,
          status: { in: ['approved', 'completed'] },
          refundMethod: 'cash',
          createdAt: { gte: openedAt, lte: now },
        },
      });
      const cashRefunds = Number(cashRefundsAgg._sum.totalRefund ?? 0);

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
      const giftCardSales = Number(giftCardAgg._sum.totalAmount || 0);

      // Aggregate layaway deposits for this period
      // NOTE: This only captures layaways CREATED during the shift (by createdAt).
      // Payments added to pre-existing layaways via addPayment are stored in the
      // payments JSON array and cannot be easily queried. A separate payments table
      // would be needed to track mid-shift payments on existing layaways.
      // We also capture layaways COMPLETED (fully paid off) during the shift period.
      const layawayCreatedAgg = await db.layaway.aggregate({
        _sum: { depositAmount: true },
        where: {
          tenantId,
          isDeleted: false,
          createdAt: { gte: openedAt, lte: now },
        },
      });
      const layawayCompletedAgg = await db.layaway.aggregate({
        _sum: { totalAmount: true },
        where: {
          tenantId,
          isDeleted: false,
          status: 'completed',
          updatedAt: { gte: openedAt, lte: now },
        },
      });
      const layawayDeposits = Number(layawayCreatedAgg._sum.depositAmount || 0) + Number(layawayCompletedAgg._sum.totalAmount || 0);

      // Gift cards issued during shift (cash received for new cards)
      // NOTE: Reload amounts are stored in the transactions JSON field and are not
      // easily queryable. Only initial issuance amounts are captured here.
      const gcIssuedAgg = await db.giftCard.aggregate({
        _sum: { initialBalance: true },
        where: {
          tenantId,
          isDeleted: false,
          issuedAt: { gte: openedAt, lte: now },
        },
      });
      const giftCardCashReceived = Number(gcIssuedAgg._sum.initialBalance || 0);
      cashSales += giftCardCashReceived;

      const expectedCash = Number(shift.startingCash) + cashSales - cashRefunds;
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
        // NOTE: Split payments are included in total_sales but NOT broken down into
        // cash/card/transfer (same limitation as Prisma path).
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
          `SELECT COALESCE(SUM("totalRefund"), 0)::float as total_refunds, COUNT(*)::int as refund_count FROM "ProductReturn" WHERE "tenantId" = $1 AND "isDeleted" = false AND status IN ('approved', 'completed') AND "createdAt" >= $2 AND "createdAt" <= $3`,
          [tenantId, openedAt, now]
        );
        const totalRefunds = refundRes?.total_refunds || 0;
        const refundCount = refundRes?.refund_count || 0;

        // Aggregate cash refunds only
        const cashRefundRes = await pgQueryOne<any>(
          `SELECT COALESCE(SUM("totalRefund"), 0)::float as cash_refunds FROM "ProductReturn" WHERE "tenantId" = $1 AND "isDeleted" = false AND status IN ('approved', 'completed') AND "refundMethod" = 'cash' AND "createdAt" >= $2 AND "createdAt" <= $3`,
          [tenantId, openedAt, now]
        );
        const cashRefunds = cashRefundRes?.cash_refunds || 0;

        // Gift card sales
        const gcRes = await pgQueryOne<any>(
          `SELECT COALESCE(SUM("totalAmount"), 0)::float as gc_total FROM "POSSale" WHERE "tenantId" = $1 AND status = 'completed' AND "isDeleted" = false AND "paymentMethod" = 'gift_card' AND "createdAt" >= $2 AND "createdAt" <= $3`,
          [tenantId, openedAt, now]
        );
        const giftCardSales = gcRes?.gc_total || 0;

        // Layaway deposits
        // NOTE: Same limitation as Prisma path — only captures layaways created during
        // the shift plus those completed during the shift. Mid-shift payments on existing
        // layaways stored in the payments JSON array are not queryable.
        const layRes = await pgQueryOne<any>(
          `SELECT
            COALESCE((SELECT SUM("depositAmount") FROM "Layaway" WHERE "tenantId" = $1 AND "isDeleted" = false AND "createdAt" >= $2 AND "createdAt" <= $3), 0)::float as created_total,
            COALESCE((SELECT SUM("totalAmount") FROM "Layaway" WHERE "tenantId" = $1 AND "isDeleted" = false AND status = 'completed' AND "updatedAt" >= $2 AND "updatedAt" <= $3), 0)::float as completed_total`,
          [tenantId, openedAt, now]
        );
        const layawayDeposits = (layRes?.created_total || 0) + (layRes?.completed_total || 0);

        // Gift cards issued during shift (cash received for new cards)
        const gcIssuedRes = await pgQueryOne<any>(
          `SELECT COALESCE(SUM("initialBalance"), 0)::float as gc_issued FROM "GiftCard" WHERE "tenantId" = $1 AND "isDeleted" = false AND "issuedAt" >= $2 AND "issuedAt" <= $3`,
          [tenantId, openedAt, now]
        );
        const giftCardCashReceived = gcIssuedRes?.gc_issued || 0;

        const adjustedCashSales = cashSales + giftCardCashReceived;

        const expectedCash = shift.startingCash + adjustedCashSales - cashRefunds;
        const discrepancy = Math.round((closingCash - expectedCash) * 100) / 100;

        await pgQuery(
          `UPDATE "RegisterShift" SET status = 'closed', "closedAt" = $1, "closingCash" = $2, "expectedCash" = $3,
            "cashSales" = $4, "cardSales" = $5, "transferSales" = $6, "totalSales" = $7,
            "totalRefunds" = $8, "giftCardSales" = $9, "layawayDeposits" = $10,
            "transactionCount" = $11, "refundCount" = $12, "discrepancy" = $13,
            notes = COALESCE($14, notes), "updatedAt" = NOW()
          WHERE id = $15 AND "tenantId" = $16`,
          [now, closingCash, expectedCash, adjustedCashSales, cardSales, transferSales, totalSales, totalRefunds, giftCardSales, layawayDeposits, transactionCount, refundCount, discrepancy, notes || null, id, tenantId]
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
        console.error('[register-shifts] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── DELETE: Soft delete (only closed shifts) ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

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
        console.error('[register-shifts] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}
