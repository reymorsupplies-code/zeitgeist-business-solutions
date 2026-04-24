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
    const requests = await db.maintenanceRequest.findMany({
      where: { tenantId: session.tenantId, propertyId: session.propertyId },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error obteniendo solicitudes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { db } = await import('@/lib/db');
    const { v4: uuid } = await import('uuid');
    
    const request = await db.maintenanceRequest.create({
      data: {
        id: uuid(),
        tenantId: session.tenantId,
        propertyId: session.propertyId,
        unitId: session.unitId,
        title: body.title || 'Solicitud de mantenimiento',
        description: body.description || '',
        category: body.category || 'general',
        priority: body.priority || 'medium',
        status: 'open',
        requestedAt: new Date(),
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error: any) {
    console.error('Create maintenance error:', error);
    return NextResponse.json({ error: 'Error creando solicitud' }, { status: 500 });
  }
}
