import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

// GET - List all rent payments
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const leaseId = searchParams.get('leaseId');
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    const where: any = {};
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

// POST - Create rent payment
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const body = await req.json();
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

// PATCH - Update rent payment
export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

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

// DELETE - Delete rent payment
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.rentPayment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
