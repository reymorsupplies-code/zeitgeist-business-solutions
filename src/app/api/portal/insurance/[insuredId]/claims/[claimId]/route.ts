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

export async function GET(req: NextRequest, { params }: { params: Promise<{ insuredId: string; claimId: string }> }) {
  const { insuredId, claimId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const access = await verifyPortalAccess(token, insuredId);
    if (!access) return NextResponse.json({ error: 'Access denied' }, { status: 401 });

    // Get policy IDs for this insured
    const policies = await db.policy.findMany({
      where: { insuredId, tenantId: access.tenantId, isDeleted: false },
      select: { id: true }
    });
    const policyIds = policies.map((p: any) => p.id);

    const claim = await db.claim.findFirst({
      where: { id: claimId, tenantId: access.tenantId, isDeleted: false, policyId: { in: policyIds } },
      include: {
        policy: { select: { policyNumber: true, type: true, coverage: true, premium: true } },
        notes: { where: { isDeleted: false, isInternal: false }, orderBy: { createdAt: 'desc' } },
        documents: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 }
      }
    });

    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

    return NextResponse.json({
      id: claim.id,
      claimNumber: claim.claimNumber,
      type: claim.type,
      priority: claim.priority,
      amount: claim.amount,
      reserveAmount: claim.reserveAmount,
      settlementAmount: claim.settlementAmount,
      status: claim.status,
      decision: claim.decision,
      denialReason: claim.denialReason,
      incidentDate: claim.incidentDate,
      dateReported: claim.dateReported,
      dateAcknowledged: claim.dateAcknowledged,
      dateAssessed: claim.dateAssessed,
      dateSettled: claim.dateSettled,
      description: claim.description,
      location: claim.location,
      policeReportNumber: claim.policeReportNumber,
      assignedTo: claim.assignedTo,
      policy: claim.policy,
      notes: claim.notes,
      documents: claim.documents,
      activities: claim.activities,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
