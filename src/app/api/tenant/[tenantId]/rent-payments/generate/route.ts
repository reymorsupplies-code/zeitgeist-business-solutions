import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

// ─── POST: Generate rent payments for all active leases for this tenant ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();
    const { year, month, lateFeePercent, lateFeeGraceDays } = body;

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month !== undefined ? month : new Date().getMonth();
    const latePercent = lateFeePercent !== undefined ? lateFeePercent : 10;
    const graceDays = lateFeeGraceDays !== undefined ? lateFeeGraceDays : 5;

    const periodStart = new Date(targetYear, targetMonth, 1);
    const periodEnd = new Date(targetYear, targetMonth + 1, 0);
    const dueDate = new Date(targetYear, targetMonth, 5);

    // Get active leases scoped to this tenant via unit -> property
    const activeLeases = await db.lease.findMany({
      where: {
        status: 'active',
        unit: { property: { tenantId } },
      },
      include: { unit: { include: { property: true } }, tenant: true },
    });

    const results: any[] = [];

    for (const lease of activeLeases) {
      const existing = await db.rentPayment.findFirst({
        where: { leaseId: lease.id, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
      });

      if (existing) {
        results.push({ leaseId: lease.id, unit: lease.unit?.unitNumber, property: lease.unit?.property?.name, status: 'skipped', reason: 'Already generated' });
        continue;
      }

      const rentAmount = Number(lease.rentAmount) || 0;
      const calculatedLateFee = (rentAmount * latePercent) / 100;

      const payment = await db.rentPayment.create({
        data: {
          leaseId: lease.id,
          propertyId: lease.unit?.propertyId || '',
          unitId: lease.unitId,
          tenantId: lease.tenantId || null,
          periodStart, periodEnd,
          amountDue: rentAmount,
          amountPaid: 0,
          lateFee: calculatedLateFee,
          currency: lease.rentCurrency || 'TTD',
          status: 'pending',
          dueDate,
          notes: `Auto-generated for ${periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Late fee: ${latePercent}% after ${graceDays} day grace period.`,
        },
      });

      results.push({ leaseId: lease.id, unit: lease.unit?.unitNumber, property: lease.unit?.property?.name, amount: rentAmount, status: 'created', paymentId: payment.id });
    }

    return NextResponse.json({
      generated: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      total: results.length,
      details: results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
