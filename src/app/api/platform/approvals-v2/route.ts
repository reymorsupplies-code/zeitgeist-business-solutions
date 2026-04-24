import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { sendEmail } from '@/lib/email';
import { registrationApproved, registrationRejected } from '@/lib/email/templates';

// ─── GET: List all tenants awaiting super admin approval ───

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  if (!auth.payload?.isSuperAdmin) return NextResponse.json({ error: 'Super admin required' }, { status: 403 });

  try {
    // Fetch pending_approval tenants with registering user info and industry name
    const rows = await pgQuery<any>(
      `SELECT t.id, t.name, t.slug, t.email, t.phone, t.address, t.status,
              t."industryId", t."planId", t."planName", t.currency, t.locale,
              t."primaryColor", t."accentColor", t.country, t."taxRate",
              t."createdAt", t."updatedAt", t.settings,
              i.id AS "industry_id", i.name AS "industry_name", i.slug AS "industry_slug",
              i.icon AS "industry_icon", i.color AS "industry_color",
              tm.id AS "membership_id", tm.role AS "membership_role", tm.status AS "membership_status",
              tm."createdAt" AS "membership_createdAt",
              u.id AS "user_id", u.email AS "user_email", u."fullName" AS "user_fullName",
              u.role AS "user_role", u."isActive" AS "user_isActive",
              u."createdAt" AS "user_createdAt", u."lastLogin" AS "user_lastLogin"
       FROM "Tenant" t
       LEFT JOIN "Industry" i ON i.id = t."industryId"
       LEFT JOIN "TenantMembership" tm ON tm."tenantId" = t.id AND tm.role = 'admin'
       LEFT JOIN "PlatformUser" u ON u.id = tm."userId"
       WHERE t.status = $1
       ORDER BY t."createdAt" DESC`,
      ['pending_approval']
    );

    // Shape response: nest industry, registeringUser
    const tenants = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      email: row.email,
      phone: row.phone,
      address: row.address,
      status: row.status,
      industryId: row.industryId,
      planId: row.planId,
      planName: row.planName,
      currency: row.currency,
      locale: row.locale,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      country: row.country,
      taxRate: row.taxRate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings || {},
      industry: row.industry_id ? {
        id: row.industry_id,
        name: row.industry_name,
        slug: row.industry_slug,
        icon: row.industry_icon,
        color: row.industry_color,
      } : null,
      registeringUser: row.user_id ? {
        id: row.user_id,
        email: row.user_email,
        fullName: row.user_fullName,
        role: row.user_role,
        isActive: row.user_isActive,
        createdAt: row.user_createdAt,
        lastLogin: row.user_lastLogin,
      } : null,
      membership: row.membership_id ? {
        id: row.membership_id,
        role: row.membership_role,
        status: row.membership_status,
        createdAt: row.membership_createdAt,
      } : null,
    }));

    return NextResponse.json(tenants);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Approve or reject a pending tenant ───

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  if (!auth.payload?.isSuperAdmin) return NextResponse.json({ error: 'Super admin required' }, { status: 403 });

  try {
    const body = await req.json();
    const { tenantId, action, reason, trialDays } = body;

    if (!tenantId || !action) {
      return NextResponse.json({ error: 'tenantId and action are required' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    // Verify tenant exists and is in pending_approval status
    const tenant = await pgQueryOne<any>(
      `SELECT id, name, email, status, settings FROM "Tenant" WHERE id = $1`,
      [tenantId]
    );

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    if (tenant.status !== 'pending_approval') {
      return NextResponse.json({ error: `Tenant is not in pending_approval status (current: ${tenant.status})` }, { status: 400 });
    }

    // Find the owner membership (admin role)
    const membership = await pgQueryOne<any>(
      `SELECT id, "userId", role, status FROM "TenantMembership" WHERE "tenantId" = $1 AND role = 'admin'`,
      [tenantId]
    );

    if (action === 'approve') {
      const days = typeof trialDays === 'number' && trialDays > 0 ? trialDays : 7;

      // Update Tenant: status -> trial, set trial dates
      await pgQuery(
        `UPDATE "Tenant"
         SET status = $1,
             "trialStartsAt" = NOW(),
             "trialEndsAt" = NOW() + INTERVAL '1 day' * $2,
             "approvedAt" = NOW(),
             "approvedBy" = $3,
             "updatedAt" = NOW()
         WHERE id = $4`,
        ['trial', days, auth.payload.userId, tenantId]
      );

      // Activate the owner user if membership exists
      if (membership) {
        await pgQuery(
          `UPDATE "PlatformUser" SET "isActive" = true, "hasUsedTrial" = true, "updatedAt" = NOW() WHERE id = $1`,
          [membership.userId]
        );

        await pgQuery(
          `UPDATE "TenantMembership" SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
          ['active', membership.id]
        );
      }

      // Create AuditLog entry
      await pgQuery(
        `INSERT INTO "AuditLog" (action, "tenantId", details, severity, "createdAt")
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          'tenant_approved',
          tenantId,
          `Tenant "${tenant.name}" approved by super admin (${auth.payload.email}). Trial: ${days} days.`,
          'info',
        ]
      );

      // Fetch updated tenant for response
      const updated = await pgQueryOne<any>(
        `SELECT id, name, slug, status, "trialStartsAt", "trialEndsAt", "approvedAt", "updatedAt"
         FROM "Tenant" WHERE id = $1`,
        [tenantId]
      );

      // Send approval email to tenant user
      const registeringUser = await pgQueryOne<any>(
        `SELECT u.email, u."fullName" FROM "PlatformUser" u
         JOIN "TenantMembership" tm ON tm."userId" = u.id AND tm."tenantId" = $1
         WHERE tm.role = 'admin' LIMIT 1`,
        [tenantId]
      );
      if (registeringUser?.email) {
        sendEmail(
          registeringUser.email,
          `Approved! Your ${tenant.name} trial has started`,
          registrationApproved({ name: registeringUser.fullName || tenant.name, companyName: tenant.name, trialDays: days }),
        ).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        message: `Tenant "${tenant.name}" approved. Trial started for ${days} days.`,
        tenant: updated,
      });

    } else if (action === 'reject') {
      // Merge rejection reason into settings JSON
      let settings: Record<string, any> = {};
      try {
        settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : (tenant.settings || {});
      } catch {
        settings = {};
      }
      settings.rejectionReason = reason || 'No reason provided';
      settings.rejectedAt = new Date().toISOString();
      settings.rejectedBy = auth.payload.userId;

      // Update Tenant: status -> rejected, store reason in settings
      await pgQuery(
        `UPDATE "Tenant"
         SET status = $1, settings = $2, "updatedAt" = NOW()
         WHERE id = $3`,
        ['rejected', JSON.stringify(settings), tenantId]
      );

      // Create AuditLog entry
      await pgQuery(
        `INSERT INTO "AuditLog" (action, "tenantId", details, severity, "createdAt")
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          'tenant_rejected',
          tenantId,
          `Tenant "${tenant.name}" rejected by super admin (${auth.payload.email}). Reason: ${reason || 'Not specified'}`,
          'warning',
        ]
      );

      // Fetch updated tenant for response
      const updated = await pgQueryOne<any>(
        `SELECT id, name, slug, status, settings, "updatedAt" FROM "Tenant" WHERE id = $1`,
        [tenantId]
      );

      // Send rejection email to tenant user
      const registeringUser = await pgQueryOne<any>(
        `SELECT u.email, u."fullName" FROM "PlatformUser" u
         JOIN "TenantMembership" tm ON tm."userId" = u.id AND tm."tenantId" = $1
         WHERE tm.role = 'admin' LIMIT 1`,
        [tenantId]
      );
      if (registeringUser?.email) {
        sendEmail(
          registeringUser.email,
          `Update on your ${tenant.name} application`,
          registrationRejected({ name: registeringUser.fullName || tenant.name, companyName: tenant.name, reason: reason || undefined }),
        ).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        message: `Tenant "${tenant.name}" rejected.`,
        tenant: updated,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
