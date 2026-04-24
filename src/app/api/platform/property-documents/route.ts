import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

// GET - List property documents
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const leaseId = searchParams.get('leaseId');
    const type = searchParams.get('type');

    const where: any = {};
    if (propertyId) where.propertyId = propertyId;
    if (unitId) where.unitId = unitId;
    if (leaseId) where.leaseId = leaseId;
    if (type && type !== 'all') where.type = type;

    const docs = await db.propertyDocument.findMany({
      where,
      include: { property: true, unit: true, lease: true, tenant: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(docs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST - Create document
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const body = await req.json();
    const doc = await db.propertyDocument.create({
      data: {
        propertyId: body.propertyId || null,
        unitId: body.unitId || null,
        leaseId: body.leaseId || null,
        tenantId: body.tenantId || null,
        name: body.name,
        type: body.type || 'other',
        category: body.category || null,
        fileUrl: body.fileUrl || null,
        description: body.description || null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        status: body.status || 'active',
      },
      include: { property: true, unit: true, lease: true, tenant: true },
    });
    return NextResponse.json(doc);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH - Update document
export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.category !== undefined) data.category = body.category;
    if (body.fileUrl !== undefined) data.fileUrl = body.fileUrl;
    if (body.description !== undefined) data.description = body.description;
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.status !== undefined) data.status = body.status;

    const doc = await db.propertyDocument.update({
      where: { id },
      data,
      include: { property: true, unit: true, lease: true, tenant: true },
    });
    return NextResponse.json(doc);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE - Delete document
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.propertyDocument.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
