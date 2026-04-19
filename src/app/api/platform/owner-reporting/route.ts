import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

// GET: Owner / Investor reporting data
export async function GET() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const results: any = {
      summary: { totalProperties: 0, totalUnits: 0, occupiedUnits: 0, vacancyRate: 0, grossMonthlyRent: 0, totalCollected: 0, totalOutstanding: 0, occupancyRate: 0 },
      propertyPerformance: [],
      recentDisbursements: [],
      monthlyTrend: [],
    };

    // 1. Property & Unit summary
    try {
      const properties = await db.property.findMany({
        include: {
          propertyUnits: { include: { leases: { where: { status: 'active' } }, rentPayments: true } },
          maintenanceRequests: true,
        },
      });

      properties.forEach((prop: any) => {
        const units = prop.propertyUnits || [];
        const occupied = units.filter((u: any) => u.status === 'occupied').length;
        const total = units.length;
        const activeLeases = units.flatMap((u: any) => u.leases || []);
        const monthlyRent = activeLeases.reduce((s: number, l: any) => s + (l.rentAmount || 0), 0);
        const allPayments = units.flatMap((u: any) => u.rentPayments || []);
        const collected = allPayments.filter((p: any) => p.status === 'paid' && new Date(p.paidAt) >= monthStart).reduce((s: number, p: any) => s + (p.amountPaid || 0), 0);
        const outstanding = allPayments.filter((p: any) => p.status !== 'paid').reduce((s: number, p: any) => s + ((p.amountDue || 0) - (p.amountPaid || 0)), 0);
        const maintCost = (prop.maintenanceRequests || []).filter((m: any) => m.cost > 0).reduce((s: number, m: any) => s + m.cost, 0);

        results.propertyPerformance.push({
          id: prop.id, name: prop.name, address: prop.address, city: prop.city,
          totalUnits: total, occupied, vacancy: total - occupied,
          vacancyRate: total > 0 ? Math.round(((total - occupied) / total) * 100) : 0,
          monthlyRent, collected, outstanding, maintenanceCost: maintCost,
          netOperatingIncome: collected - (maintCost || 0),
        });

        results.summary.totalProperties++;
        results.summary.totalUnits += total;
        results.summary.occupiedUnits += occupied;
        results.summary.grossMonthlyRent += monthlyRent;
        results.summary.totalCollected += collected;
        results.summary.totalOutstanding += outstanding;
      });
    } catch {
      const propRows = await pgQuery<any>(
        `SELECT p.id, p.name, p.address, p.city,
           COUNT(pu.id) AS "totalUnits",
           COUNT(CASE WHEN pu.status = 'occupied' THEN 1 END) AS "occupied",
           COALESCE(SUM(CASE WHEN l.status = 'active' THEN l."rentAmount" ELSE 0 END), 0) AS "monthlyRent"
         FROM "Property" p
         LEFT JOIN "PropertyUnit" pu ON pu."propertyId" = p.id
         LEFT JOIN "Lease" l ON l."unitId" = pu.id AND l.status = 'active'
         GROUP BY p.id, p.name, p.address, p.city`
      );
      propRows.forEach((r: any) => {
        results.propertyPerformance.push(r);
        results.summary.totalProperties++;
        results.summary.totalUnits += Number(r.totalUnits) || 0;
        results.summary.occupiedUnits += Number(r.occupied) || 0;
        results.summary.grossMonthlyRent += Number(r.monthlyRent) || 0;
      });
    }

    results.summary.vacancyRate = results.summary.totalUnits > 0
      ? Math.round(((results.summary.totalUnits - results.summary.occupiedUnits) / results.summary.totalUnits) * 100)
      : 0;
    results.summary.occupancyRate = 100 - results.summary.vacancyRate;

    // 2. Recent disbursements
    try {
      results.recentDisbursements = await db.ownerDisbursement.findMany({
        orderBy: { createdAt: 'desc' }, take: 20,
      });
    } catch {
      try {
        results.recentDisbursements = await pgQuery<any>(`SELECT * FROM "OwnerDisbursement" ORDER BY "createdAt" DESC LIMIT 20`);
      } catch { results.recentDisbursements = []; }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a disbursement
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const netIncome = (data.grossIncome || 0) - (data.totalExpenses || 0);
    const disbursementAmount = netIncome * ((data.ownerShare || 100) / 100);

    try {
      const disbursement = await db.ownerDisbursement.create({
        data: {
          propertyId: data.propertyId || null,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          grossIncome: data.grossIncome || 0,
          totalExpenses: data.totalExpenses || 0,
          netIncome,
          ownerShare: data.ownerShare || 100,
          disbursementAmount,
          currency: data.currency || 'TTD',
          status: data.status || 'pending',
          notes: data.notes || null,
        },
      });
      return NextResponse.json(disbursement);
    } catch {
      await pgQuery(
        `INSERT INTO "OwnerDisbursement" ("propertyId","periodStart","periodEnd","grossIncome","totalExpenses","netIncome","ownerShare","disbursementAmount","currency","status","notes","createdAt","updatedAt")
         VALUES (${data.propertyId?`'${data.propertyId}'`:'NULL'},'${new Date(data.periodStart).toISOString()}','${new Date(data.periodEnd).toISOString()}',${data.grossIncome||0},${data.totalExpenses||0},${netIncome},${data.ownerShare||100},${disbursementAmount},'${data.currency||'TTD'}','${data.status||'pending'}',${data.notes?`'${data.notes.replace(/'/g,"''")}'`:'NULL'},NOW(),NOW())`
      );
      return NextResponse.json({ success: true, disbursementAmount });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update disbursement status
export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

    try {
      await db.ownerDisbursement.update({
        where: { id },
        data: { status, ...(status === 'paid' && { paidAt: new Date() }), updatedAt: new Date() },
      });
    } catch {
      const paidAt = status === 'paid' ? `"paidAt"=NOW(),` : '';
      await pgQuery(`UPDATE "OwnerDisbursement" SET status='${status}',${paidAt}"updatedAt"=NOW() WHERE id='${id}'`);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
