import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
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
    const { searchParams } = new URL(req.url);
    if (searchParams.get('action') === 'summary') {
      const all = await db.claim.findMany({ where: { tenantId, isDeleted: false } });
      const open = all.filter((c: any) => c.status === 'open' || c.status === 'pending');
      const totalClaimed = all.reduce((sum: number, c: any) => sum + (parseFloat(c.amount || c.claimAmount || '0')), 0);
      const totalSettled = all.filter((c: any) => c.status === 'settled' || c.status === 'approved').reduce((sum: number, c: any) => sum + (parseFloat(c.settlementAmount || c.amount || '0')), 0);
      const avgProcessingDays = (() => {
        const settled = all.filter((c: any) => c.status === 'settled' && c.dateReported && c.dateSettled);
        if (settled.length === 0) return 0;
        return Math.round(settled.reduce((sum: number, c: any) => {
          return sum + (new Date(c.dateSettled).getTime() - new Date(c.dateReported).getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / settled.length);
      })();
      return NextResponse.json({
        totalClaims: all.length,
        openClaims: open.length,
        settledClaims: all.filter((c: any) => c.status === 'settled' || c.status === 'approved').length,
        deniedClaims: all.filter((c: any) => c.status === 'denied' || c.status === 'rejected').length,
        totalClaimed,
        totalSettled,
        avgProcessingDays,
      });
    }
    const items = await db.claim.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(items);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
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
    const item = await db.claim.create({ data: { ...data, tenantId } });
    return NextResponse.json(item);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { id, tenantId: _, ...updateData } = data;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const item = await db.claim.update({ where: { id, tenantId }, data: updateData });
    return NextResponse.json(item);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await db.claim.update({ where: { id: data.id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
