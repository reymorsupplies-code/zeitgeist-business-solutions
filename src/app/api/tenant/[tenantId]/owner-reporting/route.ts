import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: Owner/investor reporting data scoped to tenant ───
// Returns summary stats, propertyPerformance, and recentDisbursements
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const results: any = {
      summary: {
        totalProperties: 0,
        totalUnits: 0,
        occupiedUnits: 0,
        vacancyRate: 0,
        occupancyRate: 0,
        grossMonthlyRent: 0,
        rentCollected: 0,
        outstanding: 0,
        totalExpenses: 0,
        netOperatingIncome: 0,
      },
      propertyPerformance: [],
      recentDisbursements: [],
    };

    // 1. Property & Unit summary — scoped to tenant's properties
    try {
      const properties = await db.property.findMany({
        where: { tenantId },
        include: {
          propertyUnits: {
            include: {
              leases: { where: { status: 'active' } },
              rentPayments: true,
            },
          },
          maintenanceRequests: true,
        },
      });

      properties.forEach((prop: any) => {
        const units = prop.propertyUnits || [];
        const occupied = units.filter((u: any) => u.status === 'occupied').length;
        const total = units.length;
        const activeLeases = units.flatMap((u: any) => u.leases || []);
        const monthlyRent = activeLeases.reduce((s: number, l: any) => s + Number(l.rentAmount || 0), 0);

        const allPayments = units.flatMap((u: any) => u.rentPayments || []);
        const collected = allPayments
          .filter((p: any) => p.status === 'paid' && new Date(p.paidAt) >= monthStart)
          .reduce((s: number, p: any) => s + Number(p.amountPaid || 0), 0);
        const outstanding = allPayments
          .filter((p: any) => p.status !== 'paid')
          .reduce((s: number, p: any) => s + (Number(p.amountDue || 0) - Number(p.amountPaid || 0)), 0);
        const maintCost = (prop.maintenanceRequests || [])
          .filter((m: any) => m.cost > 0)
          .reduce((s: number, m: any) => s + Number(m.cost || 0), 0);

        results.propertyPerformance.push({
          id: prop.id,
          name: prop.name,
          address: prop.address,
          city: prop.city,
          type: prop.type,
          status: prop.status,
          totalUnits: total,
          occupied,
          vacancy: total - occupied,
          vacancyRate: total > 0 ? Math.round(((total - occupied) / total) * 100) : 0,
          monthlyRent,
          collected,
          outstanding,
          maintenanceCost: maintCost,
          netOperatingIncome: collected - maintCost,
        });

        results.summary.totalProperties++;
        results.summary.totalUnits += total;
        results.summary.occupiedUnits += occupied;
        results.summary.grossMonthlyRent += monthlyRent;
        results.summary.rentCollected += collected;
        results.summary.outstanding += outstanding;
        results.summary.totalExpenses += maintCost;
      });
    } catch {
      // Fallback to raw SQL
      const propRows = await pgQuery<any>(
        `SELECT p.id, p.name, p.address, p.city, p.type, p.status,
           COUNT(pu.id) AS "totalUnits",
           COUNT(CASE WHEN pu.status = 'occupied' THEN 1 END) AS "occupied",
           COALESCE(SUM(CASE WHEN l.status = 'active' THEN l."rentAmount" ELSE 0 END), 0) AS "monthlyRent"
         FROM "Property" p
         LEFT JOIN "PropertyUnit" pu ON pu."propertyId" = p.id
         LEFT JOIN "Lease" l ON l."unitId" = pu.id AND l.status = 'active'
         WHERE p."tenantId" = $1
         GROUP BY p.id, p.name, p.address, p.city, p.type, p.status`,
        [tenantId]
      );

      for (const r of propRows) {
        const total = Number(r.totalUnits) || 0;
        const occ = Number(r.occupied) || 0;
        const rent = Number(r.monthlyRent) || 0;

        results.propertyPerformance.push({
          id: r.id,
          name: r.name,
          address: r.address,
          city: r.city,
          type: r.type,
          status: r.status,
          totalUnits: total,
          occupied: occ,
          vacancy: total - occ,
          vacancyRate: total > 0 ? Math.round(((total - occ) / total) * 100) : 0,
          monthlyRent: rent,
          collected: 0,
          outstanding: 0,
          maintenanceCost: 0,
          netOperatingIncome: 0,
        });

        results.summary.totalProperties++;
        results.summary.totalUnits += total;
        results.summary.occupiedUnits += occ;
        results.summary.grossMonthlyRent += rent;
      }

      // Try to get rent payment data separately
      try {
        const paymentRows = await pgQuery<any>(
          `SELECT COALESCE(SUM(CASE WHEN rp.status = 'paid' AND rp."paidAt" >= $2 THEN rp."amountPaid" ELSE 0 END), 0) AS "collected",
                  COALESCE(SUM(CASE WHEN rp.status != 'paid' THEN (rp."amountDue" - COALESCE(rp."amountPaid", 0)) ELSE 0 END), 0) AS "outstanding"
           FROM "RentPayment" rp
           JOIN "PropertyUnit" pu ON pu.id = rp."unitId"
           JOIN "Property" p ON p.id = pu."propertyId"
           WHERE p."tenantId" = $1`,
          [tenantId, monthStart.toISOString()]
        );
        if (paymentRows.length > 0) {
          results.summary.rentCollected = Number(paymentRows[0].collected) || 0;
          results.summary.outstanding = Number(paymentRows[0].outstanding) || 0;
        }
      } catch { /* payment data unavailable */ }
    }

    results.summary.vacancyRate = results.summary.totalUnits > 0
      ? Math.round(((results.summary.totalUnits - results.summary.occupiedUnits) / results.summary.totalUnits) * 100)
      : 0;
    results.summary.occupancyRate = 100 - results.summary.vacancyRate;
    results.summary.netOperatingIncome = results.summary.rentCollected - results.summary.totalExpenses;

    // 2. Recent disbursements — scoped to tenant
    try {
      results.recentDisbursements = await db.ownerDisbursement.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    } catch {
      try {
        results.recentDisbursements = await pgQuery<any>(
          `SELECT * FROM "OwnerDisbursement" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
          [tenantId]
        );
      } catch {
        results.recentDisbursements = [];
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create owner disbursement ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const data = await req.json();

    if (!data.periodStart || !data.periodEnd) {
      return NextResponse.json({ error: 'periodStart and periodEnd are required' }, { status: 400 });
    }

    // Verify propertyId belongs to this tenant if provided
    if (data.propertyId) {
      try {
        const prop = await db.property.findFirst({
          where: { id: data.propertyId, tenantId },
        });
        if (!prop) {
          return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 });
        }
      } catch {
        const prop = await pgQueryOne(
          `SELECT id FROM "Property" WHERE id = $1 AND "tenantId" = $2`,
          [data.propertyId, tenantId]
        );
        if (!prop) {
          return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 });
        }
      }
    }

    const grossIncome = Number(data.grossIncome) || 0;
    const totalExpenses = Number(data.totalExpenses) || 0;
    const netIncome = grossIncome - totalExpenses;
    const ownerShare = Number(data.ownerShare) || 100;
    const disbursementAmount = netIncome * (ownerShare / 100);

    try {
      const disbursement = await db.ownerDisbursement.create({
        data: {
          tenantId,
          propertyId: data.propertyId || null,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          grossIncome,
          totalExpenses,
          netIncome,
          ownerShare,
          disbursementAmount,
          currency: data.currency || 'TTD',
          status: data.status || 'pending',
          notes: data.notes || null,
        },
      });
      return NextResponse.json(disbursement, { status: 201 });
    } catch {
      const result = await pgQuery<any>(
        `INSERT INTO "OwnerDisbursement" (
          "tenantId", "propertyId", "periodStart", "periodEnd",
          "grossIncome", "totalExpenses", "netIncome",
          "ownerShare", "disbursementAmount", "currency", "status", "notes",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) RETURNING *`,
        [
          tenantId,
          data.propertyId || null,
          new Date(data.periodStart).toISOString(),
          new Date(data.periodEnd).toISOString(),
          grossIncome,
          totalExpenses,
          netIncome,
          ownerShare,
          disbursementAmount,
          data.currency || 'TTD',
          data.status || 'pending',
          data.notes || null,
        ]
      );
      return NextResponse.json(result[0], { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PATCH: Update disbursement status ───
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const { id, status, ...fields } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    // Verify disbursement belongs to this tenant
    try {
      const existing = await db.ownerDisbursement.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Disbursement not found or access denied' }, { status: 404 });
      }

      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };
      if (status === 'paid') {
        updateData.paidAt = new Date();
      }
      // Allow updating other fields if provided
      const optionalFields = ['grossIncome', 'totalExpenses', 'netIncome', 'ownerShare', 'disbursementAmount', 'currency', 'notes'];
      for (const f of optionalFields) {
        if (fields[f] !== undefined) {
          updateData[f] = f === 'notes' ? fields[f] : Number(fields[f]);
        }
      }

      const updated = await db.ownerDisbursement.update({
        where: { id },
        data: updateData,
      });
      return NextResponse.json(updated);
    } catch {
      const existing = await pgQueryOne(
        `SELECT id FROM "OwnerDisbursement" WHERE id = $1 AND "tenantId" = $2`,
        [id, tenantId]
      );
      if (!existing) {
        return NextResponse.json({ error: 'Disbursement not found or access denied' }, { status: 404 });
      }

      if (status === 'paid') {
        await pgQuery(
          `UPDATE "OwnerDisbursement" SET status = $1, "paidAt" = NOW(), "updatedAt" = NOW() WHERE id = $2`,
          [status, id]
        );
      } else {
        await pgQuery(
          `UPDATE "OwnerDisbursement" SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
          [status, id]
        );
      }

      const updated = await pgQueryOne(
        `SELECT * FROM "OwnerDisbursement" WHERE id = $1`,
        [id]
      );
      return NextResponse.json(updated);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
