import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  try {
    const orders = await db.order.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    const invoices = await db.invoice.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    const payments = await db.payment.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    const clients = await db.client.findMany({ where: { tenantId, isDeleted: false } });
    const expenses = await db.expense.findMany({ where: { tenantId, isDeleted: false } });
    const catalogItems = await db.catalogItem.findMany({ where: { tenantId, isDeleted: false } });
    
    const totalRevenue = payments.reduce((s, p) => s + p.amount.toNumber(), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const totalExpenses = expenses.reduce((s, e) => s + e.amount.toNumber(), 0);
    const overdueInvoices = invoices.filter(i => i.status === 'overdue' || (i.balanceDue.toNumber() > 0 && i.dueDate && new Date(i.dueDate) < new Date())).length;
    
    return NextResponse.json({
      orders: { total: orders.length, pending: pendingOrders, list: orders.slice(0, 5) },
      revenue: { total: totalRevenue, thisMonth: payments.filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth()).reduce((s, p) => s + p.amount.toNumber(), 0) },
      clients: { total: clients.length },
      expenses: { total: totalExpenses },
      invoices: { total: invoices.length, overdue: overdueInvoices },
      catalog: { total: catalogItems.length },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
