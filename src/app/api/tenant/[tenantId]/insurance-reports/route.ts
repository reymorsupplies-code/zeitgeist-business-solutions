import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'portfolio_summary';
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = startDate;
      if (endDate) dateFilter.createdAt.lte = endDate;
    }

    switch (action) {
      case 'portfolio_summary': return generatePortfolioSummary(tenantId, dateFilter);
      case 'claims_analytics': return generateClaimsAnalytics(tenantId, dateFilter);
      case 'agent_performance': return generateAgentPerformance(tenantId, dateFilter);
      case 'renewal_pipeline': return generateRenewalPipeline(tenantId, dateFilter);
      case 'premium_collection': return generatePremiumCollection(tenantId, dateFilter);
      case 'regulatory_quarterly': return generateRegulatoryQuarterly(tenantId);
      default: return NextResponse.json({ error: 'Unknown report action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function generatePortfolioSummary(tenantId: string, dateFilter: any) {
  const where: any = { tenantId, isDeleted: false, ...dateFilter };

  const [policies, byType, byStatus, byAgent, premiumAgg] = await Promise.all([
    db.policy.findMany({ where, include: { product: { select: { name: true, category: true } }, agent: { select: { id: true, firstName: true, lastName: true } } } }),
    db.policy.groupBy({ by: ['type'], where, _count: true, _sum: { premium: true, coverage: true } }),
    db.policy.groupBy({ by: ['status'], where, _count: true, _sum: { premium: true } }),
    db.policy.groupBy({ by: ['agentId'], where, _count: true, _sum: { premium: true } }),
    db.policy.aggregate({ where, _sum: { premium: true, coverage: true, sumInsured: true } }),
  ]);

  // Get agent names for the grouped data
  const agentIds = [...new Set(byAgent.map((a: any) => a.agentId).filter(Boolean))] as string[];
  const agents = agentIds.length > 0 ? await db.insuranceAgent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, firstName: true, lastName: true }
  }) : [];
  const agentMap = Object.fromEntries(agents.map((a: any) => [a.id, `${a.firstName} ${a.lastName}`]));

  return NextResponse.json({
    reportType: 'portfolio_summary',
    generatedAt: new Date().toISOString(),
    totalPolicies: policies.length,
    totalPremium: Number(premiumAgg._sum.premium || 0),
    totalCoverage: Number(premiumAgg._sum.coverage || 0),
    totalSumInsured: Number(premiumAgg._sum.sumInsured || 0),
    byType: byType.map((t: any) => ({ type: t.type, count: t._count, premium: Number(t._sum.premium), coverage: Number(t._sum.coverage) })),
    byStatus: byStatus.map((s: any) => ({ status: s.status, count: s._count, premium: Number(s._sum.premium) })),
    byAgent: byAgent.map((a: any) => ({ agentId: a.agentId, agentName: a.agentId ? agentMap[a.agentId] : 'Unassigned', policies: a._count, premium: Number(a._sum.premium) })),
    policies: policies.slice(0, 100).map((p: any) => ({
      id: p.id, policyNumber: p.policyNumber, type: p.type, status: p.status,
      premium: Number(p.premium), coverage: Number(p.coverage),
      productName: (p as any).product?.name, startDate: p.startDate, endDate: p.endDate,
    })),
  });
}

async function generateClaimsAnalytics(tenantId: string, dateFilter: any) {
  const where: any = { tenantId, isDeleted: false, ...dateFilter };
  const [claims, byType, byStatus, byPriority, agg] = await Promise.all([
    db.claim.findMany({ where, include: { policy: { select: { policyNumber: true, type: true } } } }),
    db.claim.groupBy({ by: ['type'], where, _count: true, _sum: { amount: true, settlementAmount: true } }),
    db.claim.groupBy({ by: ['status'], where, _count: true }),
    db.claim.groupBy({ by: ['priority'], where, _count: true }),
    db.claim.aggregate({ where, _sum: { amount: true, reserveAmount: true, settlementAmount: true }, _avg: { amount: true } }),
  ]);

  // Settlement time analysis
  const settled = claims.filter((c: any) => c.dateSettled && c.dateReported);
  const settlementTimes = settled.map((c: any) => Math.round((new Date(c.dateSettled).getTime() - new Date(c.dateReported).getTime()) / (1000 * 60 * 60 * 24)));
  const avgSettlementDays = settlementTimes.length > 0 ? Math.round(settlementTimes.reduce((a: number, b: number) => a + b, 0) / settlementTimes.length) : 0;
  const medianSettlementDays = settlementTimes.length > 0 ? settlementTimes.sort((a: number, b: number) => a - b)[Math.floor(settlementTimes.length / 2)] : 0;

  // Loss ratio = total claims paid / total premiums earned
  const premiumEarned = await db.policy.aggregate({
    where: { tenantId, isDeleted: false, status: 'active' },
    _sum: { premium: true }
  });
  const lossRatio = Number(premiumEarned._sum.premium || 0) > 0
    ? (Number(agg._sum.settlementAmount || 0) / Number(premiumEarned._sum.premium || 0)) * 100
    : 0;

  return NextResponse.json({
    reportType: 'claims_analytics',
    generatedAt: new Date().toISOString(),
    totalClaims: claims.length,
    totalClaimed: Number(agg._sum.amount || 0),
    totalReserves: Number(agg._sum.reserveAmount || 0),
    totalSettlements: Number(agg._sum.settlementAmount || 0),
    avgClaimAmount: Number(agg._avg.amount || 0),
    avgSettlementDays,
    medianSettlementDays,
    lossRatio: Math.round(lossRatio * 100) / 100,
    byType: byType.map((t: any) => ({ type: t.type, count: t._count, amount: Number(t._sum.amount), settled: Number(t._sum.settlementAmount) })),
    byStatus: byStatus.map((s: any) => ({ status: s.status, count: s._count })),
    byPriority: byPriority.map((p: any) => ({ priority: p.priority, count: p._count })),
  });
}

async function generateAgentPerformance(tenantId: string, dateFilter: any) {
  const agents = await db.insuranceAgent.findMany({
    where: { tenantId, isDeleted: false, status: 'active' },
    include: {
      policies: { where: { isDeleted: false, ...dateFilter }, include: { claims: { where: { isDeleted: false } } } },
    }
  });

  const performance = agents.map((agent: any) => {
    const policies = agent.policies;
    const activePolicies = policies.filter((p: any) => p.status === 'active');
    const totalPremium = policies.reduce((s: number, p: any) => s + Number(p.premium), 0);
    const totalCoverage = policies.reduce((s: number, p: any) => s + Number(p.coverage), 0);
    const allClaims = policies.flatMap((p: any) => p.claims);
    const openClaims = allClaims.filter((c: any) => !['closed', 'denied'].includes(c.status));
    const totalClaimed = allClaims.reduce((s: number, c: any) => s + Number(c.amount), 0);
    const commission = totalPremium * (Number(agent.commissionRate) / 100);
    const claimsRatio = totalPremium > 0 ? (totalClaimed / totalPremium) * 100 : 0;

    return {
      id: agent.id,
      agentCode: agent.agentCode,
      name: `${agent.firstName} ${agent.lastName}`,
      email: agent.email,
      phone: agent.phone,
      commissionRate: Number(agent.commissionRate),
      totalPolicies: policies.length,
      activePolicies: activePolicies.length,
      totalPremium,
      totalCoverage,
      openClaims: openClaims.length,
      totalClaims: allClaims.length,
      totalClaimed,
      claimsRatio: Math.round(claimsRatio * 100) / 100,
      commissionOwed: Math.round(commission * 100) / 100,
    };
  });

  // Sort by commission owed descending
  performance.sort((a: any, b: any) => b.commissionOwed - a.commissionOwed);

  return NextResponse.json({
    reportType: 'agent_performance',
    generatedAt: new Date().toISOString(),
    totalAgents: performance.length,
    totalCommissionOwed: performance.reduce((s: number, a: any) => s + a.commissionOwed, 0),
    agents: performance,
  });
}

async function generateRenewalPipeline(tenantId: string, dateFilter: any) {
  const where: any = { tenantId, isDeleted: false, ...dateFilter };
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [allTasks, byStatus, overdueTasks] = await Promise.all([
    db.renewalTask.findMany({ where, include: { policy: { select: { policyNumber: true, type: true, premium: true, insuredId: true } } } }),
    db.renewalTask.groupBy({ by: ['status'], where, _count: true }),
    db.renewalTask.findMany({
      where: { ...where, status: { in: ['pending', 'contacted'] }, dueDate: { lt: now } },
      include: { policy: { select: { policyNumber: true, premium: true } } }
    }),
  ]);

  const dueWithin30 = allTasks.filter((t: any) => t.dueDate && t.dueDate <= thirtyDays && t.dueDate >= now && !['renewed', 'cancelled'].includes(t.status));
  const dueWithin60 = allTasks.filter((t: any) => t.dueDate && t.dueDate <= sixtyDays && t.dueDate > thirtyDays && !['renewed', 'cancelled'].includes(t.status));
  const dueWithin90 = allTasks.filter((t: any) => t.dueDate && t.dueDate <= ninetyDays && t.dueDate > sixtyDays && !['renewed', 'cancelled'].includes(t.status));

  const renewedCount = allTasks.filter((t: any) => t.status === 'renewed').length;
  const totalRenewable = allTasks.filter((t: any) => !['cancelled'].includes(t.status)).length;
  const retentionRate = totalRenewable > 0 ? Math.round((renewedCount / totalRenewable) * 100) : 0;

  const atRiskPremium = overdueTasks.reduce((s: number, t: any) => s + Number((t.policy as any)?.premium || 0), 0);

  return NextResponse.json({
    reportType: 'renewal_pipeline',
    generatedAt: new Date().toISOString(),
    totalTasks: allTasks.length,
    retentionRate,
    byStatus: byStatus.map((s: any) => ({ status: s.status, count: s._count })),
    dueWithin30Days: { count: dueWithin30.length, tasks: dueWithin30.slice(0, 20) },
    dueWithin60Days: { count: dueWithin60.length },
    dueWithin90Days: { count: dueWithin90.length },
    overdue: { count: overdueTasks.length, atRiskPremium, tasks: overdueTasks.slice(0, 20) },
  });
}

async function generatePremiumCollection(tenantId: string, dateFilter: any) {
  const where: any = { tenantId, isDeleted: false, ...dateFilter };
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const schedules = await db.premiumSchedule.findMany({
    where,
    include: { policy: { select: { policyNumber: true, type: true, product: { select: { name: true } } } } },
    orderBy: { dueDate: 'asc' }
  });

  const totalAmount = schedules.reduce((s: number, ps: any) => s + Number(ps.amount), 0);
  const totalPaid = schedules.reduce((s: number, ps: any) => s + Number(ps.paidAmount), 0);
  const outstanding = totalAmount - totalPaid;

  // Aging buckets
  const current = schedules.filter((s: any) => s.status === 'pending' && s.dueDate && s.dueDate >= now);
  const bucket30 = schedules.filter((s: any) => (s.status === 'pending' || s.status === 'overdue') && s.dueDate && s.dueDate < now && s.dueDate >= thirtyDaysAgo);
  const bucket60 = schedules.filter((s: any) => (s.status === 'pending' || s.status === 'overdue') && s.dueDate && s.dueDate < thirtyDaysAgo && s.dueDate >= sixtyDaysAgo);
  const bucket90 = schedules.filter((s: any) => (s.status === 'pending' || s.status === 'overdue') && s.dueDate && s.dueDate < sixtyDaysAgo && s.dueDate >= ninetyDaysAgo);
  const bucket90Plus = schedules.filter((s: any) => (s.status === 'pending' || s.status === 'overdue') && s.dueDate && s.dueDate < ninetyDaysAgo);

  const sumBucket = (items: any[]) => items.reduce((s: number, i: any) => s + (Number(i.amount) - Number(i.paidAmount)), 0);

  // By policy type
  const byTypeRaw = await db.premiumSchedule.groupBy({
    by: ['policyId'],
    where,
  });
  const policyIds = byTypeRaw.map((r: any) => r.policyId);
  const policyTypes = policyIds.length > 0 ? await db.policy.findMany({
    where: { id: { in: policyIds } },
    select: { id: true, type: true }
  }) : [];
  const typeMap = Object.fromEntries(policyTypes.map((p: any) => [p.id, p.type]));

  return NextResponse.json({
    reportType: 'premium_collection',
    generatedAt: new Date().toISOString(),
    totalAmount,
    totalPaid,
    outstanding,
    collectionRate: totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0,
    agingBuckets: {
      current: { count: current.length, amount: sumBucket(current) },
      days30: { count: bucket30.length, amount: sumBucket(bucket30) },
      days60: { count: bucket60.length, amount: sumBucket(bucket60) },
      days90: { count: bucket90.length, amount: sumBucket(bucket90) },
      days90Plus: { count: bucket90Plus.length, amount: sumBucket(bucket90Plus) },
    },
    totalSchedules: schedules.length,
    paidSchedules: schedules.filter((s: any) => s.status === 'paid').length,
    overdueSchedules: schedules.filter((s: any) => s.status === 'overdue').length,
  });
}

async function generateRegulatoryQuarterly(tenantId: string) {
  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59);

  const [policies, claims, premiums, agents] = await Promise.all([
    db.policy.findMany({ where: { tenantId, isDeleted: false, createdAt: { gte: quarterStart, lte: quarterEnd } } }),
    db.claim.findMany({ where: { tenantId, isDeleted: false, createdAt: { gte: quarterStart, lte: quarterEnd } } }),
    db.premiumSchedule.findMany({ where: { tenantId, isDeleted: false, paidDate: { gte: quarterStart, lte: quarterEnd } } }),
    db.insuranceAgent.findMany({ where: { tenantId, isDeleted: false, status: 'active' } }),
  ]);

  const activePolicies = await db.policy.count({ where: { tenantId, isDeleted: false, status: 'active' } });
  const totalPremiumWritten = policies.reduce((s: number, p: any) => s + Number(p.premium), 0);
  const totalCoverageIssued = policies.reduce((s: number, p: any) => s + Number(p.coverage), 0);
  const totalClaimsReceived = claims.length;
  const totalClaimsAmount = claims.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalPremiumCollected = premiums.reduce((s: number, p: any) => s + Number(p.paidAmount), 0);
  const openClaims = claims.filter((c: any) => !['closed', 'denied'].includes(c.status)).length;
  const settledClaims = claims.filter((c: any) => ['settled', 'closed'].includes(c.status));

  return NextResponse.json({
    reportType: 'regulatory_quarterly',
    generatedAt: new Date().toISOString(),
    reportingPeriod: { start: quarterStart.toISOString(), end: quarterEnd.toISOString() },
    submittedTo: 'Financial Services Commission (FSC) - Trinidad & Tobago',
    summary: {
      activePoliciesAtEndOfQuarter: activePolicies,
      newPoliciesThisQuarter: policies.length,
      totalPremiumWritten: totalPremiumWritten,
      totalCoverageIssued: totalCoverageIssued,
      totalPremiumCollected: totalPremiumCollected,
      totalClaimsReceived: totalClaimsReceived,
      totalClaimsAmount,
      openClaimsAtEndOfQuarter: openClaims,
      settledClaimsThisQuarter: settledClaims.length,
      totalSettlementsPaid: settledClaims.reduce((s: number, c: any) => s + Number(c.settlementAmount), 0),
      activeAgents: agents.length,
    },
    policiesByType: Object.entries(
      policies.reduce((acc: any, p: any) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {})
    ).map(([type, count]) => ({ type, count })),
    claimsByType: Object.entries(
      claims.reduce((acc: any, c: any) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {})
    ).map(([type, count]) => ({ type, count })),
  });
}
