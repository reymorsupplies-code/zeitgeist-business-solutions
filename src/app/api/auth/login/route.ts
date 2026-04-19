import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';
import { comparePassword, signToken, checkAuthRateLimit } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkAuthRateLimit(`login:${ip}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    let user: any = null;

    // Try Prisma first
    try {
      user = await db.platformUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    } catch (prismaErr: any) {
      console.warn('[Login] Prisma failed:', prismaErr?.message || prismaErr);
      // Fallback to pgQuery
      try {
        const rows = await pgQuery<any[]>(
          `SELECT id, email, password, "fullName", role, "isActive" FROM "PlatformUser" WHERE email = $1`,
          [email.toLowerCase().trim()]
        );
        if (rows.length > 0) user = rows[0];
      } catch (pgErr: any) {
        console.warn('[Login] pg fallback failed:', pgErr?.message || pgErr);
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Database connection error. Tables may not exist yet. Please wait while the system initializes.', needsInit: true }, { status: 503 });
    }

    // Check if password is plaintext (legacy) or hashed
    let passwordValid = false;
    if (user.password.startsWith('$2')) {
      // bcrypt hash
      passwordValid = await comparePassword(password, user.password);
    } else {
      // Legacy plaintext — compare directly then upgrade to hash
      passwordValid = user.password === password;
      if (passwordValid) {
        // Upgrade to hashed password
        const bcrypt = require('bcryptjs');
        const hashed = await bcrypt.hash(password, 12);
        try {
          await db.platformUser.update({ where: { id: user.id }, data: { password: hashed } });
        } catch {
          try {
            await pgQuery(`UPDATE "PlatformUser" SET password = $1 WHERE id = $2`, [hashed, user.id]);
          } catch {}
        }
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
    }

    const isSuperAdmin = user.role === 'super_admin';

    let tenant: any = null;
    let tenantRole: string | null = null;

    if (!isSuperAdmin) {
      try {
        const membership = await db.tenantMembership.findFirst({
          where: { userId: user.id, status: 'active' },
          include: { tenant: true }
        });
        if (membership) {
          tenant = membership.tenant;
          tenantRole = membership.role;
        }
      } catch {
        const dbUrl = process.env.DATABASE_URL;
        if (dbUrl) {
          try {
            const pg = require('pg');
            const client = new pg.Client({
              connectionString: dbUrl,
              ssl: { rejectUnauthorized: true },
            });
            await client.connect();
            const result = await client.query(
              `SELECT t.id, t.name, t.slug, t."industryId", t."planId", t."planName", t.status, t."primaryColor", t."accentColor", t.currency, t.locale, t."taxRate", t.country, tm.role as "tenantRole" FROM "TenantMembership" tm JOIN "Tenant" t ON t.id = tm."tenantId" WHERE tm."userId" = $1 AND tm.status = 'active' LIMIT 1`,
              [user.id]
            );
            await client.end();
            if (result.rows.length > 0) {
              tenant = result.rows[0];
              tenantRole = result.rows[0].tenantRole;
            }
          } catch {}
        }
      }
    }

    // Update last login (best effort)
    try {
      await db.platformUser.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    } catch {
      try {
        await pgQuery(`UPDATE "PlatformUser" SET "lastLogin" = NOW() WHERE id = $1`, [user.id]);
      } catch {}
    }

    // Issue JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin,
      tenantId: tenant?.id,
      tenantRole: tenantRole || undefined,
    });

    return NextResponse.json({
      token,
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isSuperAdmin,
      tenantRole,
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
