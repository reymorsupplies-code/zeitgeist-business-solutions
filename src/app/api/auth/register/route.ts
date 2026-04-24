import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, signToken, checkAuthRateLimit, isValidEmail } from '@/lib/auth';
import { sendEmail, ADMIN_EMAIL } from '@/lib/email';
import { registrationPending, newRegistrationAdmin } from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkAuthRateLimit(`register:${ip}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { email, password, fullName, companyName, industryId, planId } = await req.json();

    // Input validation
    if (!email || !password || !fullName || !companyName) {
      return NextResponse.json({ error: 'Email, password, full name, and company name are required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.platformUser.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    // Anti-abuse: Check if this email has used a trial before
    const trialAbuseUser = await db.platformUser.findFirst({
      where: { email: normalizedEmail, hasUsedTrial: true }
    });
    if (trialAbuseUser) {
      return NextResponse.json({ error: 'This email has already used a free trial. Please use a different email or contact support.' }, { status: 400 });
    }

    // Check if global trial is enabled
    const trialConfigSetting = await db.priceSetting.findUnique({ where: { key: 'trial_enabled' } });
    const trialEnabled = trialConfigSetting ? (trialConfigSetting as any).valueUSD === 1 : true;
    const trialDurationSetting = await db.priceSetting.findUnique({ where: { key: 'trial_duration_days' } });
    const trialDurationDays = trialDurationSetting ? Math.round((trialDurationSetting as any).valueUSD) : 7;

    // Hash password
    const hashedPassword = await hashPassword(password);

    const user = await db.platformUser.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        fullName,
        role: 'tenant_admin',
        isActive: false, // PENDING APPROVAL — not active until super admin approves
        hasUsedTrial: false, // Will be set to true upon approval
      }
    });

    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

    const tenant = await db.tenant.create({
      data: {
        name: companyName,
        slug,
        industryId: industryId || null,
        planId: planId || null,
        planName: planId ? 'starter' : null,
        status: 'pending_approval', // NEW STATUS — waiting for super admin
        trialStartsAt: null,
        trialEndsAt: null,
        trialDurationDays,
        hasUsedTrial: false,
        primaryColor: '#1D4ED8',
        accentColor: '#2563EB',
        currency: 'TTD',
        locale: 'en',
        taxRate: 0.125,
        country: 'TT',
      }
    });

    await db.tenantMembership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'owner', status: 'pending' }
    });

    // Create audit log
    await db.auditLog.create({
      data: { action: 'tenant_registered_pending', details: `New registration: ${companyName} by ${normalizedEmail} — awaiting approval`, severity: 'info' }
    });

    // Send email to registering user: "Application received"
    sendEmail(
      normalizedEmail,
      `Application Received — ${companyName}`,
      registrationPending({ name: fullName, email: normalizedEmail, companyName }),
    ).catch(() => {});

    // Send email to admin: "New registration pending"
    sendEmail(
      ADMIN_EMAIL,
      `New Registration: ${companyName} — Pending Approval`,
      newRegistrationAdmin({ name: fullName, email: normalizedEmail, companyName, industry: industryId || undefined }),
    ).catch(() => {});

    // Issue JWT with pending status
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: false,
      tenantId: tenant.id,
      tenantRole: 'owner',
    });

    return NextResponse.json({
      token,
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isSuperAdmin: false,
      status: 'pending_approval',
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
        currency: tenant.currency,
        locale: tenant.locale,
        taxRate: tenant.taxRate,
        country: tenant.country
      },
      welcomeMessage: 'Your registration has been submitted successfully! Our team will review your application and you will receive access once approved. Thank you for choosing Zeitgeist Business Solutions!'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
