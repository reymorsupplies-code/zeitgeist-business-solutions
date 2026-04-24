/**
 * Auto-Generate Quarterly Report API
 *
 * POST — Automatically generate fiscal reports for the current or specified quarter.
 *         Creates bookkeeping entries from property financial data.
 *         Generates the complete fiscal report.
 *
 * Process:
 *   1. Gathers rent payments, maintenance costs, and other expenses for the quarter
 *   2. Creates summary bookkeeping entries (rental income, maintenance expenses, etc.)
 *   3. Returns the complete fiscal report with all metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, checkRateLimit } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── Helpers ───

function parseJsonSafe(raw: any): any {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Ensure PropertyFiscalReport table exists for storing generated reports.
 */
async function ensureFiscalReportTable(): Promise<void> {
  try {
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "PropertyFiscalReport" (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"  TEXT NOT NULL,
        year        INTEGER NOT NULL,
        quarter     INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
        label       TEXT NOT NULL,
        "periodStart"  TIMESTAMPTZ NOT NULL,
        "periodEnd"    TIMESTAMPTZ NOT NULL,
        "totalIncome"  NUMERIC(14,2) NOT NULL DEFAULT 0,
        "totalExpenses" NUMERIC(14,2) NOT NULL DEFAULT 0,
        "netIncome"      NUMERIC(14,2) NOT NULL DEFAULT 0,
        "occupancyRate"  NUMERIC(5,2) NOT NULL DEFAULT 0,
        "collectionRate" NUMERIC(5,2) NOT NULL DEFAULT 0,
        status      TEXT NOT NULL DEFAULT 'draft',
        "propertyId"    TEXT,
        data        TEXT DEFAULT '{}',
        "isDeleted"  BOOLEAN NOT NULL DEFAULT false,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PropertyFiscalReport_tenant_year_quarter_prop_key" UNIQUE ("tenantId", year, quarter, "propertyId")
      );
    `);
    await pgQuery(`
      CREATE INDEX IF NOT EXISTS "idx_PropertyFiscalReport_tenantId" ON "PropertyFiscalReport"("tenantId");
    `);
  } catch (err: any) {
    console.error('[auto-generate] Error creating PropertyFiscalReport table:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// POST — Auto-Generate Quarterly Fiscal Report
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(
    `fiscal-auto-gen:${req.headers.get('x-forwarded-for') || 'unknown'}`,
    5,
    60_000
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let data: any;
  try { data = await req.json(); } catch { data = {}; }

  const { year: defaultYear, quarter: defaultQuarter } = getCurrentQuarter();
  const year = data.year || defaultYear;
  const quarter = data.quarter || defaultQuarter;
  const propertyId = data.propertyId || null;

  if (quarter < 1 || quarter > 4 || isNaN(year)) {
    return NextResponse.json({ error: 'Invalid quarter (1-4) or year' }, { status: 400 });
  }

  const { start: periodStart, end: periodEnd } = getQuarterRange(year, quarter);
  const label = `Q${quarter} ${year}`;

  try {
    await ensureFiscalReportTable();

    // ─── Fetch tenant ───
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, currency: true, settings: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const currency = tenant.currency || 'TTD';

    // ─── Fetch properties ───
    const propertyFilter: any = { tenantId };
    if (propertyId) propertyFilter.id = propertyId;

    const properties = await db.property.findMany({
      where: propertyFilter,
      include: { propertyUnits: true },
    });

    if (properties.length === 0) {
      return NextResponse.json({ error: 'No properties found' }, { status: 404 });
    }

    const propertyIds = properties.map(p => p.id);

    // ─── Check for existing report ───
    const existingReport = await pgQueryOne<any>(
      `SELECT id, status FROM "PropertyFiscalReport"
       WHERE "tenantId" = $1 AND year = $2 AND quarter = $3
       AND ("propertyId" = $4 OR ("propertyId" IS NULL AND $4 IS NULL))
       AND "isDeleted" = false`,
      [tenantId, year, quarter, propertyId]
    );

    if (existingReport && !data.forceRegenerate) {
      return NextResponse.json(
        { error: `Report for ${label} already exists (status: ${existingReport.status}). Use forceRegenerate: true to overwrite.`, reportId: existingReport.id },
        { status: 409 }
      );
    }

    // ─── STEP 1: Gather financial data ───

    // Rent payments
    const rentPayments = await db.rentPayment.findMany({
      where: {
        tenantId,
        propertyId: { in: propertyIds },
        periodStart: { gte: periodStart, lte: periodEnd },
        isDeleted: false,
      },
    });

    // Maintenance requests
    const maintenanceRequests = await db.maintenanceRequest.findMany({
      where: {
        tenantId,
        propertyId: { in: propertyIds },
        status: { in: ['resolved', 'closed'] },
        resolvedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // General expenses
    const expenses = await db.expense.findMany({
      where: {
        tenantId,
        isDeleted: false,
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    // Owner disbursements
    const disbursements = await db.ownerDisbursement.findMany({
      where: {
        tenantId,
        propertyId: { in: propertyIds },
        periodStart: { gte: periodStart, lte: periodEnd },
      },
    });

    // ─── STEP 2: Calculate totals per property ───

    const bookkeepingEntriesCreated: string[] = [];
    const propertyReports: any[] = [];

    for (const property of properties) {
      const propUnits = property.propertyUnits;

      const propRentPayments = rentPayments.filter(rp => rp.propertyId === property.id);
      const totalRentCollected = round2(propRentPayments.reduce((s, rp) => s + Number(rp.amountPaid || 0), 0));
      const totalRentDue = round2(propRentPayments.reduce((s, rp) => s + Number(rp.amountDue || 0), 0));
      const totalLateFees = round2(propRentPayments.reduce((s, rp) => s + Number(rp.lateFee || 0), 0));

      const propMaintenance = maintenanceRequests.filter(mr => mr.propertyId === property.id);
      const maintenanceCost = round2(propMaintenance.reduce((s, mr) => s + Number(mr.cost || 0), 0));

      const propExpenses = expenses.filter(e => {
        const desc = (e.description || '').toLowerCase() + ' ' + (e.vendor || '').toLowerCase();
        return desc.includes(property.name.toLowerCase());
      });
      const propertyTax = round2(propExpenses.filter(e => (e.category || '').toLowerCase().includes('tax')).reduce((s, e) => s + Number(e.amount || 0), 0));
      const insurance = round2(propExpenses.filter(e => (e.category || '').toLowerCase().includes('insurance')).reduce((s, e) => s + Number(e.amount || 0), 0));
      const otherExpenses = round2(propExpenses.filter(e => !['tax', 'insurance'].includes((e.category || '').toLowerCase())).reduce((s, e) => s + Number(e.amount || 0), 0));

      const propDisbursements = disbursements.filter(d => d.propertyId === property.id);
      const managementFees = round2(propDisbursements.reduce((s, d) => s + (Number(d.grossIncome || 0) - Number(d.disbursementAmount || 0)), 0));

      const totalIncome = round2(totalRentCollected + totalLateFees);
      const totalExpenses = round2(maintenanceCost + propertyTax + insurance + otherExpenses + managementFees);
      const noi = round2(totalIncome - totalExpenses);

      const totalUnits = propUnits.length || 1;
      const occupiedUnits = propUnits.filter(u => u.status === 'occupied').length;
      const occupancyRate = round2((occupiedUnits / totalUnits) * 100);
      const collectionRate = totalRentDue > 0 ? round2((totalRentCollected / totalRentDue) * 100) : 100;

      // ─── STEP 3: Create bookkeeping entries ───
      const quarterEndDate = new Date(periodEnd);

      // Rental income entry
      if (totalRentCollected > 0) {
        const entry = await db.bookkeepingEntry.create({
          data: {
            tenantId,
            date: quarterEndDate,
            description: `Q${quarter} ${year} Rental Income — ${property.name}`,
            category: 'Rental Income',
            type: 'credit',
            amount: totalRentCollected,
            currency,
            reference: `auto-fiscal-Q${quarter}-${year}-${property.id}`,
            accountId: '4100',
          },
        });
        bookkeepingEntriesCreated.push(entry.id);
      }

      // Late fees entry
      if (totalLateFees > 0) {
        const entry = await db.bookkeepingEntry.create({
          data: {
            tenantId,
            date: quarterEndDate,
            description: `Q${quarter} ${year} Late Fees — ${property.name}`,
            category: 'Late Fees',
            type: 'credit',
            amount: totalLateFees,
            currency,
            reference: `auto-fiscal-Q${quarter}-${year}-late-${property.id}`,
            accountId: '4200',
          },
        });
        bookkeepingEntriesCreated.push(entry.id);
      }

      // Maintenance expense entry
      if (maintenanceCost > 0) {
        const entry = await db.bookkeepingEntry.create({
          data: {
            tenantId,
            date: quarterEndDate,
            description: `Q${quarter} ${year} Maintenance Costs — ${property.name}`,
            category: 'Maintenance',
            type: 'debit',
            amount: maintenanceCost,
            currency,
            reference: `auto-fiscal-Q${quarter}-${year}-maint-${property.id}`,
            accountId: '5100',
          },
        });
        bookkeepingEntriesCreated.push(entry.id);
      }

      // Property tax expense entry
      if (propertyTax > 0) {
        const entry = await db.bookkeepingEntry.create({
          data: {
            tenantId,
            date: quarterEndDate,
            description: `Q${quarter} ${year} Property Tax — ${property.name}`,
            category: 'Property Tax',
            type: 'debit',
            amount: propertyTax,
            currency,
            reference: `auto-fiscal-Q${quarter}-${year}-tax-${property.id}`,
            accountId: '5200',
          },
        });
        bookkeepingEntriesCreated.push(entry.id);
      }

      // Insurance expense entry
      if (insurance > 0) {
        const entry = await db.bookkeepingEntry.create({
          data: {
            tenantId,
            date: quarterEndDate,
            description: `Q${quarter} ${year} Insurance — ${property.name}`,
            category: 'Insurance',
            type: 'debit',
            amount: insurance,
            currency,
            reference: `auto-fiscal-Q${quarter}-${year}-ins-${property.id}`,
            accountId: '5300',
          },
        });
        bookkeepingEntriesCreated.push(entry.id);
      }

      // Management fees expense entry
      if (managementFees > 0) {
        const entry = await db.bookkeepingEntry.create({
          data: {
            tenantId,
            date: quarterEndDate,
            description: `Q${quarter} ${year} Management Fees — ${property.name}`,
            category: 'Management Fees',
            type: 'debit',
            amount: managementFees,
            currency,
            reference: `auto-fiscal-Q${quarter}-${year}-mgmt-${property.id}`,
            accountId: '5400',
          },
        });
        bookkeepingEntriesCreated.push(entry.id);
      }

      // NOI entry (net result)
      if (noi !== 0) {
        const entry = await db.bookkeepingEntry.create({
          data: {
            tenantId,
            date: quarterEndDate,
            description: `Q${quarter} ${year} Net Operating Income — ${property.name}`,
            category: 'Net Operating Income',
            type: noi > 0 ? 'credit' : 'debit',
            amount: Math.abs(noi),
            currency,
            reference: `auto-fiscal-Q${quarter}-${year}-noi-${property.id}`,
            accountId: '3100',
          },
        });
        bookkeepingEntriesCreated.push(entry.id);
      }

      propertyReports.push({
        propertyId: property.id,
        propertyName: property.name,
        income: { rentCollected: totalRentCollected, lateFees: totalLateFees, total: totalIncome },
        expenses: { maintenance: maintenanceCost, propertyTax, insurance, otherExpenses, managementFees, total: totalExpenses },
        netOperatingIncome: noi,
        occupancyRate,
        collectionRate,
        units: { total: totalUnits, occupied: occupiedUnits },
      });
    }

    // ─── Overall totals ───
    const totalIncome = round2(propertyReports.reduce((s, p) => s + p.income.total, 0));
    const totalExpenses = round2(propertyReports.reduce((s, p) => s + p.expenses.total, 0));
    const totalNOI = round2(totalIncome - totalExpenses);
    const avgOccupancy = round2(propertyReports.reduce((s, p) => s + p.occupancyRate, 0) / Math.max(propertyReports.length, 1));
    const avgCollectionRate = round2(propertyReports.reduce((s, p) => s + p.collectionRate, 0) / Math.max(propertyReports.length, 1));

    // ─── STEP 4: Store fiscal report record ───
    const reportData = JSON.stringify({
      byProperty: propertyReports,
      bookkeepingEntriesCreated: bookkeepingEntriesCreated.length,
      currency,
    });

    if (existingReport && data.forceRegenerate) {
      await pgQuery(
        `UPDATE "PropertyFiscalReport" SET
          "totalIncome" = $1, "totalExpenses" = $2, "netIncome" = $3,
          "occupancyRate" = $4, "collectionRate" = $5,
          status = 'generated', data = $6, "updatedAt" = NOW()
        WHERE id = $7`,
        [totalIncome, totalExpenses, totalNOI, avgOccupancy, avgCollectionRate, reportData, existingReport.id]
      );
    } else {
      await pgQuery(
        `INSERT INTO "PropertyFiscalReport" (
          "tenantId", year, quarter, label, "periodStart", "periodEnd",
          "totalIncome", "totalExpenses", "netIncome",
          "occupancyRate", "collectionRate", status, "propertyId", data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'generated',$12,$13)`,
        [
          tenantId, year, quarter, label,
          periodStart.toISOString(), periodEnd.toISOString(),
          totalIncome, totalExpenses, totalNOI,
          avgOccupancy, avgCollectionRate,
          propertyId, reportData,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Fiscal report for ${label} generated successfully`,
      reportMeta: {
        tenantId,
        tenantName: tenant.name,
        currency,
        period: label,
        year,
        quarter,
        periodStart,
        periodEnd,
        generatedAt: new Date().toISOString(),
        propertyId,
      },
      incomeStatement: {
        totalIncome,
        totalExpenses,
        netOperatingIncome: totalNOI,
        profitMargin: totalIncome > 0 ? round2((totalNOI / totalIncome) * 100) : 0,
        currency,
      },
      occupancyRate: avgOccupancy,
      collectionRate: avgCollectionRate,
      bookkeepingEntriesCreated: bookkeepingEntriesCreated.length,
      bookkeepingEntryIds: bookkeepingEntriesCreated,
      byProperty: propertyReports,
    });
  } catch (error: any) {
    console.error('[auto-generate] POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
