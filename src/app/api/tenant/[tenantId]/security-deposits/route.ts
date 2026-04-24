import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── T&T Compliance Constants ───
const TANDT_DEPOSIT_RETURN_DAYS = 14;

// ─── GET: List deposits for this tenant with filters + return deadline monitoring ───
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(_req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(_req.url);
    const leaseId = searchParams.get('leaseId');
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const includeOverdue = searchParams.get('includeOverdue');

    const where: any = { tenantId };
    if (leaseId) where.leaseId = leaseId;
    if (propertyId) where.propertyId = propertyId;
    if (status && status !== 'all') where.status = status;

    let deposits: any[] = [];
    try {
      deposits = await db.securityDeposit.findMany({
        where,
        include: {
          lease: { include: { unit: { include: { property: true } }, tenant: true } },
          property: true,
          unit: true,
          tenant: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // pgQuery fallback - scoped to tenantId via property chain
      const conditions: string[] = [`sd."tenantId" = $1`];
      const params: any[] = [tenantId];
      let pIdx = 2;
      if (leaseId) { conditions.push(`sd."leaseId" = $${pIdx++}`); params.push(leaseId); }
      if (propertyId) { conditions.push(`sd."propertyId" = $${pIdx++}`); params.push(propertyId); }
      if (status && status !== 'all') { conditions.push(`sd.status = $${pIdx++}`); params.push(status); }

      deposits = await pgQuery<any>(
        `SELECT sd.* FROM "SecurityDeposit" sd WHERE ${conditions.join(' AND ')} ORDER BY sd."createdAt" DESC`,
        params
      );
    }

    // Compute pastReturnDeadline flag
    const now = new Date();
    const enriched = deposits.map((dep) => {
      const returnDeadline = dep.returnDeadline ? new Date(dep.returnDeadline) : null;
      const pastDeadline = dep.status === 'held' && returnDeadline && now > returnDeadline;
      return {
        ...dep,
        pastReturnDeadline: pastDeadline,
        daysUntilDeadline: returnDeadline ? Math.max(0, Math.ceil((returnDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null,
      };
    });

    const result = includeOverdue === 'true' ? enriched.filter((d) => d.pastReturnDeadline) : enriched;
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── POST: Create deposit with T&T compliance validation ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();
    const { leaseId, propertyId, unitId, amount, currency, vacateDate } = body;

    if (!leaseId || !propertyId || !unitId) {
      return NextResponse.json({ error: 'leaseId, propertyId, and unitId are required' }, { status: 400 });
    }

    // Verify ownership: lease -> unit -> property -> tenantId
    try {
      const lease = await db.lease.findUnique({
        where: { id: leaseId },
        include: { unit: { include: { property: true } } },
      });
      if (!lease || lease.unit?.property?.tenantId !== tenantId) {
        return NextResponse.json({ error: 'Lease not found or not owned by this tenant' }, { status: 404 });
      }

      // T&T Compliance: deposit must not exceed 1 month's rent
      const monthlyRent = lease.rentAmount;
      const depositAmount = Number(amount) || 0;

      if (depositAmount > monthlyRent.toNumber() && monthlyRent.toNumber() > 0) {
        return NextResponse.json(
          {
            error: `T&T compliance violation: Security deposit (${currency || 'TTD'} ${depositAmount.toFixed(2)}) exceeds one month's rent (${lease.rentCurrency || 'TTD'} ${monthlyRent.toNumber().toFixed(2)}).`,
            compliance: { maxAllowed: monthlyRent.toNumber(), requested: depositAmount },
          },
          { status: 422 }
        );
      }

      // Auto-calculate returnDeadline = vacate_date + 14 days
      let returnDeadline: Date | null = null;
      if (vacateDate) {
        returnDeadline = new Date(vacateDate);
        returnDeadline.setDate(returnDeadline.getDate() + TANDT_DEPOSIT_RETURN_DAYS);
      } else if (lease.endDate) {
        returnDeadline = new Date(lease.endDate);
        returnDeadline.setDate(returnDeadline.getDate() + TANDT_DEPOSIT_RETURN_DAYS);
      }

      const deposit = await db.securityDeposit.create({
        data: {
          leaseId, propertyId, unitId, tenantId,
          amount: depositAmount,
          currency: currency || 'TTD',
          status: 'held',
          receivedDate: new Date(),
          returnDeadline: returnDeadline || new Date(),
          returnedAmount: 0,
          deductionTotal: 0,
          deductions: '[]',
          notes: body.notes || null,
        },
        include: {
          lease: { include: { unit: { include: { property: true } }, tenant: true } },
          property: true, unit: true, tenant: true,
        },
      });

      return NextResponse.json(deposit, { status: 201 });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('not owned')) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── PATCH: Process deposit return with deduction validation ───
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.securityDeposit.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    const body = await req.json();
    const data: any = {};

    if (body.status !== undefined) data.status = body.status;

    if (body.deductionTotal !== undefined) {
      const deductionTotal = Number(body.deductionTotal) || 0;
      const returnedAmount = Number(body.returnedAmount) || 0;

      if (returnedAmount + deductionTotal > existing.amount.toNumber()) {
        return NextResponse.json(
          {
            error: `Total disbursement (${(returnedAmount + deductionTotal).toFixed(2)}) exceeds deposit amount (${existing.amount.toNumber().toFixed(2)}).`,
          },
          { status: 422 }
        );
      }

      data.deductionTotal = deductionTotal;
      data.returnedAmount = returnedAmount;

      if (returnedAmount > 0 && returnedAmount < existing.amount.toNumber() - deductionTotal) {
        data.status = 'partially_returned';
      } else if (returnedAmount + deductionTotal >= existing.amount.toNumber()) {
        data.status = 'fully_returned';
      }

      if (returnedAmount > 0) {
        data.returnedAt = new Date();
        data.refundMethod = body.refundMethod || existing.refundMethod;
        data.refundReference = body.refundReference || existing.refundReference;
      }
    }

    if (body.returnDeadline !== undefined) {
      data.returnDeadline = body.returnDeadline ? new Date(body.returnDeadline) : null;
    }
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.deductions !== undefined) data.deductions = typeof body.deductions === 'string' ? body.deductions : JSON.stringify(body.deductions);

    const deposit = await db.securityDeposit.update({
      where: { id },
      data,
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true, unit: true, tenant: true,
      },
    });

    return NextResponse.json(deposit);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── DELETE: Delete deposit ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.securityDeposit.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    await db.securityDeposit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
