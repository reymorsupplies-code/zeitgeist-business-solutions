import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';
import { authenticateRequest } from '@/lib/auth';

// GET: Get leases needing renewal attention + renewal logs
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const now = new Date();
    const results: any = { renewalsNeeded: [], renewalLogs: [], autoRenewals: [], stats: { totalActive: 0, renewing: 0, expiredThisMonth: 0 } };

    try {
      const allLeases = await db.lease.findMany({
        where: { status: 'active' },
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
          // Already expired
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
    } catch {
      const rows = await pgQuery<any>(
        `SELECT l.*, pu."unitNumber", p.name AS "propertyName", t.name AS "tenantName"
         FROM "Lease" l
         LEFT JOIN "PropertyUnit" pu ON pu.id = l."unitId"
         LEFT JOIN "Property" p ON p.id = pu."propertyId"
         LEFT JOIN "Tenant" t ON t.id = l."tenantId"
         WHERE l.status = 'active'
         ORDER BY l."endDate" ASC`
      );
      results.stats.totalActive = rows.length;
      rows.forEach((row: any) => {
        const end = new Date(row.endDate);
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
        if (daysLeft <= (row.renewalNoticeDays || 30) && daysLeft > 0) {
          results.renewalsNeeded.push({ ...row, daysLeft, proposedNewRent: row.rentAmount * (1 + (row.rentIncreasePercent || 0) / 100) });
          results.stats.renewing++;
        }
      });
    }

    try {
      results.renewalLogs = await db.leaseRenewalLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    } catch {
      try {
        results.renewalLogs = await pgQuery<any>(`SELECT * FROM "LeaseRenewalLog" ORDER BY "createdAt" DESC LIMIT 50`);
      } catch { results.renewalLogs = []; }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Renew a lease
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { leaseId, newStartDate, newEndDate, newRent, notes, renewedBy } = await req.json();
    if (!leaseId || !newEndDate) return NextResponse.json({ error: 'leaseId and newEndDate required' }, { status: 400 });

    let currentLease: any;
    try {
      currentLease = await db.lease.findUnique({ where: { id: leaseId } });
    } catch {
      const rows = await pgQuery<any>(`SELECT * FROM "Lease" WHERE id = $1`, [leaseId]);
      currentLease = rows[0] || null;
    }
    if (!currentLease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

    const oldRent = currentLease.rentAmount;
    const effectiveNewRent = newRent || oldRent;
    const increasePct = oldRent > 0 ? ((effectiveNewRent - oldRent) / oldRent) * 100 : 0;
    const start = newStartDate || currentLease.endDate;

    try {
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
    } catch {
      await pgQuery(
        `UPDATE "Lease" SET "startDate"=$1,"endDate"=$2,"rentAmount"=$3,"lastRenewedAt"=NOW(),"renewalCount"=$4,"originalStartDate"=$5,"originalEndDate"=$6,status='active',"updatedAt"=NOW() WHERE id=$7`,
        [new Date(start).toISOString(), new Date(newEndDate).toISOString(), effectiveNewRent, (currentLease.renewalCount || 0) + 1, (currentLease.originalStartDate || currentLease.startDate).toISOString(), (currentLease.originalEndDate || currentLease.endDate).toISOString(), leaseId]
      );
    }

    try {
      await db.leaseRenewalLog.create({
        data: { leaseId, previousEnd: currentLease.endDate, newStart: new Date(start), newEnd: new Date(newEndDate), oldRent, newRent: effectiveNewRent, increasePct: Math.round(increasePct * 100) / 100, renewedBy: renewedBy || null, notes: notes || null },
      });
    } catch {
      await pgQuery(
        `INSERT INTO "LeaseRenewalLog" ("leaseId","previousEnd","newStart","newEnd","oldRent","newRent","increasePct","renewedBy","notes","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [leaseId, currentLease.endDate instanceof Date ? currentLease.endDate.toISOString() : String(currentLease.endDate), new Date(start).toISOString(), new Date(newEndDate).toISOString(), oldRent, effectiveNewRent, Math.round(increasePct * 100) / 100, renewedBy || null, notes || null]
      );
    }

    return NextResponse.json({ success: true, newRent: effectiveNewRent, increasePct: Math.round(increasePct * 100) / 100 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
