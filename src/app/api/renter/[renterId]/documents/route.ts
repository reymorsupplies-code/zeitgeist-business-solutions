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
    const documents = await db.propertyDocument.findMany({
      where: { tenantId: session.tenantId, leaseId: session.leaseId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(documents);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error obteniendo documentos' }, { status: 500 });
  }
}
