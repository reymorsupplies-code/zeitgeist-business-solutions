import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { sanitizeInsuranceInput } from '@/lib/insurance-security';
import { auditLogger } from '@/lib/insurance-audit';

function generateStatementNumber() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `CST-${date}-${rand}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'summary') {
      const all = await db.commissionStatement.findMany({ where: { tenantId, isDeleted: false } });
      const pending = all.filter((s: any) => s.status === 'pending');
      const thisYear = all.filter((s: any) => s.status === 'paid' && s.approvedAt && new Date(s.approvedAt).getFullYear() === new Date().getFullYear());
      return NextResponse.json({
        totalOwed: pending.reduce((s: number, st: any) => s + Number(st.totalCommission), 0),
        pendingCount: pending.length,
        paidThisYear: thisYear.reduce((s: number, st: any) => s + Number(st.totalCommission), 0),
        paidCount: thisYear.length,
      });
    }

    const statements = await db.commissionStatement.findMany({
      where: { tenantId, isDeleted: false },
      include: { agent: { select: { firstName: true, lastName: true, agentCode: true, commissionRate: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(statements);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { agentId, periodStart, periodEnd, notes } = data;
    if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 });

    const agent = await db.insuranceAgent.findFirst({ where: { id: agentId, tenantId, isDeleted: false } });
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    // Calculate commissions from agent's active policies
    const dateFilter: any = { isDeleted: false, agentId };
    if (periodStart) dateFilter.createdAt = { ...(dateFilter.createdAt || {}), gte: new Date(periodStart) };
    if (periodEnd) dateFilter.createdAt = { ...(dateFilter.createdAt || {}), lte: new Date(periodEnd) };

    const policies = await db.policy.findMany({
      where: dateFilter,
      select: { premium: true, renewalCount: true, status: true }
    });

    const activePolicies = policies.filter((p: any) => p.status === 'active');
    const newBusiness = activePolicies.filter((p: any) => (p.renewalCount || 0) === 0);
    const renewals = activePolicies.filter((p: any) => (p.renewalCount || 0) > 0);

    const totalPremium = activePolicies.reduce((s: number, p: any) => s + Number(p.premium), 0);
    const newBizPremium = newBusiness.reduce((s: number, p: any) => s + Number(p.premium), 0);
    const renewalPremium = renewals.reduce((s: number, p: any) => s + Number(p.premium), 0);
    const rate = Number(agent.commissionRate) / 100;
    const totalCommission = Math.round(totalPremium * rate * 100) / 100;
    const newBizCommission = Math.round(newBizPremium * rate * 100) / 100;
    const renewalCommission = Math.round(renewalPremium * rate * 100) / 100;

    const statement = await db.commissionStatement.create({
      data: {
        tenantId,
        agentId,
        statementNumber: generateStatementNumber(),
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        totalPremium,
        totalCommission,
        policiesCount: activePolicies.length,
        newBusiness: newBizCommission,
        renewals: renewalCommission,
        notes: notes ? sanitizeInsuranceInput(notes) : null,
      }
    });

    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'create',
      entityType: 'commission_statement',
      entityId: statement.id,
      metadata: { agentId, statementNumber: statement.statementNumber, totalCommission }
    });

    return NextResponse.json(statement, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { id, status, notes } = data;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = sanitizeInsuranceInput(notes);
    if (status === 'approved' || status === 'paid') {
      updateData.approvedBy = auth.payload?.userId || auth.payload?.email || 'system';
      updateData.approvedAt = new Date();
    }

    const statement = await db.commissionStatement.update({
      where: { id, tenantId },
      data: updateData
    });

    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'update',
      entityType: 'commission_statement',
      entityId: id,
      changes: { status: { new: status } }
    });

    return NextResponse.json(statement);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
