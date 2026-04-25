import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeInsuranceInput, isValidAmount } from '@/lib/insurance-security';
import { auditLogger } from '@/lib/insurance-audit';

async function verifyPortalAccess(token: string, insuredId: string) {
  const portalToken = await db.portalToken.findFirst({
    where: {
      token, insuredId, isActive: true, isDeleted: false,
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

function generateClaimNumber() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `CLM-${date}-${rand}`;
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
      select: { id: true }
    });
    const policyIds = policies.map((p: any) => p.id);

    const claims = await db.claim.findMany({
      where: { policyId: { in: policyIds }, tenantId: access.tenantId, isDeleted: false },
      include: {
        policy: { select: { policyNumber: true, type: true } },
        _count: { select: { documents: true, notes: { where: { isInternal: false } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const enriched = claims.map((c: any) => ({
      id: c.id,
      claimNumber: c.claimNumber,
      type: c.type,
      priority: c.priority,
      amount: c.amount,
      reserveAmount: c.reserveAmount,
      settlementAmount: c.settlementAmount,
      status: c.status,
      decision: c.decision,
      incidentDate: c.incidentDate,
      dateReported: c.dateReported,
      dateAcknowledged: c.dateAcknowledged,
      dateAssessed: c.dateAssessed,
      dateSettled: c.dateSettled,
      description: c.description,
      policyNumber: c.policy?.policyNumber,
      policyType: c.policy?.type,
      documentCount: c._count.documents,
      visibleNoteCount: c._count.notes,
    }));

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ insuredId: string }> }) {
  const { insuredId } = await params;
  try {
    const data = await req.json();
    const { token, policyId, type, priority, amount, description, incidentDate, location, policeReportNumber } = data;

    if (!token || !policyId) return NextResponse.json({ error: 'Token and policyId are required' }, { status: 400 });

    const access = await verifyPortalAccess(token, insuredId);
    if (!access) return NextResponse.json({ error: 'Access denied' }, { status: 401 });

    // Verify policy belongs to this insured
    const policy = await db.policy.findFirst({
      where: { id: policyId, insuredId, tenantId: access.tenantId, isDeleted: false, status: 'active' }
    });
    if (!policy) return NextResponse.json({ error: 'Policy not found or not active' }, { status: 404 });

    if (amount !== undefined && !isValidAmount(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const claim = await db.claim.create({
      data: {
        tenantId: access.tenantId,
        policyId,
        claimNumber: generateClaimNumber(),
        type: type || 'property',
        priority: priority || 'medium',
        amount: amount || 0,
        description: description ? sanitizeInsuranceInput(description) : null,
        incidentDate: incidentDate ? new Date(incidentDate) : null,
        location: location ? sanitizeInsuranceInput(location) : null,
        policeReportNumber: policeReportNumber || null,
      }
    });

    // Auto-create activity
    await db.claimActivity.create({
      data: {
        tenantId: access.tenantId,
        claimId: claim.id,
        action: 'claim_submitted',
        performedBy: `portal:${insuredId}`,
        description: 'Claim submitted via client portal'
      }
    });

    auditLogger.log({
      tenantId: access.tenantId,
      userId: `portal:${insuredId}`,
      action: 'create',
      entityType: 'claim',
      entityId: claim.id,
      metadata: { claimNumber: claim.claimNumber, policyId, source: 'portal' }
    });

    return NextResponse.json({ success: true, claim: { id: claim.id, claimNumber: claim.claimNumber } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
