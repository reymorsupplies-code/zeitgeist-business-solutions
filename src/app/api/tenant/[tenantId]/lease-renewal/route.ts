import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

// ─── GET: Leases needing renewal for this tenant ───
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(_req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const now = new Date();
    const results: any = { renewalsNeeded: [], renewalLogs: [], stats: { totalActive: 0, renewing: 0, expiredThisMonth: 0 } };

    // Get active leases scoped to this tenant via unit -> property
    const allLeases = await db.lease.findMany({
      where: {
        status: 'active',
        unit: { property: { tenantId } },
      },
      include: { unit: { include: { property: true } }, tenant: true, rentPayments: true },
      orderBy: { endDate: 'asc' },
    });

    results.stats.totalActive = allLeases.length;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    allLeases.forEach((lease: any) => {
      const end = new Date(lease.endDate);
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);

      if (end < now) {
        if (end >= monthStart && end <= monthEnd) results.stats.expiredThisMonth++;
      } else if (daysLeft <= (lease.renewalNoticeDays || 30)) {
        const paidCount = lease.rentPayments?.filter((r: any) => r.status === 'paid').length || 0;
        const paidTotal = lease.rentPayments?.filter((r: any) => r.status === 'paid').reduce((s: number, r: any) => s + (r.amountPaid || 0), 0) || 0;
        results.renewalsNeeded.push({
          ...lease,
          daysLeft,
          paidCount,
          paidTotal,
          proposedNewRent: lease.rentAmount * (1 + (lease.rentIncreasePercent || 0) / 100),
          autoRenew: lease.autoRenew || false,
        });
        results.stats.renewing++;
      }
    });

    // Get renewal logs for this tenant's leases
    const leaseIds = allLeases.map((l: any) => l.id);
    if (leaseIds.length > 0) {
      results.renewalLogs = await db.leaseRenewalLog.findMany({
        where: { leaseId: { in: leaseIds } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Renew a lease (scoped to this tenant) ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { leaseId, newStartDate, newEndDate, newRent, notes, renewedBy } = await req.json();
    if (!leaseId || !newEndDate) return NextResponse.json({ error: 'leaseId and newEndDate required' }, { status: 400 });

    // Verify lease belongs to this tenant via unit -> property
    const currentLease = await db.lease.findUnique({
      where: { id: leaseId },
      include: { unit: { include: { property: true } } },
    });

    if (!currentLease || currentLease.unit?.property?.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    const oldRent = currentLease.rentAmount;
    const effectiveNewRent = newRent || oldRent;
    const increasePct = oldRent > 0 ? ((effectiveNewRent - oldRent) / oldRent) * 100 : 0;
    const start = newStartDate || currentLease.endDate;

    await db.lease.update({
      where: { id: leaseId },
      data: {
        startDate: new Date(start),
        endDate: new Date(newEndDate),
        rentAmount: effectiveNewRent,
        lastRenewedAt: new Date(),
        renewalCount: (currentLease.renewalCount || 0) + 1,
        originalStartDate: currentLease.originalStartDate || currentLease.startDate,
        originalEndDate: currentLease.originalEndDate || currentLease.endDate,
        status: 'active',
      },
    });

    await db.leaseRenewalLog.create({
      data: {
        leaseId,
        tenantId,
        previousEnd: currentLease.endDate,
        newStart: new Date(start),
        newEnd: new Date(newEndDate),
        oldRent,
        newRent: effectiveNewRent,
        increasePct: Math.round(increasePct * 100) / 100,
        renewedBy: renewedBy || null,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      newRent: effectiveNewRent,
      increasePct: Math.round(increasePct * 100) / 100,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
