import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - List rent payments for this tenant (filtered by property -> tenantId)
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    const leaseId = searchParams.get('leaseId');
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    // Base where: property belongs to this SaaS tenant
    const where: any = { property: { tenantId } };
    if (leaseId) where.leaseId = leaseId;
    if (propertyId) where.propertyId = propertyId;
    if (status && status !== 'all') where.status = status;

    const payments = await db.rentPayment.findMany({
      where,
      include: { lease: { include: { unit: { include: { property: true } }, tenant: true } }, property: true, unit: true, tenant: true },
      orderBy: { dueDate: 'desc' },
    });
    return NextResponse.json(payments);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST - Create rent payment (verify property belongs to this tenant)
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    const body = await req.json();

    // Verify the property belongs to this tenant
    const property = await db.property.findUnique({ where: { id: body.propertyId } });
    if (!property || property.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 });
    }

    const payment = await db.rentPayment.create({
      data: {
        leaseId: body.leaseId,
        propertyId: body.propertyId,
        unitId: body.unitId,
        tenantId: body.tenantId || null,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        amountDue: Number(body.amountDue) || 0,
        amountPaid: Number(body.amountPaid) || 0,
        lateFee: Number(body.lateFee) || 0,
        currency: body.currency || 'TTD',
        paymentMethod: body.paymentMethod || null,
        paymentRef: body.paymentRef || null,
        status: body.status || 'pending',
        paidAt: body.paidAt ? new Date(body.paidAt) : null,
        dueDate: new Date(body.dueDate),
        notes: body.notes || null,
      },
      include: { lease: true, property: true, unit: true, tenant: true },
    });
    return NextResponse.json(payment);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH - Update rent payment (verify ownership via property)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // Verify the payment's property belongs to this tenant
    const existing = await db.rentPayment.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!existing || !existing.property || existing.property.tenantId !== tenantId) {
      return NextResponse.json({ error: 'RentPayment not found' }, { status: 404 });
    }

    const body = await req.json();
    const data: any = {};
    if (body.amountPaid !== undefined) data.amountPaid = Number(body.amountPaid);
    if (body.lateFee !== undefined) data.lateFee = Number(body.lateFee);
    if (body.status !== undefined) data.status = body.status;
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod;
    if (body.paymentRef !== undefined) data.paymentRef = body.paymentRef;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.paidAt !== undefined) data.paidAt = body.paidAt ? new Date(body.paidAt) : null;

    const payment = await db.rentPayment.update({
      where: { id },
      data,
      include: { lease: true, property: true, unit: true, tenant: true },
    });
    return NextResponse.json(payment);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE - Delete rent payment (verify ownership via property)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // Verify the payment's property belongs to this tenant
    const existing = await db.rentPayment.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!existing || !existing.property || existing.property.tenantId !== tenantId) {
      return NextResponse.json({ error: 'RentPayment not found' }, { status: 404 });
    }

    await db.rentPayment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
