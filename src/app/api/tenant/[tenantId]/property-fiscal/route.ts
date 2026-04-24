/**
 * Property Fiscal Report API
 *
 * GET — Generate property-specific fiscal reports for a given quarter/year
 *
 * Returns:
 *   - Income Statement (rent collected, late fees, other income by property/unit)
 *   - Expense Report (maintenance costs, vendor payments, insurance, taxes by category)
 *   - Net Operating Income (Income - Expenses per property)
 *   - Occupancy Rate (average % per property)
 *   - Collection Rate (% of rent actually collected vs due)
 *   - Profit & Loss Summary (by property and overall)
 *
 * All amounts in T&T context (TTD default, USD where applicable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

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

// ═══════════════════════════════════════════════════════════════
// GET — Property Fiscal Report
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const url = new URL(req.url);
  const quarterParam = url.searchParams.get('quarter');
  const yearParam = url.searchParams.get('year');
  const propertyId = url.searchParams.get('propertyId') || null;

  const { year: defaultYear, quarter: defaultQuarter } = getCurrentQuarter();
  const year = yearParam ? parseInt(yearParam) : defaultYear;
  const quarter = quarterParam ? parseInt(quarterParam) : defaultQuarter;

  if (quarter < 1 || quarter > 4 || isNaN(year)) {
    return NextResponse.json({ error: 'Invalid quarter (1-4) or year' }, { status: 400 });
  }

  const { start: periodStart, end: periodEnd } = getQuarterRange(year, quarter);
  const label = `Q${quarter} ${year}`;

  try {
    // ─── Fetch tenant settings for currency ───
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, currency: true, country: true, settings: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const settings = parseJsonSafe(tenant.settings);
    const currency = tenant.currency || 'TTD';

    // ─── Fetch properties (scoped to tenant) ───
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
    const unitIds = properties.flatMap(p => p.propertyUnits.map(u => u.id));

    // ─── INCOME DATA ───

    // Rent payments for the quarter
    const rentPayments = await db.rentPayment.findMany({
      where: {
        tenantId,
        propertyId: { in: propertyIds },
        periodStart: { gte: periodStart, lte: periodEnd },
        isDeleted: false,
      },
    });

    // ─── EXPENSE DATA ───

    // Maintenance requests completed in quarter
    const maintenanceRequests = await db.maintenanceRequest.findMany({
      where: {
        tenantId,
        propertyId: { in: propertyIds },
        status: { in: ['resolved', 'closed'] },
        resolvedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // Owner disbursements in quarter
    const disbursements = await db.ownerDisbursement.findMany({
      where: {
        tenantId,
        propertyId: { in: propertyIds },
        periodStart: { gte: periodStart, lte: periodEnd },
      },
    });

    // General expenses for the tenant in the quarter (property-related)
    const expenses = await db.expense.findMany({
      where: {
        tenantId,
        isDeleted: false,
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    // ─── Build per-property reports ───
    const propertyReports: any[] = [];

    for (const property of properties) {
      const propUnits = property.propertyUnits;
      const propUnitIds = propUnits.map(u => u.id);

      // Rent income
      const propRentPayments = rentPayments.filter(rp => rp.propertyId === property.id);
      const totalRentCollected = round2(propRentPayments.reduce((s, rp) => s + Number(rp.amountPaid || 0), 0));
      const totalRentDue = round2(propRentPayments.reduce((s, rp) => s + Number(rp.amountDue || 0), 0));
      const totalLateFees = round2(propRentPayments.reduce((s, rp) => s + Number(rp.lateFee || 0), 0));
      const otherIncome = round2(0); // placeholder for future income categories

      const totalIncome = round2(totalRentCollected + totalLateFees + otherIncome);

      // Unit-level breakdown
      const unitIncome: any[] = [];
      for (const unit of propUnits) {
        const unitPayments = propRentPayments.filter(rp => rp.unitId === unit.id);
        const unitCollected = round2(unitPayments.reduce((s, rp) => s + Number(rp.amountPaid || 0), 0));
        const unitDue = round2(unitPayments.reduce((s, rp) => s + Number(rp.amountDue || 0), 0));
        const unitLateFees = round2(unitPayments.reduce((s, rp) => s + Number(rp.lateFee || 0), 0));
        if (unitDue > 0 || unitCollected > 0) {
          unitIncome.push({
            unitId: unit.id,
            unitNumber: unit.unitNumber,
            status: unit.status,
            rentDue: unitDue,
            rentCollected: unitCollected,
            lateFees: unitLateFees,
            currency: unit.baseRentUSD > 0 ? 'USD' : 'TTD',
          });
        }
      }

      // Expense breakdown
      const propMaintenance = maintenanceRequests.filter(mr => mr.propertyId === property.id);
      const maintenanceCost = round2(propMaintenance.reduce((s, mr) => s + Number(mr.cost || 0), 0));

      // Property-specific expenses from general expenses (by vendor/category matching)
      const propExpenses = expenses.filter(e => {
        const desc = (e.description || '').toLowerCase() + ' ' + (e.vendor || '').toLowerCase();
        return desc.includes(property.name.toLowerCase());
      });
      const propertyTaxExpense = round2(propExpenses.filter(e => (e.category || '').toLowerCase().includes('tax')).reduce((s, e) => s + Number(e.amount || 0), 0));
      const insuranceExpense = round2(propExpenses.filter(e => (e.category || '').toLowerCase().includes('insurance')).reduce((s, e) => s + Number(e.amount || 0), 0));
      const vendorPayments = round2(propExpenses.filter(e => !['tax', 'insurance'].includes((e.category || '').toLowerCase())).reduce((s, e) => s + Number(e.amount || 0), 0));

      // Other property-specific disbursements
      const propDisbursements = disbursements.filter(d => d.propertyId === property.id);
      const managementFees = round2(propDisbursements.reduce((s, d) => s + (Number(d.grossIncome || 0) - Number(d.disbursementAmount || 0)), 0));

      const totalExpenses = round2(maintenanceCost + propertyTaxExpense + insuranceExpense + vendorPayments + managementFees);

      // Net Operating Income
      const noi = round2(totalIncome - totalExpenses);

      // Occupancy rate
      const totalUnits = propUnits.length || 1;
      const occupiedUnits = propUnits.filter(u => u.status === 'occupied').length;
      const occupancyRate = round2((occupiedUnits / totalUnits) * 100);

      // Collection rate
      const collectionRate = totalRentDue > 0 ? round2((totalRentCollected / totalRentDue) * 100) : 100;

      propertyReports.push({
        propertyId: property.id,
        propertyName: property.name,
        propertyType: property.type,
        address: property.address,
        city: property.city,
        totalUnits,
        occupiedUnits,
        income: {
          rentCollected: totalRentCollected,
          lateFees: totalLateFees,
          otherIncome,
          total: totalIncome,
          currency,
          byUnit: unitIncome,
        },
        expenses: {
          maintenanceCost,
          propertyTax: propertyTaxExpense,
          insurance: insuranceExpense,
          vendorPayments,
          managementFees,
          total: totalExpenses,
          currency,
          maintenanceBreakdown: propMaintenance.map(mr => ({
            id: mr.id,
            title: mr.title,
            category: mr.category,
            cost: Number(mr.cost || 0),
            resolvedAt: mr.resolvedAt,
            vendor: mr.vendor,
          })),
        },
        netOperatingIncome: noi,
        occupancyRate,
        collectionRate,
      });
    }

    // ─── OVERALL SUMMARY ───
    const totalRentCollected = round2(propertyReports.reduce((s, p) => s + p.income.rentCollected, 0));
    const totalLateFees = round2(propertyReports.reduce((s, p) => s + p.income.lateFees, 0));
    const totalOtherIncome = round2(propertyReports.reduce((s, p) => s + p.income.otherIncome, 0));
    const totalIncome = round2(totalRentCollected + totalLateFees + totalOtherIncome);
    const totalExpenses = round2(propertyReports.reduce((s, p) => s + p.expenses.total, 0));
    const totalNOI = round2(totalIncome - totalExpenses);
    const avgOccupancy = round2(propertyReports.reduce((s, p) => s + p.occupancyRate, 0) / Math.max(propertyReports.length, 1));
    const avgCollectionRate = round2(propertyReports.reduce((s, p) => s + p.collectionRate, 0) / Math.max(propertyReports.length, 1));

    return NextResponse.json({
      reportMeta: {
        tenantId,
        tenantName: tenant.name,
        currency,
        country: tenant.country || 'TT',
        period: label,
        year,
        quarter,
        periodStart,
        periodEnd,
        generatedAt: new Date().toISOString(),
      },
      incomeStatement: {
        totalRentCollected,
        totalLateFees,
        totalOtherIncome,
        totalIncome,
        currency,
      },
      expenseReport: {
        totalMaintenance: round2(propertyReports.reduce((s, p) => s + p.expenses.maintenanceCost, 0)),
        totalPropertyTax: round2(propertyReports.reduce((s, p) => s + p.expenses.propertyTax, 0)),
        totalInsurance: round2(propertyReports.reduce((s, p) => s + p.expenses.insurance, 0)),
        totalVendorPayments: round2(propertyReports.reduce((s, p) => s + p.expenses.vendorPayments, 0)),
        totalManagementFees: round2(propertyReports.reduce((s, p) => s + p.expenses.managementFees, 0)),
        totalExpenses,
        currency,
      },
      netOperatingIncome: totalNOI,
      occupancyRate: avgOccupancy,
      collectionRate: avgCollectionRate,
      profitAndLoss: {
        grossRevenue: totalIncome,
        totalDeductions: totalExpenses,
        netIncome: totalNOI,
        profitMargin: totalIncome > 0 ? round2((totalNOI / totalIncome) * 100) : 0,
        currency,
      },
      byProperty: propertyReports,
    });
  } catch (error: any) {
    console.error('[property-fiscal] GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
