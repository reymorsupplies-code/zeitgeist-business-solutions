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
    const payments = await db.rentPayment.findMany({
      where: { tenantId: session.tenantId, leaseId: session.leaseId },
      orderBy: { dueDate: 'desc' },
      take: 50,
    });
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error obteniendo pagos' }, { status: 500 });
  }
}
