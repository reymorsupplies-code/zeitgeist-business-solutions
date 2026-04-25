import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function verifyPortalAccess(token: string, insuredId: string) {
  const portalToken = await db.portalToken.findFirst({
    where: {
      token, insuredId, isActive: true, isDeleted: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }
  });
  if (!portalToken) return null;
  return portalToken;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ insuredId: string }> }) {
  const { insuredId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const access = await verifyPortalAccess(token, insuredId);
    if (!access) return NextResponse.json({ error: 'Access denied' }, { status: 401 });

    const policies = await db.policy.findMany({
      where: { insuredId, tenantId: access.tenantId, isDeleted: false },
      include: {
        product: { select: { name: true } },
        premiumSchedules: {
          where: { isDeleted: false },
          orderBy: { dueDate: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const premiums: any[] = [];
    for (const policy of policies) {
      const p = policy as any;
      for (const schedule of p.premiumSchedules || []) {
        premiums.push({
          id: schedule.id,
          policyId: policy.id,
          policyNumber: policy.policyNumber,
          productName: p.product?.name,
          policyType: policy.type,
          dueDate: schedule.dueDate,
          amount: schedule.amount,
          status: schedule.status,
          paidDate: schedule.paidDate,
          paidAmount: schedule.paidAmount,
          reference: schedule.reference,
          notes: schedule.notes,
        });
      }
    }

    // Sort by due date
    premiums.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return NextResponse.json(premiums);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
