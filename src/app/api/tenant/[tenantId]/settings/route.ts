import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }
  try {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, include: { industry: true, plan: true } });
    return NextResponse.json(tenant);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }
  try {
    const data = await req.json();
    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
        currency: data.currency,
        locale: data.locale,
        taxRate: data.taxRate,
        country: data.country,
        timezone: data.timezone,
        phone: data.phone,
        email: data.email,
        address: data.address,
        logoUrl: data.logoUrl,
        settings: data.settings ? (typeof data.settings === 'string' ? data.settings : JSON.stringify(data.settings)) : undefined,
      }
    });
    return NextResponse.json(tenant);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
