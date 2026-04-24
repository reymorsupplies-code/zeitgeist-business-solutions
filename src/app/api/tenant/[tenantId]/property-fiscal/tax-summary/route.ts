/**
 * Quarterly Tax Summary API — T&T Board of Inland Revenue (BIR) Compliance
 *
 * GET — Generate quarterly tax summary for BIR filing
 *
 * T&T Tax Rules for Property Rental Income:
 *   - Gross Rental Income: All rental income before deductions
 *   - Allowable Deductions: maintenance, insurance, property tax, mortgage interest,
 *     depreciation (building allowance), repairs, agent fees
 *   - Net Rental Income: Gross - Allowable Deductions
 *   - Income Tax: Based on T&T progressive brackets
 *   - VAT on Rental: Commercial properties subject to 12.5% VAT if registered
 *   - Green Fund Levy: 0.3% of gross income
 *   - Health Surcharge: TT$4.25/week or TT$221/year
 *   - Business Levy: 0.6% of gross revenue (if > TT$360,000/year)
 *
 * Filing Deadlines:
 *   Q1 (Jan-Mar)  → April 30
 *   Q2 (Apr-Jun)  → July 31
 *   Q3 (Jul-Sep)  → October 31
 *   Q4 (Oct-Dec)  → January 31
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

// ─── Constants ───

const VAT_RATE = 0.125;
const GREEN_FUND_LEVY_RATE = 0.003; // 0.3%
const BUSINESS_LEVY_RATE = 0.006; // 0.6%
const BUSINESS_LEVY_THRESHOLD = 360_000; // TT$ per year
const HEALTH_SURCHARGE_ANNUAL = 221; // TT$ per year (simplified)

/**
 * T&T Income Tax Brackets (2024/2025)
 * These are the progressive rates for individual/corporate income
 */
const TT_INCOME_TAX_BRACKETS = [
  { min: 0, max: 84_000, rate: 0 },
  { min: 84_000, max: 120_000, rate: 0.25 },
  { min: 120_000, max: 200_000, rate: 0.30 },
  { min: 200_000, max: 600_000, rate: 0.35 },
  { min: 600_000, max: Infinity, rate: 0.40 },
];

/**
 * Corporate tax rate in T&T for most companies is 25% (simplified).
 * For small companies it can be lower. We use a blended approach.
 */
const CORPORATE_TAX_RATE = 0.25;
const SMALL_COMPANY_THRESHOLD = 500_000;

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
 * Get BIR filing deadline for a quarter.
 * T&T BIR quarterly filing deadlines:
 *   Q1 → April 30
 *   Q2 → July 31
 *   Q3 → October 31
 *   Q4 → January 31 (next year)
 */
function getBIRFilingDeadline(year: number, quarter: number): Date {
  const deadlines: Record<number, { month: number; day: number }> = {
    1: { month: 3, day: 30 },   // April 30
    2: { month: 6, day: 31 },   // July 31
    3: { month: 9, day: 31 },   // October 31
    4: { month: 0, day: 31 },   // January 31
  };
  const d = deadlines[quarter];
  const deadlineDate = new Date(year + (quarter === 4 ? 1 : 0), d.month, d.day);
  return deadlineDate;
}

/**
 * Calculate estimated income tax based on T&T progressive brackets.
 * Returns tax liability for the quarter.
 */
function calculateIncomeTax(annualNetIncome: number): number {
  let tax = 0;
  let remaining = annualNetIncome;

  for (const bracket of TT_INCOME_TAX_BRACKETS) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, bracket.max - bracket.min);
    tax += taxable * bracket.rate;
    remaining -= taxable;
  }

  // For corporate entities, use flat rate if higher
  const corporateTax = annualNetIncome * CORPORATE_TAX_RATE;

  // Return the more common rate (quarterly)
  return round2(Math.min(tax, corporateTax) / 4);
}

/**
 * Calculate depreciation allowance (building allowance).
 * T&T typically allows 10% of building cost per year as depreciation.
 * Since we don't track building cost, we estimate 5% of gross rental income.
 */
function estimateDepreciation(grossIncome: number): number {
  return round2(grossIncome * 0.05);
}

/**
 * Generate compliance checklist for the quarter.
 */
function getComplianceChecklist(year: number, quarter: number, grossIncome: number): any[] {
  const checklist: any[] = [];
  const now = new Date();
  const deadline = getBIRFilingDeadline(year, quarter);
  const isOverdue = now > deadline;

  // Income tax filing
  checklist.push({
    item: 'File Income Tax Return (Quarterly)',
    deadline: deadline.toISOString().split('T')[0],
    status: isOverdue ? 'overdue' : 'pending',
    category: 'income_tax',
  });

  // VAT filing (if registered)
  checklist.push({
    item: 'File VAT Return (if VAT registered)',
    deadline: deadline.toISOString().split('T')[0],
    status: isOverdue ? 'overdue' : 'pending',
    category: 'vat',
  });

  // Green Fund Levy
  checklist.push({
    item: 'Pay Green Fund Levy (0.3% of gross income)',
    deadline: deadline.toISOString().split('T')[0],
    status: isOverdue ? 'overdue' : 'pending',
    category: 'green_fund',
  });

  // Health Surcharge
  checklist.push({
    item: 'Pay Health Surcharge',
    deadline: deadline.toISOString().split('T')[0],
    status: isOverdue ? 'overdue' : 'pending',
    category: 'health_surcharge',
  });

  // Business Levy (if applicable)
  if (grossIncome * 4 > BUSINESS_LEVY_THRESHOLD) {
    checklist.push({
      item: 'Pay Business Levy (0.6% of gross revenue)',
      deadline: deadline.toISOString().split('T')[0],
      status: isOverdue ? 'overdue' : 'pending',
      category: 'business_levy',
    });
  }

  // Property Tax (annual, but remind in Q1)
  if (quarter === 1) {
    checklist.push({
      item: 'File Annual Property Tax Return',
      deadline: `${year}-06-30`,
      status: now > new Date(year, 5, 30) ? 'overdue' : 'pending',
      category: 'property_tax',
    });
  }

  // Record keeping
  checklist.push({
    item: 'Maintain records of all rental income and expenses',
    deadline: null,
    status: 'ongoing',
    category: 'records',
  });

  return checklist;
}

// ═══════════════════════════════════════════════════════════════
// GET — Quarterly Tax Summary
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

  const { year: defaultYear, quarter: defaultQuarter } = getCurrentQuarter();
  const year = yearParam ? parseInt(yearParam) : defaultYear;
  const quarter = quarterParam ? parseInt(quarterParam) : defaultQuarter;

  if (quarter < 1 || quarter > 4 || isNaN(year)) {
    return NextResponse.json({ error: 'Invalid quarter (1-4) or year' }, { status: 400 });
  }

  const { start: periodStart, end: periodEnd } = getQuarterRange(year, quarter);
  const label = `Q${quarter} ${year}`;

  try {
    // ─── Fetch tenant ───
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, currency: true, country: true, settings: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const settings = parseJsonSafe(tenant.settings);
    const isVatRegistered = settings.isVatRegistered || false;

    // ─── Fetch all properties ───
    const properties = await db.property.findMany({
      where: { tenantId },
      include: { propertyUnits: true },
    });

    const propertyIds = properties.map(p => p.id);

    // ─── RENTAL INCOME ───
    const rentPayments = await db.rentPayment.findMany({
      where: {
        tenantId,
        propertyId: { in: propertyIds },
        periodStart: { gte: periodStart, lte: periodEnd },
        isDeleted: false,
      },
    });

    const grossRentalIncome = round2(rentPayments.reduce((s, rp) => s + Number(rp.amountPaid || 0) + Number(rp.lateFee || 0), 0));
    const totalLateFees = round2(rentPayments.reduce((s, rp) => s + Number(rp.lateFee || 0), 0));
    const baseRentalIncome = round2(grossRentalIncome - totalLateFees);

    // ─── ALLOWABLE DEDUCTIONS ───

    // Maintenance costs
    const maintenanceRequests = await db.maintenanceRequest.findMany({
      where: {
        tenantId,
        propertyId: { in: propertyIds },
        status: { in: ['resolved', 'closed'] },
        resolvedAt: { gte: periodStart, lte: periodEnd },
      },
    });
    const maintenanceCost = round2(maintenanceRequests.reduce((s, mr) => s + Number(mr.cost || 0), 0));

    // Insurance from expenses
    const expenses = await db.expense.findMany({
      where: {
        tenantId,
        isDeleted: false,
        date: { gte: periodStart, lte: periodEnd },
      },
    });
    const insuranceCost = round2(expenses.filter(e => (e.category || '').toLowerCase().includes('insurance')).reduce((s, e) => s + Number(e.amount || 0), 0));
    const propertyTaxPaid = round2(expenses.filter(e => (e.category || '').toLowerCase().includes('tax')).reduce((s, e) => s + Number(e.amount || 0), 0));
    const mortgageInterest = round2(expenses.filter(e => (e.category || '').toLowerCase().includes('mortgage') || (e.category || '').toLowerCase().includes('interest')).reduce((s, e) => s + Number(e.amount || 0), 0));
    const repairsCost = round2(expenses.filter(e => (e.category || '').toLowerCase().includes('repair')).reduce((s, e) => s + Number(e.amount || 0), 0));
    const agentFees = round2(expenses.filter(e => (e.category || '').toLowerCase().includes('agent') || (e.category || '').toLowerCase().includes('commission')).reduce((s, e) => s + Number(e.amount || 0), 0));

    // Depreciation (estimated)
    const depreciation = estimateDepreciation(grossRentalIncome);

    const totalAllowableDeductions = round2(
      maintenanceCost + insuranceCost + propertyTaxPaid + mortgageInterest + depreciation + repairsCost + agentFees
    );

    // ─── NET RENTAL INCOME ───
    const netRentalIncome = round2(grossRentalIncome - totalAllowableDeductions);
    const annualizedNetIncome = round2(netRentalIncome * 4);

    // ─── TAX CALCULATIONS ───

    // Income tax (quarterly estimate based on annualized)
    const estimatedIncomeTax = calculateIncomeTax(annualizedNetIncome);

    // VAT on rental (only for commercial if registered)
    const vatOnRental = isVatRegistered ? round2(baseRentalIncome * VAT_RATE) : 0;

    // Green Fund Levy (0.3% of gross income)
    const greenFundLevy = round2(grossRentalIncome * GREEN_FUND_LEVY_RATE);

    // Health Surcharge (quarterly: annual / 4)
    const healthSurchargeQuarterly = round2(HEALTH_SURCHARGE_ANNUAL / 4);

    // Business Levy (0.6% if annualized gross > 360k)
    const annualizedGross = round2(grossRentalIncome * 4);
    const businessLevy = annualizedGross > BUSINESS_LEVY_THRESHOLD ? round2(grossRentalIncome * BUSINESS_LEVY_RATE) : 0;

    // Total estimated tax liability
    const totalTaxLiability = round2(estimatedIncomeTax + vatOnRental + greenFundLevy + healthSurchargeQuarterly + businessLevy);

    // Filing deadline
    const filingDeadline = getBIRFilingDeadline(year, quarter);
    const isOverdue = new Date() > filingDeadline;

    // Compliance checklist
    const complianceChecklist = getComplianceChecklist(year, quarter, grossRentalIncome);

    return NextResponse.json({
      reportMeta: {
        tenantId,
        tenantName: tenant.name,
        currency: tenant.currency || 'TTD',
        country: tenant.country || 'TT',
        period: label,
        year,
        quarter,
        periodStart,
        periodEnd,
        generatedAt: new Date().toISOString(),
        birNumber: settings.birNumber || null,
        tin: settings.tin || null,
        vatRegistrationNumber: settings.vatRegistrationNumber || null,
        isVatRegistered,
      },

      // ─── Income ───
      income: {
        grossRentalIncome,
        lateFees: totalLateFees,
        baseRentalIncome,
        annualizedGross,
        propertyCount: properties.length,
        totalUnits: properties.reduce((s, p) => s + p.propertyUnits.length, 0),
        occupancyRate: properties.length > 0
          ? round2((properties.reduce((s, p) => s + p.propertyUnits.filter(u => u.status === 'occupied').length, 0)) /
            Math.max(properties.reduce((s, p) => s + p.propertyUnits.length, 0), 1) * 100)
          : 0,
      },

      // ─── Allowable Deductions ───
      deductions: {
        maintenanceCost,
        insuranceCost,
        propertyTaxPaid,
        mortgageInterest,
        depreciation,
        repairsCost,
        agentFees,
        totalAllowableDeductions,
      },

      // ─── Net Income ───
      netIncome: {
        netRentalIncome,
        annualizedNetIncome,
      },

      // ─── Tax Summary ───
      taxes: {
        estimatedIncomeTax,
        incomeTaxMethod: 'progressive',
        effectiveTaxRate: annualizedNetIncome > 0 ? round2((estimatedIncomeTax * 4 / annualizedNetIncome) * 100) : 0,
        vatOnRental,
        vatRate: VAT_RATE,
        greenFundLevy,
        greenFundLevyRate: GREEN_FUND_LEVY_RATE,
        healthSurcharge: healthSurchargeQuarterly,
        businessLevy,
        businessLevyRate: BUSINESS_LEVY_RATE,
        businessLevyApplicable: annualizedGross > BUSINESS_LEVY_THRESHOLD,
        totalTaxLiability,
      },

      // ─── Filing ───
      filing: {
        deadline: filingDeadline.toISOString().split('T')[0],
        isOverdue,
        daysUntilDue: Math.max(0, Math.ceil((filingDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      },

      complianceChecklist,
    });
  } catch (error: any) {
    console.error('[tax-summary] GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
