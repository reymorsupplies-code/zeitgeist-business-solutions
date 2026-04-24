import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';

function verifyRenterToken(req: NextRequest): any {
  const token = extractBearerToken(req);
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { db } = await import('@/lib/db');
    const renter = await db.renter.findUnique({
      where: { id: renterId },
      include: {
        property: true,
        unit: true,
        lease: true,
      },
    });
    if (!renter) return NextResponse.json({ error: 'Inquilino no encontrado' }, { status: 404 });
    return NextResponse.json(renter);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error obteniendo perfil' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { db } = await import('@/lib/db');
    
    const allowedFields = ['phone', 'email'];
    const data: any = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    const renter = await db.renter.update({
      where: { id: renterId },
      data,
    });
    return NextResponse.json(renter);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error actualizando perfil' }, { status: 500 });
  }
}
