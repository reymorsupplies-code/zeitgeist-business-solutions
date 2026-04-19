import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

/**
 * JWT token verification endpoint.
 * Client calls this on page load to restore session.
 * Returns full user + tenant data (same shape as login response).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return NextResponse.json({ valid: false, error: 'No token provided' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ valid: false, error: 'Token expired or invalid' }, { status: 401 });
  }

  const isSuperAdmin = payload.isSuperAdmin || payload.role === 'super_admin' || payload.role === 'admin';

  // Fetch full user data
  let user: any = null;
  try {
    user = await db.platformUser.findUnique({ where: { id: payload.userId } });
  } catch {
    try {
      const rows = await pgQuery<any[]>(
        `SELECT id, email, "fullName", role, "isActive" FROM "PlatformUser" WHERE id = $1`,
        [payload.userId]
      );
      if (rows.length > 0) user = rows[0];
    } catch {}
  }

  // Check if user still active
  if (user && !user.isActive) {
    return NextResponse.json({ valid: false, error: 'Account disabled', code: 'DISABLED' }, { status: 403 });
  }

  // Fetch tenant data for non-super-admins
  let tenant: any = null;
  if (!isSuperAdmin) {
    try {
      const membership = await db.tenantMembership.findFirst({
        where: { userId: payload.userId, status: 'active' },
        include: { tenant: true }
      });
      if (membership) tenant = membership.tenant;
    } catch {
      try {
        const rows = await pgQuery<any[]>(
          `SELECT t.id, t.name, t.slug, t."industryId", t."planId", t."planName", t.status, t."primaryColor", t."accentColor", t.currency, t.locale, t."taxRate", t.country FROM "TenantMembership" tm JOIN "Tenant" t ON t.id = tm."tenantId" WHERE tm."userId" = $1 AND tm.status = 'active' LIMIT 1`,
          [payload.userId]
        );
        if (rows.length > 0) tenant = rows[0];
      } catch {}
    }
  }

  return NextResponse.json({
    valid: true,
    id: payload.userId,
    email: payload.email,
    fullName: user?.fullName || payload.email,
    role: payload.role,
    isSuperAdmin,
    tenantRole: payload.tenantRole,
    tenant: tenant ? {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      industryId: tenant.industryId,
      planId: tenant.planId,
      planName: tenant.planName,
      status: tenant.status,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      currency: tenant.currency,
      locale: tenant.locale,
      taxRate: tenant.taxRate,
      country: tenant.country
    } : null
  });
}
