/**
 * VAT Compliance API — Trinidad & Tobago BIR Requirements
 *
 * GET  — Assess tenant VAT compliance status (registration thresholds, filing status)
 * POST — Generate quarterly VAT return from POS sales data
 *
 * T&T VAT Rules:
 *   - Standard VAT rate: 12.5%
 *   - VAT registration threshold: TT$500,000/year gross revenue
 *   - Business Levy threshold: TT$360,000/year gross revenue
 *   - Filing periods: Quarterly (Q1–Q4)
 *   - Categories: standard (12.5%), exempt (0%), zero_rated (0%)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, checkRateLimit } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── Constants ───

const VAT_RATE = 0.125; // 12.5%
const VAT_REGISTRATION_THRESHOLD = 500_000; // TT$ per year
const BUSINESS_LEVY_THRESHOLD = 360_000; // TT$ per year

type ComplianceStatus = 'compliant' | 'needs_registration' | 'needs_filing' | 'overdue';

// ─── Helpers ───

function parseJsonSafe(raw: any): any {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

/** Get quarter date range for a given year and quarter (1-4) */
function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
  const endMonth = startMonth + 2; // 2, 5, 8, 11
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999); // last day of end month
  return { start, end };
}

/** Determine which quarter a date falls into */
function getQuarterForDate(date: Date): { year: number; quarter: number } {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3) + 1;
  return { year, quarter };
}

/** Get current quarter info */
function getCurrentQuarter(): { year: number; quarter: number } {
  return getQuarterForDate(new Date());
}

/** Get all quarters within a date range */
function getQuartersInRange(from: Date, to: Date): { year: number; quarter: number; label: string }[] {
  const quarters: { year: number; quarter: number; label: string }[] = [];
  let current = new Date(from.getFullYear(), Math.floor(from.getMonth() / 3) * 3, 1);

  while (current <= to) {
    const { year, quarter } = getQuarterForDate(current);
    const label = `Q${quarter} ${year}`;
    if (!quarters.some(q => q.year === year && q.quarter === quarter)) {
      quarters.push({ year, quarter, label });
    }
    current.setMonth(current.getMonth() + 3);
  }
  return quarters;
}

/**
 * Ensure the VATReturn table exists (idempotent).
 * Called lazily on first use.
 */
async function ensureVATReturnTable(): Promise<void> {
  try {
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "VATReturn" (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"  TEXT NOT NULL,
        year        INTEGER NOT NULL,
        quarter     INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
        label       TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'draft',
        "periodStart"  TIMESTAMPTZ NOT NULL,
        "periodEnd"    TIMESTAMPTZ NOT NULL,
        "totalSalesExVAT"  NUMERIC(14,2) NOT NULL DEFAULT 0,
        "totalVATCollected" NUMERIC(14,2) NOT NULL DEFAULT 0,
        "totalVATPaid"      NUMERIC(14,2) NOT NULL DEFAULT 0,
        "vatDue"            NUMERIC(14,2) NOT NULL DEFAULT 0,
        "vatRefund"         NUMERIC(14,2) NOT NULL DEFAULT 0,
        "standardSalesExVAT"   NUMERIC(14,2) NOT NULL DEFAULT 0,
        "standardVATCollected" NUMERIC(14,2) NOT NULL DEFAULT 0,
        "exemptSales"           NUMERIC(14,2) NOT NULL DEFAULT 0,
        "zeroRatedSales"        NUMERIC(14,2) NOT NULL DEFAULT 0,
        "saleCount"             INTEGER NOT NULL DEFAULT 0,
        "filedAt"         TIMESTAMPTZ,
        notes             TEXT,
        "isDeleted"       BOOLEAN NOT NULL DEFAULT false,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "VATReturn_tenant_year_quarter_key" UNIQUE ("tenantId", year, quarter)
      );
    `);
    await pgQuery(`
      CREATE INDEX IF NOT EXISTS "idx_VATReturn_tenantId" ON "VATReturn"("tenantId");
    `);
  } catch (err: any) {
    console.error('[vat-compliance] Error creating VATReturn table:', err.message);
  }
}

/**
 * Look up the VAT category for a product.
 * Checks the RetailProduct settings JSON for a vatCategory field.
 * Falls back to "standard" if not found.
 */
async function getProductVatCategory(productId: string, tenantId: string): Promise<string> {
  // Try pgQuery first — reads 'settings' column if it exists (added via migration)
  try {
    const row = await pgQueryOne<any>(
      `SELECT settings FROM "RetailProduct" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
      [productId, tenantId]
    );
    if (row) {
      const settings = parseJsonSafe(row.settings);
      if (settings.vatCategory && ['standard', 'exempt', 'zero_rated'].includes(settings.vatCategory)) {
        return settings.vatCategory;
      }
    }
  } catch { /* fallback below */ }

  return 'standard';
}

/**
 * Parse POS sale items and enrich each with its VAT category.
 */
async function enrichSaleItemsWithVat(
  sale: any,
  tenantId: string
): Promise<Array<{
  name: string;
  qty: number;
  unitPrice: number;
  lineSubtotal: number;
  vatCategory: string;
  vatRate: number;
  vatAmount: number;
  lineTotal: number;
}>> {
  const rawItems = parseJsonSafe(sale.items);
  if (!Array.isArray(rawItems)) return [];

  const enriched: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    lineSubtotal: number;
    vatCategory: string;
    vatRate: number;
    vatAmount: number;
    lineTotal: number;
  }> = [];
  for (const item of rawItems) {
    const qty = item.qty || 1;
    const unitPrice = Number(item.price) || 0;
    const lineSubtotal = qty * unitPrice;
    let vatCategory = 'standard';
    let vatRate = VAT_RATE;

    if (item.productId) {
      vatCategory = await getProductVatCategory(item.productId, tenantId);
    }
    // Override if explicitly set on the item itself
    if (item.vatCategory && ['standard', 'exempt', 'zero_rated'].includes(item.vatCategory)) {
      vatCategory = item.vatCategory;
    }

    if (vatCategory === 'standard') {
      vatRate = VAT_RATE;
    } else {
      vatRate = 0;
    }

    const vatAmount = Math.round(lineSubtotal * vatRate * 100) / 100;
    const lineTotal = lineSubtotal + vatAmount;

    enriched.push({
      name: item.name || 'Unknown Item',
      qty,
      unitPrice,
      lineSubtotal,
      vatCategory,
      vatRate,
      vatAmount,
      lineTotal,
    });
  }
  return enriched;
}

// ═══════════════════════════════════════════════════════════════
// GET — VAT Compliance Status Assessment
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    // ─── Fetch tenant settings ───
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, settings: true, taxRate: true, currency: true, country: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const settings = parseJsonSafe(tenant.settings);
    const birNumber = settings.birNumber || '';
    const tin = settings.tin || '';
    const vatRegistrationNumber = settings.vatRegistrationNumber || '';
    const isVatRegistered = settings.isVatRegistered || false;
    const vatEffectiveDate = settings.vatEffectiveDate || null;

    // ─── Calculate annual revenue from completed POS sales ───
    const now = new Date();
    const currentYear = now.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    const sales = await db.pOSSale.findMany({
      where: {
        tenantId,
        status: 'completed',
        isDeleted: false,
        createdAt: { gte: yearStart, lte: yearEnd },
      },
      select: { totalAmount: true },
    });

    const currentYearRevenue = sales.reduce(
      (sum, s) => sum + Number(s.totalAmount || 0),
      0
    );

    // Also calculate last year's revenue for rolling 12-month comparison
    const lastYearStart = new Date(currentYear - 1, 0, 1);
    const lastYearEnd = new Date(currentYear - 1, 11, 31, 23, 59, 59, 999);
    const lastYearSales = await db.pOSSale.findMany({
      where: {
        tenantId,
        status: 'completed',
        isDeleted: false,
        createdAt: { gte: lastYearStart, lte: lastYearEnd },
      },
      select: { totalAmount: true },
    });
    const lastYearRevenue = lastYearSales.reduce(
      (sum, s) => sum + Number(s.totalAmount || 0),
      0
    );

    // ─── Determine compliance status ───
    let status: ComplianceStatus = 'compliant';
    const alerts: string[] = [];
    const recommendations: string[] = [];

    // Check VAT registration requirement
    const exceedsVatThreshold = currentYearRevenue >= VAT_REGISTRATION_THRESHOLD;
    const exceededVatThresholdLastYear = lastYearRevenue >= VAT_REGISTRATION_THRESHOLD;

    if (exceedsVatThreshold && !isVatRegistered) {
      status = 'needs_registration';
      alerts.push(
        `Annual revenue (TT$${currentYearRevenue.toLocaleString()}) exceeds VAT registration threshold (TT$${VAT_REGISTRATION_THRESHOLD.toLocaleString()}). You must register for VAT within 30 days.`
      );
      recommendations.push('Apply for VAT registration with the Board of Inland Revenue (BIR).');
      recommendations.push('Obtain a VAT Registration Number after registration is approved.');
    }

    if (exceededVatThresholdLastYear && !isVatRegistered) {
      alerts.push(
        `Last year's revenue (TT$${lastYearRevenue.toLocaleString()}) also exceeded the VAT threshold. Urgent registration required.`
      );
    }

    // Check Business Levy requirement
    if (currentYearRevenue >= BUSINESS_LEVY_THRESHOLD) {
      recommendations.push(
        `Revenue exceeds Business Levy threshold (TT$${BUSINESS_LEVY_THRESHOLD.toLocaleString()}). Business Levy at 0.6% may apply.`
      );
    }

    // Check BIR registration details
    if (isVatRegistered) {
      if (!birNumber) {
        alerts.push('BIR number is not configured in tenant settings.');
        recommendations.push('Add your BIR number in Settings > Tax Configuration.');
      }
      if (!tin) {
        alerts.push('Tax Identification Number (TIN) is not configured in tenant settings.');
        recommendations.push('Add your TIN in Settings > Tax Configuration.');
      }
      if (!vatRegistrationNumber) {
        alerts.push('VAT Registration Number is not configured in tenant settings.');
        recommendations.push('Add your VAT Registration Number in Settings > Tax Configuration.');
      }

      if (birNumber && tin && vatRegistrationNumber) {
        // Check filing status — look for existing VAT returns
        await ensureVATReturnTable();
        const { year: curYear, quarter: curQuarter } = getCurrentQuarter();
        const prevQuarter = curQuarter === 1 ? 4 : curQuarter - 1;
        const prevYear = curQuarter === 1 ? curYear - 1 : curYear;

        const existingReturn = await pgQueryOne<any>(
          `SELECT * FROM "VATReturn" WHERE "tenantId" = $1 AND year = $2 AND quarter = $3 AND "isDeleted" = false`,
          [tenantId, prevYear, prevQuarter]
        );

        if (!existingReturn) {
          const filingDeadline = getFilingDeadline(prevYear, prevQuarter);
          if (now > filingDeadline) {
            status = 'overdue';
            alerts.push(
              `VAT return for ${prevYear} Q${prevQuarter} is overdue. Filing deadline was ${filingDeadline.toLocaleDateString('en-TT')}.`
            );
          } else {
            status = 'needs_filing';
            alerts.push(
              `VAT return for ${prevYear} Q${prevQuarter} is due by ${filingDeadline.toLocaleDateString('en-TT')}.`
            );
          }
        }
      }
    }

    // ─── Get existing VAT returns summary ───
    await ensureVATReturnTable();
    const existingReturns = await pgQuery<any>(
      `SELECT year, quarter, label, status, "totalSalesExVAT", "totalVATCollected", "vatDue", "vatRefund", "filedAt"
       FROM "VATReturn" WHERE "tenantId" = $1 AND "isDeleted" = false ORDER BY year DESC, quarter DESC LIMIT 8`,
      [tenantId]
    );

    // ─── Get quarterly breakdown for current year ───
    const quarterlyBreakdown = await getQuarterlyRevenueBreakdown(tenantId, currentYear);

    return NextResponse.json({
      tenant: {
        id: tenantId,
        name: tenant.name,
        currency: tenant.currency || 'TTD',
        country: tenant.country || 'TT',
      },
      taxConfiguration: {
        vatRate: tenant.taxRate || VAT_RATE,
        birNumber,
        tin,
        vatRegistrationNumber,
        isVatRegistered,
        vatEffectiveDate,
      },
      revenueAnalysis: {
        currentYear: currentYear,
        currentYearRevenue: Math.round(currentYearRevenue * 100) / 100,
        lastYearRevenue: Math.round(lastYearRevenue * 100) / 100,
        vatThreshold: VAT_REGISTRATION_THRESHOLD,
        businessLevyThreshold: BUSINESS_LEVY_THRESHOLD,
        exceedsVatThreshold,
        exceedsBusinessLevyThreshold: currentYearRevenue >= BUSINESS_LEVY_THRESHOLD,
        projectedAnnualRevenue: Math.round(
          (currentYearRevenue / Math.max(1, now.getMonth() + 1)) * 12 * 100
        ) / 100,
        quarterlyBreakdown,
      },
      compliance: {
        status,
        alerts,
        recommendations,
      },
      vatReturns: existingReturns,
    });
  } catch (error: any) {
    console.error('[vat-compliance] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Get the filing deadline for a quarter.
 * T&T BIR: VAT returns due 28th of the month following the quarter end.
 *   Q1 (Jan-Mar) → due April 28
 *   Q2 (Apr-Jun) → due July 28
 *   Q3 (Jul-Sep) → due October 28
 *   Q4 (Oct-Dec) → due January 28
 */
function getFilingDeadline(year: number, quarter: number): Date {
  const endMonths: Record<number, number> = { 1: 3, 2: 6, 3: 9, 4: 12 };
  const deadlineMonth = endMonths[quarter] || 12;
  // Deadline is the 28th of the month after the quarter ends
  const deadlineDate = new Date(year, deadlineMonth, 28);
  // If quarter is Q4, deadline is next year January 28
  if (quarter === 4) {
    deadlineDate.setFullYear(year + 1);
    deadlineDate.setMonth(0, 28); // January 28
  }
  return deadlineDate;
}

/**
 * Get quarterly revenue breakdown from POS sales for a given year.
 */
async function getQuarterlyRevenueBreakdown(
  tenantId: string,
  year: number
): Promise<Array<{
  quarter: number;
  label: string;
  totalSales: number;
  saleCount: number;
}>> {
  const breakdown: Array<{
    quarter: number;
    label: string;
    totalSales: number;
    saleCount: number;
  }> = [];
  for (let q = 1; q <= 4; q++) {
    const { start, end } = getQuarterRange(year, q);
    try {
      const sales = await db.pOSSale.findMany({
        where: {
          tenantId,
          status: 'completed',
          isDeleted: false,
          createdAt: { gte: start, lte: end },
        },
        select: { totalAmount: true },
      });
      const totalSales = sales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      breakdown.push({
        quarter: q,
        label: `Q${q} ${year}`,
        totalSales: Math.round(totalSales * 100) / 100,
        saleCount: sales.length,
      });
    } catch {
      breakdown.push({ quarter: q, label: `Q${q} ${year}`, totalSales: 0, saleCount: 0 });
    }
  }
  return breakdown;
}

// ═══════════════════════════════════════════════════════════════
// POST — Generate Quarterly VAT Return
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(
    `vat-compliance-post:${req.headers.get('x-forwarded-for') || 'unknown'}`,
    10,
    60_000
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let data: any;
  try { data = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const year = data.year || getCurrentQuarter().year;
  const quarter = data.quarter;
  if (!quarter || quarter < 1 || quarter > 4) {
    return NextResponse.json(
      { error: 'quarter is required and must be 1, 2, 3, or 4' },
      { status: 400 }
    );
  }

  const notes = data.notes || null;
  const status = data.status || 'draft'; // draft, submitted, approved, rejected

  try {
    await ensureVATReturnTable();

    // ─── Check for existing return ───
    const existing = await pgQueryOne<any>(
      `SELECT id, status FROM "VATReturn" WHERE "tenantId" = $1 AND year = $2 AND quarter = $3 AND "isDeleted" = false`,
      [tenantId, year, quarter]
    );
    if (existing && !data.forceRegenerate) {
      return NextResponse.json(
        { error: `VAT return for ${year} Q${quarter} already exists (status: ${existing.status}). Use forceRegenerate: true to overwrite.` },
        { status: 409 }
      );
    }

    // ─── Get quarter date range ───
    const { start: periodStart, end: periodEnd } = getQuarterRange(year, quarter);
    const label = `Q${quarter} ${year}`;

    // ─── Fetch all completed POS sales in the quarter ───
    const sales = await db.pOSSale.findMany({
      where: {
        tenantId,
        status: 'completed',
        isDeleted: false,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (sales.length === 0) {
      return NextResponse.json(
        { error: `No completed sales found for ${label}` },
        { status: 404 }
      );
    }

    // ─── Calculate VAT per sale ───
    let totalSalesExVAT = 0;
    let totalVATCollected = 0;
    let standardSalesExVAT = 0;
    let standardVATCollected = 0;
    let exemptSales = 0;
    let zeroRatedSales = 0;
    const saleDetails: any[] = [];

    for (const sale of sales) {
      const enrichedItems = await enrichSaleItemsWithVat(sale, tenantId);
      let saleExVAT = 0;
      let saleVAT = 0;

      for (const item of enrichedItems) {
        saleExVAT += item.lineSubtotal;
        saleVAT += item.vatAmount;

        switch (item.vatCategory) {
          case 'standard':
            standardSalesExVAT += item.lineSubtotal;
            standardVATCollected += item.vatAmount;
            break;
          case 'exempt':
            exemptSales += item.lineSubtotal;
            break;
          case 'zero_rated':
            zeroRatedSales += item.lineSubtotal;
            break;
        }
      }

      totalSalesExVAT += saleExVAT;
      totalVATCollected += saleVAT;

      saleDetails.push({
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        date: sale.createdAt,
        totalExVAT: Math.round(saleExVAT * 100) / 100,
        vatAmount: Math.round(saleVAT * 100) / 100,
        totalWithVAT: Math.round((saleExVAT + saleVAT) * 100) / 100,
        items: enrichedItems,
      });
    }

    // ─── Calculate input VAT from purchase orders ───
    // Purchase orders received in the same quarter with VAT
    const purchaseOrders = await db.purchaseOrder.findMany({
      where: {
        tenantId,
        status: { in: ['received', 'partial'] },
        isDeleted: false,
        receivedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { items: true, totalAmount: true },
    });

    let totalVATPaid = 0;
    for (const po of purchaseOrders) {
      const poItems = parseJsonSafe(po.items);
      if (Array.isArray(poItems)) {
        for (const item of poItems) {
          const unitCost = Number(item.unitCost) || 0;
          const receivedQty = Number(item.receivedQty) || 0;
          const lineCost = unitCost * receivedQty;
          // Assume standard rate on purchases (could be refined per supplier)
          totalVATPaid += Math.round(lineCost * VAT_RATE * 100) / 100;
        }
      }
    }

    // ─── Net VAT due or refund ───
    const netVAT = totalVATCollected - totalVATPaid;
    const vatDue = netVAT > 0 ? Math.round(netVAT * 100) / 100 : 0;
    const vatRefund = netVAT < 0 ? Math.round(Math.abs(netVAT) * 100) / 100 : 0;

    // ─── Store or update VAT return ───
    const vatReturnId = data.id || undefined;

    if (existing && data.forceRegenerate) {
      // Update existing
      await pgQuery(
        `UPDATE "VATReturn" SET
          status = $1, "totalSalesExVAT" = $2, "totalVATCollected" = $3, "totalVATPaid" = $4,
          "vatDue" = $5, "vatRefund" = $6, "standardSalesExVAT" = $7, "standardVATCollected" = $8,
          "exemptSales" = $9, "zeroRatedSales" = $10, "saleCount" = $11, notes = $12,
          "filedAt" = CASE WHEN $1 = 'submitted' THEN NOW() ELSE "filedAt" END,
          "updatedAt" = NOW()
        WHERE "tenantId" = $13 AND year = $14 AND quarter = $15`,
        [
          status,
          Math.round(totalSalesExVAT * 100) / 100,
          Math.round(totalVATCollected * 100) / 100,
          Math.round(totalVATPaid * 100) / 100,
          vatDue,
          vatRefund,
          Math.round(standardSalesExVAT * 100) / 100,
          Math.round(standardVATCollected * 100) / 100,
          Math.round(exemptSales * 100) / 100,
          Math.round(zeroRatedSales * 100) / 100,
          sales.length,
          notes,
          tenantId,
          year,
          quarter,
        ]
      );

      const updated = await pgQueryOne<any>(
        `SELECT * FROM "VATReturn" WHERE "tenantId" = $1 AND year = $2 AND quarter = $3`,
        [tenantId, year, quarter]
      );

      return NextResponse.json({
        ...updated,
        _breakdown: {
          saleDetails,
          filingDeadline: getFilingDeadline(year, quarter),
        },
      });
    }

    // Create new VAT return
    const now = new Date().toISOString();
    const newReturn = await pgQueryOne<any>(
      `INSERT INTO "VATReturn" (
        "tenantId", year, quarter, label, status,
        "periodStart", "periodEnd",
        "totalSalesExVAT", "totalVATCollected", "totalVATPaid",
        "vatDue", "vatRefund",
        "standardSalesExVAT", "standardVATCollected",
        "exemptSales", "zeroRatedSales",
        "saleCount", notes, "filedAt", "createdAt", "updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        CASE WHEN $5 = 'submitted' THEN NOW() ELSE NULL END,
        $19, $20)
      RETURNING *`,
      [
        tenantId, year, quarter, label, status,
        periodStart.toISOString(), periodEnd.toISOString(),
        Math.round(totalSalesExVAT * 100) / 100,
        Math.round(totalVATCollected * 100) / 100,
        Math.round(totalVATPaid * 100) / 100,
        vatDue,
        vatRefund,
        Math.round(standardSalesExVAT * 100) / 100,
        Math.round(standardVATCollected * 100) / 100,
        Math.round(exemptSales * 100) / 100,
        Math.round(zeroRatedSales * 100) / 100,
        sales.length,
        notes,
        now,
        now,
      ]
    );

    return NextResponse.json({
      ...newReturn,
      _breakdown: {
        saleDetails,
        filingDeadline: getFilingDeadline(year, quarter),
      },
    });
  } catch (error: any) {
    console.error('[vat-compliance] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
