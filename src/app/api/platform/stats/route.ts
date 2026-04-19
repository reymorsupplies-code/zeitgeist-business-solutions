import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

export async function GET() {
  try {
    let tenants: any[] = [];
    let users: any[] = [];
    let industries: any[] = [];
    let plans: any[] = [];
    let subs: any[] = [];
    let invoices: any[] = [];
    let auditLogs: any[] = [];
    let trialEnabledSetting: any = null;
    let trialDurationSetting: any = null;

    try {
      // Try Prisma first
      tenants = await db.tenant.findMany({ include: { industry: true, plan: true }, orderBy: { createdAt: 'desc' } });
      users = await db.platformUser.findMany({ orderBy: { createdAt: 'desc' } });
      industries = await db.industry.findMany();
      plans = await db.plan.findMany({ where: { status: 'active' } });
      subs = await db.tenantSubscription.findMany();
      invoices = await db.platformInvoice.findMany();
      auditLogs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      trialEnabledSetting = await db.priceSetting.findUnique({ where: { key: 'trial_enabled' } });
      trialDurationSetting = await db.priceSetting.findUnique({ where: { key: 'trial_duration_days' } });
    } catch {
      // Fallback: direct pg queries (parameterized, safe)
      const [tenantRows, userRows, industryRows, planRows, subRows, invoiceRows, auditRows, settingRows] = await Promise.all([
        pgQuery<any>(
          `SELECT t.*, i.id AS "industry_id", i.name AS "industry_name", i.slug AS "industry_slug", i.icon AS "industry_icon", i.color AS "industry_color",
            p.id AS "plan_id", p.name AS "plan_name", p.slug AS "plan_slug", p.tier AS "plan_tier", p."priceUSD" AS "plan_priceUSD", p."priceTTD" AS "plan_priceTTD", p."maxUsers" AS "plan_maxUsers", p."maxBranches" AS "plan_maxBranches", p.status AS "plan_status"
           FROM "Tenant" t
           LEFT JOIN "Industry" i ON i.id = t."industryId"
           LEFT JOIN "Plan" p ON p.id = t."planId"
           ORDER BY t."createdAt" DESC`
        ),
        pgQuery<any>(`SELECT * FROM "PlatformUser" ORDER BY "createdAt" DESC`),
        pgQuery<any>(`SELECT * FROM "Industry"`),
        pgQuery<any>(`SELECT * FROM "Plan" WHERE status = 'active'`),
        pgQuery<any>(`SELECT * FROM "TenantSubscription"`),
        pgQuery<any>(`SELECT * FROM "PlatformInvoice"`),
        pgQuery<any>(`SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 20`),
        pgQuery<any>(`SELECT * FROM "PriceSetting" WHERE key IN ('trial_enabled', 'trial_duration_days')`),
      ]);

      // Map tenants to match Prisma's include shape
      tenants = tenantRows.map((row: any) => ({
        ...row,
        industry: row.industry_id ? {
          id: row.industry_id, name: row.industry_name, slug: row.industry_slug,
          icon: row.industry_icon, color: row.industry_color,
        } : null,
        plan: row.plan_id ? {
          id: row.plan_id, name: row.plan_name, slug: row.plan_slug,
          tier: row.plan_tier, priceUSD: row.plan_priceUSD, priceTTD: row.plan_priceTTD,
          maxUsers: row.plan_maxUsers, maxBranches: row.plan_maxBranches, status: row.plan_status,
        } : null,
      }));

      users = userRows;
      industries = industryRows;
      plans = planRows;
      subs = subRows;
      invoices = invoiceRows;
      auditLogs = auditRows;

      trialEnabledSetting = settingRows.find((s: any) => s.key === 'trial_enabled') || null;
      trialDurationSetting = settingRows.find((s: any) => s.key === 'trial_duration_days') || null;
    }

    // === Compute stats (same logic for both paths) ===

    const activeTenants = tenants.filter(t => t.status === 'active').length;
    const trialTenants = tenants.filter(t => t.status === 'trial').length;
    const suspendedTenants = tenants.filter(t => t.status === 'suspended').length;
    const cancelledTenants = tenants.filter(t => t.status === 'cancelled').length;
    const activeUsers = users.filter(u => u.isActive).length;

    const mrr = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.priceTTD || 0), 0);
    const mrrUSD = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.priceUSD || 0), 0);
    const arr = mrr * 12;
    const arrUSD = mrrUSD * 12;
    const overdue = invoices.filter(i => i.status === 'overdue').length;

    // Trial metrics
    const now = new Date();
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const trialsExpiringSoon = tenants.filter(t => t.status === 'trial' && t.trialEndsAt && new Date(t.trialEndsAt) <= fortyEightHoursFromNow).length;

    // Revenue by industry
    const revenueByIndustry: Record<string, { name: string; revenue: number; revenueUSD: number; tenantCount: number }> = {};
    tenants.forEach(t => {
      const indName = (t as any).industry?.name || 'Unknown';
      if (!revenueByIndustry[indName]) revenueByIndustry[indName] = { name: indName, revenue: 0, revenueUSD: 0, tenantCount: 0 };
      revenueByIndustry[indName].tenantCount++;
      const sub = subs.find(s => s.tenantId === t.id && s.status === 'active');
      if (sub) {
        revenueByIndustry[indName].revenue += sub.priceTTD || 0;
        revenueByIndustry[indName].revenueUSD += sub.priceUSD || 0;
      }
    });

    // Geographic distribution
    const geoDistribution: Record<string, { country: string; tenantCount: number; activeCount: number }> = {};
    tenants.forEach(t => {
      const country = t.country || 'Unknown';
      if (!geoDistribution[country]) geoDistribution[country] = { country, tenantCount: 0, activeCount: 0 };
      geoDistribution[country].tenantCount++;
      if (t.status === 'active' || t.status === 'trial') geoDistribution[country].activeCount++;
    });

    // Anti-abuse: detect suspicious accounts (same email or company name)
    const emailCounts: Record<string, number> = {};
    const nameCounts: Record<string, number> = {};
    tenants.forEach(t => {
      if (t.email) emailCounts[t.email] = (emailCounts[t.email] || 0) + 1;
      const normalizedName = t.name.toLowerCase().trim();
      nameCounts[normalizedName] = (nameCounts[normalizedName] || 0) + 1;
    });
    const suspiciousAccounts = tenants.filter(t =>
      (t.email && emailCounts[t.email] > 1) || nameCounts[t.name.toLowerCase().trim()] > 1
    );

    // Pending approval queue
    const pendingApproval = tenants.filter(t => t.status === 'trial' && !t.paymentVerified);

    // Recently active users
    const recentlyActive = users.filter(u => u.lastLogin && (now.getTime() - new Date(u.lastLogin).getTime()) < 3600000);

    return NextResponse.json({
      tenants: { total: tenants.length, active: activeTenants, trial: trialTenants, suspended: suspendedTenants, cancelled: cancelledTenants, list: tenants, pendingApproval, trialsExpiringSoon, suspiciousAccounts },
      users: { total: users.length, active: activeUsers, recentlyActive: recentlyActive.length, list: users },
      industries: { total: industries.length, list: industries },
      plans: { total: plans.length, list: plans },
      subscriptions: { total: subs.length, mrr, mrrUSD, arr, arrUSD, list: subs },
      invoices: { overdue, list: invoices },
      revenueByIndustry: Object.values(revenueByIndustry),
      geoDistribution: Object.values(geoDistribution),
      auditLogs,
      trialConfig: {
        enabled: trialEnabledSetting ? (trialEnabledSetting as any).valueUSD === 1 : true,
        durationDays: trialDurationSetting ? Math.round((trialDurationSetting as any).valueUSD) : 7,
      },
      paymentStatus: {
        verified: tenants.filter(t => t.paymentVerified).length,
        pending: tenants.filter(t => !t.paymentVerified).length,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
