import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function verifyPortalAccess(token: string, insuredId: string) {
  const portalToken = await db.portalToken.findFirst({
    where: {
      token,
      insuredId,
      isActive: true,
      isDeleted: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }
  });
  if (!portalToken) return null;
  await db.portalToken.update({
    where: { id: portalToken.id },
    data: { lastUsedAt: new Date(), useCount: { increment: 1 } }
  });
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
        product: { select: { name: true, category: true } },
        agent: { select: { firstName: true, lastName: true, agentCode: true } },
        premiumSchedules: {
          where: { isDeleted: false },
          select: { dueDate: true, amount: true, status: true, paidAmount: true }
        },
        claims: {
          where: { isDeleted: false },
          select: { id: true, claimNumber: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const enriched = policies.map((p: any) => {
      const schedules = p.premiumSchedules || [];
      const totalDue = schedules.reduce((s: number, ps: any) => s + Number(ps.amount), 0);
      const totalPaid = schedules.reduce((s: number, ps: any) => s + Number(ps.paidAmount), 0);
      const pendingSchedules = schedules.filter((ps: any) => ps.status === 'pending' || ps.status === 'overdue');
      const nextDue = pendingSchedules.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
      return {
        id: p.id,
        policyNumber: p.policyNumber,
        type: p.type,
        subType: p.subType,
        status: p.status,
        premium: p.premium,
        coverage: p.coverage,
        sumInsured: p.sumInsured,
        excessAmount: p.excessAmount,
        deductibleAmount: p.deductibleAmount,
        startDate: p.startDate,
        endDate: p.endDate,
        renewalCount: p.renewalCount,
        productName: p.product?.name,
        productCategory: p.product?.category,
        agentName: p.agent ? `${p.agent.firstName} ${p.agent.lastName}` : null,
        agentCode: p.agent?.agentCode,
        premiumSummary: { totalDue, totalPaid, outstanding: totalDue - totalPaid },
        nextPremiumDue: nextDue?.dueDate,
        nextPremiumAmount: nextDue?.amount,
        openClaims: p.claims.filter((c: any) => !['closed', 'denied'].includes(c.status)).length,
        totalClaims: p.claims.length,
      };
    });

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
