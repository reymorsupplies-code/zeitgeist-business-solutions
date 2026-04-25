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
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Policy stats
    const [totalPolicies, activePolicies, expiredPolicies, pendingPolicies] = await Promise.all([
      db.policy.count({ where: { tenantId, isDeleted: false } }),
      db.policy.count({ where: { tenantId, isDeleted: false, status: 'active' } }),
      db.policy.count({ where: { tenantId, isDeleted: false, status: 'expired' } }),
      db.policy.count({ where: { tenantId, isDeleted: false, status: 'pending' } }),
    ]);

    // Premium and coverage totals (active policies)
    const activePolicyAgg = await db.policy.aggregate({
      where: { tenantId, isDeleted: false, status: 'active' },
      _sum: { premium: true, coverage: true, sumInsured: true },
    });

    // Insured count
    const totalInsured = await db.insured.count({ where: { tenantId, isDeleted: false, isActive: true } });

    // Claims stats
    const openClaims = await db.claim.count({
      where: { tenantId, isDeleted: false, status: { notIn: ['closed', 'denied'] } }
    });
    const claimsThisMonth = await db.claim.count({
      where: { tenantId, isDeleted: false, createdAt: { gte: thisMonthStart } }
    });
    const settledClaims = await db.claim.findMany({
      where: { tenantId, isDeleted: false, status: { in: ['settled', 'closed'] }, dateSettled: { not: null }, dateReported: { not: null } },
      select: { dateSettled: true, dateReported: true }
    });
    const avgDaysToSettle = settledClaims.length > 0
      ? Math.round(settledClaims.reduce((sum: number, c: any) => {
          return sum + (new Date(c.dateSettled).getTime() - new Date(c.dateReported).getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / settledClaims.length)
      : 0;

    // Quotes stats
    const pendingQuotes = await db.quote.count({ where: { tenantId, isDeleted: false, status: { in: ['draft', 'sent'] } } });
    const quotesThisMonth = await db.quote.count({ where: { tenantId, isDeleted: false, createdAt: { gte: thisMonthStart } } });

    // Upcoming renewals
    const upcomingRenewals = await db.renewalTask.count({
      where: { tenantId, isDeleted: false, status: { in: ['pending', 'contacted', 'quoted'] }, dueDate: { lte: thirtyDaysFromNow } }
    });

    // Premium collection rate
    const allSchedules = await db.premiumSchedule.findMany({
      where: { tenantId, isDeleted: false }
    });
    const totalDue = allSchedules.reduce((s: number, ps: any) => s + Number(ps.amount), 0);
    const totalPaid = allSchedules.reduce((s: number, ps: any) => s + Number(ps.paidAmount), 0);
    const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

    // Top agents by policy count
    const topAgents = await db.insuranceAgent.findMany({
      where: { tenantId, isDeleted: false, status: 'active' },
      include: { _count: { select: { policies: { where: { isDeleted: false } } } } },
      orderBy: { policies: { _count: 'desc' } },
      take: 5
    });

    // Claims by type
    const claimsByTypeRaw = await db.claim.groupBy({
      by: ['type'],
      where: { tenantId, isDeleted: false },
      _count: true
    });
    const claimsByType = claimsByTypeRaw.map((c: any) => ({ type: c.type, count: c._count }));

    // Policies by type
    const policiesByTypeRaw = await db.policy.groupBy({
      by: ['type'],
      where: { tenantId, isDeleted: false },
      _count: true
    });
    const policiesByType = policiesByTypeRaw.map((p: any) => ({ type: p.type, count: p._count }));

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const [newPolicies, newClaims, premiumCollected] = await Promise.all([
        db.policy.count({ where: { tenantId, isDeleted: false, createdAt: { gte: monthStart, lte: monthEnd } } }),
        db.claim.count({ where: { tenantId, isDeleted: false, createdAt: { gte: monthStart, lte: monthEnd } } }),
        db.premiumSchedule.aggregate({
          where: { tenantId, isDeleted: false, paidDate: { gte: monthStart, lte: monthEnd } },
          _sum: { paidAmount: true }
        }),
      ]);
      monthlyTrend.push({
        month: monthStart.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
        newPolicies,
        newClaims,
        premiumCollected: Number(premiumCollected._sum.paidAmount || 0),
      });
    }

    // Claims by status
    const claimsByStatusRaw = await db.claim.groupBy({
      by: ['status'],
      where: { tenantId, isDeleted: false },
      _count: true
    });
    const claimsByStatus = claimsByStatusRaw.map((c: any) => ({ status: c.status, count: c._count }));

    // Claims reserve and settlement totals
    const claimsAgg = await db.claim.aggregate({
      where: { tenantId, isDeleted: false },
      _sum: { amount: true, reserveAmount: true, settlementAmount: true }
    });

    return NextResponse.json({
      policies: {
        total: totalPolicies,
        active: activePolicies,
        expired: expiredPolicies,
        pending: pendingPolicies,
        byType: policiesByType,
      },
      premium: {
        totalMonthly: Number(activePolicyAgg._sum.premium || 0),
        totalCoverage: Number(activePolicyAgg._sum.coverage || 0),
        totalSumInsured: Number(activePolicyAgg._sum.sumInsured || 0),
        collectionRate,
        totalDue,
        totalPaid,
      },
      insured: { total: totalInsured },
      claims: {
        open: openClaims,
        thisMonth: claimsThisMonth,
        avgDaysToSettle,
        byType: claimsByType,
        byStatus: claimsByStatus,
        totalReserves: Number(claimsAgg._sum.reserveAmount || 0),
        totalSettlements: Number(claimsAgg._sum.settlementAmount || 0),
        totalClaimed: Number(claimsAgg._sum.amount || 0),
      },
      quotes: { pending: pendingQuotes, thisMonth: quotesThisMonth },
      renewals: { upcoming: upcomingRenewals },
      agents: {
        top: topAgents.map((a: any) => ({
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
          agentCode: a.agentCode,
          policies: a._count.policies,
          commissionRate: Number(a.commissionRate),
        }))
      },
      monthlyTrend,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
