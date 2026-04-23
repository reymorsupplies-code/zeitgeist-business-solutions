import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';
import { authenticateRequest } from '@/lib/auth';

// ─── T&T Compliance Constants ───
const TANDT_DEPOSIT_RETURN_DAYS = 14; // Security deposit must be returned within 14 days of vacate

// ─── GET: List deposits with filters + return deadline monitoring ───
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const leaseId = searchParams.get('leaseId');
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId');
    const includeOverdue = searchParams.get('includeOverdue');

    const where: any = {};
    if (leaseId) where.leaseId = leaseId;
    if (propertyId) where.propertyId = propertyId;
    if (tenantId) where.tenantId = tenantId;
    if (status && status !== 'all') where.status = status;

    const deposits = await db.securityDeposit.findMany({
      where,
      include: {
        lease: {
          include: {
            unit: { include: { property: true } },
            tenant: true,
          },
        },
        property: true,
        unit: true,
        tenant: true,
      },
      orderBy: { collectedAt: 'desc' },
    });

    // Compute pastReturnDeadline flag for each deposit
    const now = new Date();
    const enriched = deposits.map((dep) => {
      const pastDeadline =
        dep.status === 'held' &&
        dep.returnDeadline !== null &&
        now > dep.returnDeadline;
      return {
        ...dep,
        pastReturnDeadline: pastDeadline,
        daysUntilDeadline: dep.returnDeadline
          ? Math.max(0, Math.ceil((dep.returnDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : null,
      };
    });

    // Optionally filter only overdue deposits
    const result =
      includeOverdue === 'true'
        ? enriched.filter((d) => d.pastReturnDeadline)
        : enriched;

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── POST: Create deposit with T&T compliance validation ───
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const body = await req.json();
    const {
      leaseId,
      propertyId,
      unitId,
      tenantId,
      amount,
      currency,
      vacateDate,
    } = body;

    if (!leaseId || !propertyId || !unitId) {
      return NextResponse.json(
        { error: 'leaseId, propertyId, and unitId are required' },
        { status: 400 }
      );
    }

    // ─── T&T Compliance: deposit must not exceed 1 month's rent ───
    const lease = await db.lease.findUnique({
      where: { id: leaseId },
      include: { unit: true },
    });

    if (!lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    const monthlyRent = lease.rentAmount;
    const depositAmount = Number(amount) || 0;

    if (depositAmount > monthlyRent && monthlyRent > 0) {
      return NextResponse.json(
        {
          error: `T&T compliance violation: Security deposit (${currency || 'TTD'} ${depositAmount.toFixed(2)}) exceeds one month's rent (${lease.rentCurrency || 'TTD'} ${monthlyRent.toFixed(2)}). Under Trinidad & Tobago rental regulations, the security deposit should not exceed one month's rent.`,
          compliance: {
            maxAllowed: monthlyRent,
            requested: depositAmount,
            monthlyRent,
            rule: 'Deposit must not exceed 1 month rent per T&T rental practice guidelines',
          },
        },
        { status: 422 }
      );
    }

    // ─── Auto-calculate returnDeadline = vacate_date + 14 days ───
    let returnDeadline: Date | null = null;
    if (vacateDate) {
      const vacate = new Date(vacateDate);
      returnDeadline = new Date(vacate);
      returnDeadline.setDate(returnDeadline.getDate() + TANDT_DEPOSIT_RETURN_DAYS);
    } else if (lease.endDate) {
      // Default to lease end date + 14 days if no vacate date provided
      returnDeadline = new Date(lease.endDate);
      returnDeadline.setDate(returnDeadline.getDate() + TANDT_DEPOSIT_RETURN_DAYS);
    }

    const deposit = await db.securityDeposit.create({
      data: {
        leaseId,
        propertyId,
        unitId,
        tenantId: tenantId || null,
        amount: depositAmount,
        currency: currency || 'TTD',
        status: 'held',
        collectedAt: new Date(),
        returnDeadline,
        returnedAmount: 0,
        deductionTotal: 0,
        deductionDetails: '[]',
        deductionReceipts: '[]',
        notes: body.notes || null,
      },
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true,
        unit: true,
        tenant: true,
      },
    });

    return NextResponse.json(deposit, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── PATCH: Process deposit return with deduction validation ───
export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const existing = await db.securityDeposit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    const body = await req.json();
    const data: any = {};

    // Handle status updates
    if (body.status !== undefined) data.status = body.status;

    // Handle deduction processing
    if (body.deductionTotal !== undefined) {
      const deductionTotal = Number(body.deductionTotal) || 0;
      const returnedAmount = Number(body.returnedAmount) || 0;

      // ─── T&T Compliance: returnedAmount + deductionTotal <= amount ───
      if (returnedAmount + deductionTotal > existing.amount) {
        return NextResponse.json(
          {
            error: `Total disbursement (returned: ${returnedAmount.toFixed(2)} + deductions: ${deductionTotal.toFixed(2)} = ${(returnedAmount + deductionTotal).toFixed(2)}) exceeds deposit amount (${existing.amount.toFixed(2)}).`,
            compliance: {
              depositAmount: existing.amount,
              returnedAmount,
              deductionTotal,
              totalDisbursement: returnedAmount + deductionTotal,
              maxAllowed: existing.amount,
              rule: 'returnedAmount + deductionTotal must not exceed deposit amount',
            },
          },
          { status: 422 }
        );
      }

      data.deductionTotal = deductionTotal;
      data.returnedAmount = returnedAmount;

      // Auto-update status based on return
      if (returnedAmount > 0 && returnedAmount < existing.amount - deductionTotal) {
        data.status = 'partially_returned';
      } else if (returnedAmount > 0 || deductionTotal > 0) {
        if (returnedAmount + deductionTotal >= existing.amount) {
          data.status = 'fully_returned';
        }
      }

      // Set return timestamps
      if (returnedAmount > 0) {
        data.returnedAt = new Date();
        data.returnMethod = body.returnMethod || existing.returnMethod;
        data.returnRef = body.returnRef || existing.returnRef;
      }
    }

    // Handle deduction details and receipts
    if (body.deductionDetails !== undefined) {
      data.deductionDetails =
        typeof body.deductionDetails === 'string'
          ? body.deductionDetails
          : JSON.stringify(body.deductionDetails);
    }
    if (body.deductionReceipts !== undefined) {
      data.deductionReceipts =
        typeof body.deductionReceipts === 'string'
          ? body.deductionReceipts
          : JSON.stringify(body.deductionReceipts);
    }

    // Handle return method and reference
    if (body.returnMethod !== undefined) data.returnMethod = body.returnMethod;
    if (body.returnRef !== undefined) data.returnRef = body.returnRef;

    // Handle returnDeadline update
    if (body.returnDeadline !== undefined) {
      data.returnDeadline = body.returnDeadline
        ? new Date(body.returnDeadline)
        : null;
    }

    // Handle notes
    if (body.notes !== undefined) data.notes = body.notes;

    // Check if past return deadline
    const returnDeadline = data.returnDeadline || existing.returnDeadline;
    if (returnDeadline) {
      data.pastReturnDeadline = new Date() > returnDeadline && existing.status === 'held';
    }

    const deposit = await db.securityDeposit.update({
      where: { id },
      data,
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true,
        unit: true,
        tenant: true,
      },
    });

    return NextResponse.json(deposit);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── DELETE: Delete deposit ───
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await db.securityDeposit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
