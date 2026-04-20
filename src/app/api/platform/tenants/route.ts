import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';
import { sendEmail } from '@/lib/email';
import {
  registrationWelcome,
  accountSuspended,
  welcomeToZBS,
} from '@/lib/email/templates';

export async function GET() {
  try {
    let tenants: any[] = [];
    try {
      tenants = await db.tenant.findMany({
        include: { industry: true, plan: true, memberships: { include: { user: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } catch {
      // Fallback: direct pg queries (parameterized, safe)
      const rows = await pgQuery<any>(
        `SELECT t.*,
           i.id AS "industry_id", i.name AS "industry_name", i.slug AS "industry_slug", i.icon AS "industry_icon", i.color AS "industry_color",
           p.id AS "plan_id", p.name AS "plan_name", p.slug AS "plan_slug", p.tier AS "plan_tier", p."priceUSD" AS "plan_priceUSD", p."priceTTD" AS "plan_priceTTD", p."maxUsers" AS "plan_maxUsers", p."maxBranches" AS "plan_maxBranches", p.status AS "plan_status"
         FROM "Tenant" t
         LEFT JOIN "Industry" i ON i.id = t."industryId"
         LEFT JOIN "Plan" p ON p.id = t."planId"
         ORDER BY t."createdAt" DESC`
      );

      const memberships = await pgQuery<any>(
        `SELECT tm.id, tm."userId", tm."tenantId", tm.role, tm.status, tm."createdAt" AS "createdAt",
           u.id AS "user_id", u.email AS "user_email", u."fullName" AS "user_fullName", u.role AS "user_role", u."isActive" AS "user_isActive", u."createdAt" AS "user_createdAt"
         FROM "TenantMembership" tm
         LEFT JOIN "PlatformUser" u ON u.id = tm."userId"`
      );

      const membershipsByTenant: Record<string, any[]> = {};
      for (const m of memberships) {
        if (!membershipsByTenant[m.tenantId]) membershipsByTenant[m.tenantId] = [];
        membershipsByTenant[m.tenantId].push({
          id: m.id, userId: m.userId, tenantId: m.tenantId,
          role: m.role, status: m.status, createdAt: m.createdAt,
          user: m.user_id ? {
            id: m.user_id, email: m.user_email, fullName: m.user_fullName,
            role: m.user_role, isActive: m.user_isActive, createdAt: m.user_createdAt,
          } : null,
        });
      }

      tenants = rows.map((row: any) => ({
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
        memberships: membershipsByTenant[row.id] || [],
      }));
    }
    return NextResponse.json(tenants);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

    // Get trial config
    let trialDurationDays = data.trialDurationDays || 7;
    try {
      const trialDurationSetting = await db.priceSetting.findUnique({ where: { key: 'trial_duration_days' } });
      if (trialDurationSetting) trialDurationDays = Math.round((trialDurationSetting as any).valueUSD);
    } catch {}

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDurationDays);
    trialEnd.setHours(0, 0, 0, 0);

    // Resolve industryId: frontend sends slug (e.g. 'bakery'), we need the actual Industry.id
    let resolvedIndustryId: string | null = null;
    if (data.industryId) {
      try {
        const industry = await db.industry.findFirst({
          where: {
            OR: [
              { id: data.industryId },
              { slug: data.industryId },
            ]
          }
        });
        resolvedIndustryId = industry?.id || null;
      } catch {
        // Fallback: try direct pg query
        try {
          const rows = await pgQuery<any>(`SELECT id FROM "Industry" WHERE id = $1 OR slug = $1 LIMIT 1`, [data.industryId]);
          resolvedIndustryId = rows[0]?.id || null;
        } catch {}
      }
    }

    // Resolve planId similarly
    let resolvedPlanId: string | null = null;
    if (data.planId) {
      try {
        const plan = await db.plan.findFirst({
          where: {
            OR: [
              { id: data.planId },
              { slug: data.planId },
            ]
          }
        });
        resolvedPlanId = plan?.id || null;
      } catch {
        try {
          const rows = await pgQuery<any>(`SELECT id FROM "Plan" WHERE id = $1 OR slug = $1 LIMIT 1`, [data.planId]);
          resolvedPlanId = rows[0]?.id || null;
        } catch {}
      }
    }

    const tenant = await db.tenant.create({
      data: {
        name: data.name, slug,
        industryId: resolvedIndustryId, planId: resolvedPlanId, planName: data.planName || null,
        status: data.status || 'trial', trialStartsAt: new Date(), trialEndsAt: trialEnd,
        trialDurationDays, hasUsedTrial: true,
        primaryColor: data.primaryColor || '#1D4ED8', accentColor: data.accentColor || '#2563EB',
        currency: data.currency || 'TTD', locale: data.locale || 'en', taxRate: data.taxRate || 0.125,
        country: data.country || 'TT', email: data.email, phone: data.phone, address: data.address,
      }
    });

    // If admin email provided, create user and membership
    if (data.adminEmail && data.adminFullName && data.adminPassword) {
      const user = await db.platformUser.create({
        data: { email: data.adminEmail, password: data.adminPassword, fullName: data.adminFullName, role: 'tenant_admin', isActive: true, hasUsedTrial: true, country: data.country }
      });
      await db.tenantMembership.create({
        data: { userId: user.id, tenantId: tenant.id, role: 'admin', status: 'active' }
      });

      const planName = data.planName || 'Starter Suite';
      sendEmail(
        data.adminEmail,
        `Welcome to Zeitgeist — Your ${planName} trial has started!`,
        registrationWelcome({ name: data.adminFullName, email: data.adminEmail, tenantName: data.name, planName }),
      ).catch(() => {});
    }

    await db.auditLog.create({
      data: { action: 'tenant_created', tenantId: tenant.id, details: `Tenant ${data.name} created via Control Tower`, severity: 'info' }
    });

    return NextResponse.json(tenant);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    const { action, tenantId, planId, status, paymentVerified, trialExtensionDays } = data;

    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    switch (action) {
      case 'approve_payment': {
        const updated = await db.tenant.update({
          where: { id: tenantId },
          data: { status: 'active', paymentVerified: true, approvedAt: new Date(), approvedBy: 'super_admin' }
        });
        await db.tenantSubscription.create({
          data: { tenantId, planId: tenant.planId, planName: tenant.planName, status: 'active', billingCycle: 'monthly', priceUSD: 0, priceTTD: 0, currentPeriodStart: new Date() }
        });
        await db.auditLog.create({ data: { action: 'payment_verified', tenantId, details: 'Payment verified by super admin', severity: 'info' } });

        if (tenant.email) {
          const planName = tenant.planName || 'Starter Suite';
          sendEmail(
            tenant.email,
            `Welcome to Zeitgeist — ${tenant.name} is now active!`,
            registrationWelcome({ name: tenant.name, email: tenant.email, tenantName: tenant.name, planName }),
          ).catch(() => {});
        }

        return NextResponse.json(updated);
      }
      case 'suspend': {
        const updated = await db.tenant.update({ where: { id: tenantId }, data: { status: 'suspended' } });
        await db.auditLog.create({ data: { action: 'tenant_suspended', tenantId, details: `Tenant suspended. Reason: ${data.reason || 'Not specified'}`, severity: 'warning' } });

        if (tenant.email) {
          sendEmail(
            tenant.email,
            `Important: Your ${tenant.name} account has been suspended`,
            accountSuspended({
              name: tenant.name, tenantName: tenant.name,
              reason: data.reason || 'Your account has been suspended by the platform administrator. Please contact support for assistance.',
            }),
          ).catch(() => {});
        }

        return NextResponse.json(updated);
      }
      case 'activate': {
        const updated = await db.tenant.update({ where: { id: tenantId }, data: { status: 'active' } });
        await db.auditLog.create({ data: { action: 'tenant_activated', tenantId, details: 'Tenant activated', severity: 'info' } });
        return NextResponse.json(updated);
      }
      case 'change_plan': {
        if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });
        const plan = await db.plan.findUnique({ where: { id: planId } });
        const updated = await db.tenant.update({
          where: { id: tenantId },
          data: { planId, planName: plan?.name || null }
        });
        await db.auditLog.create({ data: { action: 'plan_changed', tenantId, details: `Plan changed to ${plan?.name}`, severity: 'info' } });
        return NextResponse.json(updated);
      }
      case 'extend_trial': {
        const days = trialExtensionDays || 7;
        const newEnd = new Date(tenant.trialEndsAt || new Date());
        newEnd.setDate(newEnd.getDate() + days);
        const updated = await db.tenant.update({
          where: { id: tenantId },
          data: { trialEndsAt: newEnd, status: 'trial' }
        });
        await db.auditLog.create({ data: { action: 'trial_extended', tenantId, details: `Trial extended by ${days} days`, severity: 'info' } });
        return NextResponse.json(updated);
      }
      case 'end_trial': {
        const updated = await db.tenant.update({
          where: { id: tenantId },
          data: { status: 'active', trialEndsAt: new Date() }
        });
        await db.auditLog.create({ data: { action: 'trial_ended', tenantId, details: 'Trial ended immediately', severity: 'warning' } });

        if (tenant.email) {
          sendEmail(
            tenant.email,
            `Your ${tenant.name} trial has ended — Welcome to ZBS!`,
            welcomeToZBS({ name: tenant.name }),
          ).catch(() => {});
        }

        return NextResponse.json(updated);
      }
      case 'update': {
        const updateData: any = {};
        if (status) updateData.status = status;
        if (paymentVerified !== undefined) updateData.paymentVerified = paymentVerified;
        const updated = await db.tenant.update({ where: { id: tenantId }, data: updateData });
        return NextResponse.json(updated);
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
