import { NextRequest, NextResponse } from 'next/server';

function verifyRenterToken(req: NextRequest): any {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!auth) return null;
  try {
    const payload = JSON.parse(Buffer.from(auth, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
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
