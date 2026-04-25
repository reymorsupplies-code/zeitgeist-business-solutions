import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth check
  const auth = authenticateRequest(_req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });

  try {
    // Fetch tenant with industry info
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, industryId: true, name: true }
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Determine industry
    const industry = tenant.industryId
      ? await db.industry.findUnique({
          where: { id: tenant.industryId },
          select: { id: true, slug: true, name: true }
        })
      : null;

    // Route to industry-specific dashboard handler
    if (industry && (industry.slug === 'insurance' || industry.name?.toLowerCase().includes('insurance'))) {
      return handleInsuranceDashboard(tenantId);
    }

    // Default: bakery / general business dashboard
    return handleDefaultDashboard(tenantId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Insurance Dashboard ────────────────────────────────────────────────────────

async function handleInsuranceDashboard(tenantId: string) {
  const [
    activePolicies,
    openClaims,
    totalInsured,
    pendingQuotes,
    upcomingRenewals,
  ] = await Promise.all([
    db.policy.count({ where: { tenantId, isDeleted: false, status: 'active' } }),
    db.claim.count({ where: { tenantId, isDeleted: false, status: { notIn: ['closed', 'denied'] } } }),
    db.insured.count({ where: { tenantId, isDeleted: false, isActive: true } }),
    db.quote.count({ where: { tenantId, isDeleted: false, status: { in: ['draft', 'sent'] } } }),
    db.renewalTask.count({
      where: {
        tenantId,
        isDeleted: false,
        status: { in: ['pending', 'contacted'] },
        dueDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const premiumAgg = await db.policy.aggregate({
    where: { tenantId, isDeleted: false, status: 'active' },
    _sum: { premium: true, coverage: true },
  });

  return NextResponse.json({
    industry: 'insurance',
    activePolicies,
    openClaims,
    totalInsured,
    pendingQuotes,
    upcomingRenewals,
    monthlyPremium: Number(premiumAgg._sum.premium || 0),
    totalCoverage: Number(premiumAgg._sum.coverage || 0),
  });
}

// ─── Default (Bakery / General Business) Dashboard ──────────────────────────────

async function handleDefaultDashboard(tenantId: string) {
  const [orders, invoices, payments, clients, expenses, catalogItems] = await Promise.all([
    db.order.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } }),
    db.invoice.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } }),
    db.payment.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } }),
    db.client.findMany({ where: { tenantId, isDeleted: false } }),
    db.expense.findMany({ where: { tenantId, isDeleted: false } }),
    db.catalogItem.findMany({ where: { tenantId, isDeleted: false } }),
  ]);

  const totalRevenue = payments.reduce((s, p) => s + p.amount.toNumber(), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount.toNumber(), 0);
  const overdueInvoices = invoices.filter(
    i => i.status === 'overdue' || (i.balanceDue.toNumber() > 0 && i.dueDate && new Date(i.dueDate) < new Date())
  ).length;

  return NextResponse.json({
    industry: 'general',
    orders: { total: orders.length, pending: pendingOrders, list: orders.slice(0, 5) },
    revenue: {
      total: totalRevenue,
      thisMonth: payments
        .filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth())
        .reduce((s, p) => s + p.amount.toNumber(), 0),
    },
    clients: { total: clients.length },
    expenses: { total: totalExpenses },
    invoices: { total: invoices.length, overdue: overdueInvoices },
    catalog: { total: catalogItems.length },
  });
}
