import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { 
        industry: true, 
        plan: true, 
        memberships: { include: { user: true } },
        subscriptions: { include: { plan: true } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      }
    });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    return NextResponse.json(tenant);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const data = await req.json();
    
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.planId) updateData.planId = data.planId;
    if (data.planName) updateData.planName = data.planName;
    if (data.paymentVerified !== undefined) updateData.paymentVerified = data.paymentVerified;
    if (data.approvedBy) updateData.approvedBy = data.approvedBy;
    if (data.approvedAt) updateData.approvedAt = new Date();
    if (data.trialEndsAt) updateData.trialEndsAt = new Date(data.trialEndsAt);
    if (data.primaryColor) updateData.primaryColor = data.primaryColor;
    if (data.accentColor) updateData.accentColor = data.accentColor;
    if (data.phone) updateData.phone = data.phone;
    if (data.email) updateData.email = data.email;
    if (data.address) updateData.address = data.address;
    if (data.country) updateData.country = data.country;
    if (data.hasUsedTrial !== undefined) updateData.hasUsedTrial = data.hasUsedTrial;

    const updated = await db.tenant.update({ where: { id: tenantId }, data: updateData });
    
    await db.auditLog.create({
      data: { tenantId, action: 'tenant_updated', details: `Tenant updated: ${Object.keys(updateData).join(', ')}`, severity: 'info' }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    await db.tenant.update({ where: { id: tenantId }, data: { status: 'cancelled' } });
    await db.auditLog.create({ data: { tenantId, action: 'tenant_terminated', details: 'Tenant terminated by admin', severity: 'critical' } });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
