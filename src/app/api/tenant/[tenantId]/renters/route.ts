import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { db } = await import('@/lib/db');
    const renters = await db.renter.findMany({
      where: { tenantId },
      include: { property: { select: { name: true } }, unit: { select: { unitNumber: true } }, lease: { select: { status: true, endDate: true, rentAmount: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(renters);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error obteniendo inquilinos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { db } = await import('@/lib/db');
    const { v4: uuid } = await import('uuid');
    const crypto = await import('crypto');

    const { fullName, email, phone, idDocument, leaseId, pin } = body;
    
    if (!fullName || !email || !pin) {
      return NextResponse.json({ error: 'Nombre, email y PIN son requeridos' }, { status: 400 });
    }

    // Hash the PIN
    const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');

    // If leaseId provided, look up unit and property
    let unitId = body.unitId || null;
    let propertyId = body.propertyId || null;
    if (leaseId) {
      const lease = await db.lease.findUnique({ where: { id: leaseId }, include: { unit: { include: { property: true } } } });
      if (lease) {
        unitId = unitId || lease.unitId;
        propertyId = propertyId || lease.unit?.propertyId || null;
      }
    }

    const renter = await db.renter.create({
      data: {
        id: uuid(),
        tenantId,
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        idDocument: idDocument?.trim() || null,
        leaseId: leaseId || null,
        unitId,
        propertyId,
        pin: hashedPin,
        status: 'active',
      },
    });

    // Return WITHOUT the hashed pin
    const { pin: _, ...safeRenter } = renter as any;
    return NextResponse.json({ ...safeRenter, _pinSet: true }, { status: 201 });
  } catch (error: any) {
    console.error('Create renter error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un inquilino con este email' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error creando inquilino' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const { db } = await import('@/lib/db');
    await db.renter.delete({ where: { id, tenantId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error eliminando inquilino' }, { status: 500 });
  }
}
