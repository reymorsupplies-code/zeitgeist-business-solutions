import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

// Trinidad & Tobago Tax Thresholds
const TT_THRESHOLDS = {
  corporateTax: {
    name: 'Corporate Tax',
    rate: 0.25,
    smallCompanyRate: 0,
    smallCompanyThreshold: 1_000_000,
    description: '0% if annual profit <= TT$1,000,000 (small company). 25% on the excess.',
    appliesTo: 'Annual net profit',
  },
  vat: {
    name: 'VAT / IVA',
    rate: 0.125,
    threshold: 500_000,
    description: 'Mandatory registration if annual revenue > TT$500,000. Rate: 12.5%.',
    appliesTo: 'Annual gross revenue',
  },
  businessLevy: {
    name: 'Business Levy',
    rate: 0.006,
    threshold: 360_000,
    description: '0.6% on gross sales if annual sales > TT$360,000.',
    appliesTo: 'Annual gross sales',
  },
  greenFundLevy: {
    name: 'Green Fund Levy',
    rate: 0.003,
    threshold: 360_000,
    description: '0.3% on gross sales (applies alongside Business Levy).',
    appliesTo: 'Annual gross sales',
  },
};

export async function GET() {
  try {
    let tenants: any[] = [];
    let subs: any[] = [];

    try {
      tenants = await db.tenant.findMany({
        include: { industry: true, plan: true },
        orderBy: { createdAt: 'desc' },
      });
      subs = await db.tenantSubscription.findMany();
    } catch {
      const [tenantRows, subRows] = await Promise.all([
        pgQuery<any>(
          `SELECT t.*, i.id AS "industry_id", i.name AS "industry_name", i.slug AS "industry_slug", i.icon AS "industry_icon", i.color AS "industry_color",
            p.id AS "plan_id", p.name AS "plan_name", p.slug AS "plan_slug", p.tier AS "plan_tier", p."priceUSD" AS "plan_priceUSD", p."priceTTD" AS "plan_priceTTD"
           FROM "Tenant" t
           LEFT JOIN "Industry" i ON i.id = t."industryId"
           LEFT JOIN "Plan" p ON p.id = t."planId"
           ORDER BY t."createdAt" DESC`
        ),
        pgQuery<any>(`SELECT * FROM "TenantSubscription"`),
      ]);

      tenants = tenantRows.map((row: any) => ({
        ...row,
        industry: row.industry_id ? { id: row.industry_id, name: row.industry_name, slug: row.industry_slug, icon: row.industry_icon, color: row.industry_color } : null,
        plan: row.plan_id ? { id: row.plan_id, name: row.plan_name, slug: row.plan_slug, tier: row.plan_tier, priceUSD: row.plan_priceUSD, priceTTD: row.plan_priceTTD } : null,
      }));
      subs = subRows;
    }

    // Calculate revenue per tenant
    const payingTenants = tenants
      .filter(t => t.status === 'active' || t.status === 'trial')
      .map(t => {
        const sub = subs.find(s => s.tenantId === t.id && s.status === 'active');
        const planPriceTTD = t.plan?.priceTTD || sub?.priceTTD || 0;
        const planPriceUSD = t.plan?.priceUSD || sub?.priceUSD || 0;
        return {
          id: t.id, name: t.name, email: t.email, status: t.status,
          industry: t.industry?.name || 'Unknown', industrySlug: t.industry?.slug || '',
          planName: t.plan?.name || t.planName || 'None', planTier: t.plan?.tier || 'starter',
          monthlyRevenueTTD: planPriceTTD, monthlyRevenueUSD: planPriceUSD,
          isVAT: !!t.taxRate && t.taxRate > 0, taxRate: t.taxRate || 0,
        };
      });

    const monthlyRevenueTTD = payingTenants.reduce((s, t) => s + t.monthlyRevenueTTD, 0);
    const monthlyRevenueUSD = payingTenants.reduce((s, t) => s + t.monthlyRevenueUSD, 0);
    const annualRevenueTTD = monthlyRevenueTTD * 12;
    const annualRevenueUSD = monthlyRevenueUSD * 12;

    const estimatedMonthlyCosts = monthlyRevenueTTD * 0.60;
    const estimatedMonthlyProfit = monthlyRevenueTTD - estimatedMonthlyCosts;
    const estimatedAnnualProfit = estimatedMonthlyProfit * 12;

    const activeTenants = payingTenants.filter(t => t.status === 'active');
    const trialTenants = payingTenants.filter(t => t.status === 'trial');
    const vatTenants = payingTenants.filter(t => t.isVAT);
    const nonVatTenants = payingTenants.filter(t => !t.isVAT);

    // === TAX CALCULATIONS ===

    const corporateTax = {
      ...TT_THRESHOLDS.corporateTax,
      currentValue: estimatedAnnualProfit,
      threshold: TT_THRESHOLDS.corporateTax.smallCompanyThreshold,
      percentage: Math.min((estimatedAnnualProfit / TT_THRESHOLDS.corporateTax.smallCompanyThreshold) * 100, 999),
      isOver: estimatedAnnualProfit > TT_THRESHOLDS.corporateTax.smallCompanyThreshold,
      isWarning: estimatedAnnualProfit > TT_THRESHOLDS.corporateTax.smallCompanyThreshold * 0.75,
      estimatedTax: estimatedAnnualProfit > TT_THRESHOLDS.corporateTax.smallCompanyThreshold
        ? (estimatedAnnualProfit - TT_THRESHOLDS.corporateTax.smallCompanyThreshold) * TT_THRESHOLDS.corporateTax.rate : 0,
      remaining: Math.max(TT_THRESHOLDS.corporateTax.smallCompanyThreshold - estimatedAnnualProfit, 0),
      roomForNewMRR: Math.max(TT_THRESHOLDS.corporateTax.smallCompanyThreshold - estimatedAnnualProfit, 0) / 12 / 0.4,
    };

    const vat = {
      ...TT_THRESHOLDS.vat,
      currentValue: annualRevenueTTD,
      threshold: TT_THRESHOLDS.vat.threshold,
      percentage: Math.min((annualRevenueTTD / TT_THRESHOLDS.vat.threshold) * 100, 999),
      isOver: annualRevenueTTD > TT_THRESHOLDS.vat.threshold,
      isWarning: annualRevenueTTD > TT_THRESHOLDS.vat.threshold * 0.75,
      estimatedTax: annualRevenueTTD > TT_THRESHOLDS.vat.threshold ? annualRevenueTTD * TT_THRESHOLDS.vat.rate : 0,
      remaining: Math.max(TT_THRESHOLDS.vat.threshold - annualRevenueTTD, 0),
      roomForNewMRR: Math.max(TT_THRESHOLDS.vat.threshold - annualRevenueTTD, 0) / 12,
      allTenantsVAT: payingTenants.length > 0 && vatTenants.length === payingTenants.length,
      vatTenantCount: vatTenants.length,
      nonVatTenantCount: nonVatTenants.length,
    };

    const businessLevy = {
      ...TT_THRESHOLDS.businessLevy,
      currentValue: annualRevenueTTD,
      threshold: TT_THRESHOLDS.businessLevy.threshold,
      percentage: Math.min((annualRevenueTTD / TT_THRESHOLDS.businessLevy.threshold) * 100, 999),
      isOver: annualRevenueTTD > TT_THRESHOLDS.businessLevy.threshold,
      isWarning: annualRevenueTTD > TT_THRESHOLDS.businessLevy.threshold * 0.75,
      estimatedTax: annualRevenueTTD > TT_THRESHOLDS.businessLevy.threshold ? annualRevenueTTD * TT_THRESHOLDS.businessLevy.rate : 0,
      remaining: Math.max(TT_THRESHOLDS.businessLevy.threshold - annualRevenueTTD, 0),
      roomForNewMRR: Math.max(TT_THRESHOLDS.businessLevy.threshold - annualRevenueTTD, 0) / 12,
    };

    const greenFundLevy = {
      ...TT_THRESHOLDS.greenFundLevy,
      currentValue: annualRevenueTTD,
      threshold: TT_THRESHOLDS.greenFundLevy.threshold,
      percentage: Math.min((annualRevenueTTD / TT_THRESHOLDS.greenFundLevy.threshold) * 100, 999),
      isOver: annualRevenueTTD > TT_THRESHOLDS.greenFundLevy.threshold,
      isWarning: annualRevenueTTD > TT_THRESHOLDS.greenFundLevy.threshold * 0.75,
      estimatedTax: annualRevenueTTD > TT_THRESHOLDS.greenFundLevy.threshold ? annualRevenueTTD * TT_THRESHOLDS.greenFundLevy.rate : 0,
      remaining: Math.max(TT_THRESHOLDS.greenFundLevy.threshold - annualRevenueTTD, 0),
      roomForNewMRR: Math.max(TT_THRESHOLDS.greenFundLevy.threshold - annualRevenueTTD, 0) / 12,
    };

    const totalEstimatedTax = corporateTax.estimatedTax + vat.estimatedTax + businessLevy.estimatedTax + greenFundLevy.estimatedTax;

    const allThresholds = [
      { name: 'VAT', room: vat.roomForNewMRR, threshold: vat.threshold },
      { name: 'Business Levy', room: businessLevy.roomForNewMRR, threshold: businessLevy.threshold },
      { name: 'Green Fund', room: greenFundLevy.roomForNewMRR, threshold: greenFundLevy.threshold },
      { name: 'Corporate Tax', room: corporateTax.roomForNewMRR, threshold: corporateTax.threshold },
    ].sort((a, b) => a.room - b.room);

    const bottleneck = allThresholds[0];

    const simulateSuspend = (tenantId: string) => {
      const tenant = payingTenants.find(t => t.id === tenantId);
      if (!tenant) return null;
      const newMonthly = monthlyRevenueTTD - tenant.monthlyRevenueTTD;
      const newAnnual = newMonthly * 12;
      const newAnnualProfit = (newMonthly - newMonthly * 0.60) * 12;
      return {
        tenantName: tenant.name, tenantPlan: tenant.planName, tenantMonthlyRevenue: tenant.monthlyRevenueTTD,
        newMonthlyRevenue: newMonthly, newAnnualRevenue: newAnnual, newAnnualProfit,
        impacts: {
          vat: { wouldBeOver: newAnnual > TT_THRESHOLDS.vat.threshold, remaining: Math.max(TT_THRESHOLDS.vat.threshold - newAnnual, 0) },
          businessLevy: { wouldBeOver: newAnnual > TT_THRESHOLDS.businessLevy.threshold, remaining: Math.max(TT_THRESHOLDS.businessLevy.threshold - newAnnual, 0) },
          greenFundLevy: { wouldBeOver: newAnnual > TT_THRESHOLDS.greenFundLevy.threshold, remaining: Math.max(TT_THRESHOLDS.greenFundLevy.threshold - newAnnual, 0) },
          corporateTax: { wouldBeOver: newAnnualProfit > TT_THRESHOLDS.corporateTax.smallCompanyThreshold, remaining: Math.max(TT_THRESHOLDS.corporateTax.smallCompanyThreshold - newAnnualProfit, 0) },
        },
        totalTaxesWouldBe: [
          newAnnualProfit > TT_THRESHOLDS.corporateTax.smallCompanyThreshold ? (newAnnualProfit - TT_THRESHOLDS.corporateTax.smallCompanyThreshold) * 0.25 : 0,
          newAnnual > TT_THRESHOLDS.vat.threshold ? newAnnual * 0.125 : 0,
          newAnnual > TT_THRESHOLDS.businessLevy.threshold ? newAnnual * 0.006 : 0,
          newAnnual > TT_THRESHOLDS.greenFundLevy.threshold ? newAnnual * 0.003 : 0,
        ].reduce((a, b) => a + b, 0),
        taxSavings: totalEstimatedTax - [
          newAnnualProfit > TT_THRESHOLDS.corporateTax.smallCompanyThreshold ? (newAnnualProfit - TT_THRESHOLDS.corporateTax.smallCompanyThreshold) * 0.25 : 0,
          newAnnual > TT_THRESHOLDS.vat.threshold ? newAnnual * 0.125 : 0,
          newAnnual > TT_THRESHOLDS.businessLevy.threshold ? newAnnual * 0.006 : 0,
          newAnnual > TT_THRESHOLDS.greenFundLevy.threshold ? newAnnual * 0.003 : 0,
        ].reduce((a, b) => a + b, 0),
      };
    };

    const simulations = payingTenants.map(t => simulateSuspend(t.id)).filter(Boolean);

    return NextResponse.json({
      thresholds: { corporateTax, vat, businessLevy, greenFundLevy },
      revenue: { monthlyTTD: monthlyRevenueTTD, monthlyUSD: monthlyRevenueUSD, annualTTD: annualRevenueTTD, annualUSD: annualRevenueUSD, estimatedAnnualProfit, estimatedProfitMargin: 0.40 },
      tenants: { total: payingTenants.length, active: activeTenants.length, trial: trialTenants.length, vatCount: vatTenants.length, nonVatCount: nonVatTenants.length, allVAT: payingTenants.length > 0 && vatTenants.length === payingTenants.length, list: payingTenants },
      taxes: { totalEstimatedAnnual: totalEstimatedTax, corporateTax: corporateTax.estimatedTax, vat: vat.estimatedTax, businessLevy: businessLevy.estimatedTax, greenFundLevy: greenFundLevy.estimatedTax },
      bottleneck,
      simulations,
      warnings: [
        ...(vat.isWarning ? [`VAT: Annual revenue at ${vat.percentage.toFixed(1)}% of threshold (TT$${vat.threshold.toLocaleString()})`] : []),
        ...(businessLevy.isWarning ? [`Business Levy: Annual sales at ${businessLevy.percentage.toFixed(1)}% of threshold (TT$${businessLevy.threshold.toLocaleString()})`] : []),
        ...(greenFundLevy.isWarning ? [`Green Fund Levy: Annual sales at ${greenFundLevy.percentage.toFixed(1)}% of threshold`] : []),
        ...(corporateTax.isWarning ? [`Corporate Tax: Estimated profit at ${corporateTax.percentage.toFixed(1)}% of TT$1M threshold`] : []),
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
