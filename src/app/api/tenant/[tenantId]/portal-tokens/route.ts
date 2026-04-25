import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { auditLogger } from '@/lib/insurance-audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const tokens = await db.portalToken.findMany({
      where: { tenantId, isDeleted: false },
      include: { insured: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(tokens);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { insuredId, expiresIn, maxUses, purpose } = data;
    if (!insuredId) return NextResponse.json({ error: 'insuredId is required' }, { status: 400 });

    const insured = await db.insured.findFirst({ where: { id: insuredId, tenantId, isDeleted: false, isActive: true } });
    if (!insured) return NextResponse.json({ error: 'Insured not found' }, { status: 404 });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;

    const portalToken = await db.portalToken.create({
      data: {
        tenantId,
        insuredId,
        token,
        purpose: purpose || 'portal',
        expiresAt,
        maxUses: maxUses || 0,
        createdBy: auth.payload?.userId || auth.payload?.email || 'system',
      }
    });

    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'create',
      entityType: 'portal_token',
      entityId: portalToken.id,
      metadata: { insuredId, purpose, expiresIn, maxUses }
    });

    return NextResponse.json({
      id: portalToken.id,
      token,
      purpose: portalToken.purpose,
      expiresAt: portalToken.expiresAt,
      maxUses: portalToken.maxUses,
      insuredName: `${insured.firstName} ${insured.lastName}`,
      portalUrl: `/portal/insurance?token=${token}`,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { id, action } = data;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    if (action === 'revoke') {
      await db.portalToken.update({ where: { id, tenantId }, data: { isActive: false } });
      auditLogger.log({
        tenantId,
        userId: auth.payload?.userId || auth.payload?.email || 'system',
        action: 'revoke',
        entityType: 'portal_token',
        entityId: id,
      });
      return NextResponse.json({ success: true, message: 'Token revoked' });
    }

    const updateData: any = {};
    if (data.expiresAt) updateData.expiresAt = new Date(data.expiresAt);
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const token = await db.portalToken.update({ where: { id, tenantId }, data: updateData });
    return NextResponse.json(token);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.portalToken.update({ where: { id: data.id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
