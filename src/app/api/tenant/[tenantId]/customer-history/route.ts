import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

// ─── GET: Customer History (list or detail) ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const url = new URL(req.url);
  const customerName = url.searchParams.get('customerName');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    // ─── Customer Detail ───
    if (customerName) {
      const sales = await db.pOSSale.findMany({
        where: {
          tenantId,
          customerName,
          status: 'completed',
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalSpent = sales.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
      const visitCount = sales.length;
      const avgTicket = visitCount > 0 ? totalSpent / visitCount : 0;
      const firstPurchase = sales.length > 0 ? sales[sales.length - 1].createdAt : null;
      const lastPurchase = sales.length > 0 ? sales[0].createdAt : null;

      return NextResponse.json({
        customerName,
        stats: { totalSpent, visitCount, avgTicket, firstPurchase, lastPurchase },
        purchases: sales.map((s) => {
          let items: any[] = [];
          try { items = typeof s.items === 'string' ? JSON.parse(s.items) : (s.items || []); } catch { /* empty */ }
          return { saleNumber: s.saleNumber, date: s.createdAt, items, total: s.totalAmount, paymentMethod: s.paymentMethod, status: s.status };
        }),
      });
    }

    // ─── Customer List (aggregated) via raw SQL (more reliable for GROUP BY) ───
    const customers = await pgQuery<any>(
      `SELECT
        "customerName",
        COUNT(*) as "visitCount",
        COALESCE(SUM("totalAmount"), 0) as "totalSpent",
        COALESCE(AVG("totalAmount"), 0) as "avgTicket",
        MIN("createdAt") as "firstPurchase",
        MAX("createdAt") as "lastPurchase"
      FROM "POSSale"
      WHERE "tenantId" = $1 AND "customerName" IS NOT NULL AND "customerName" != '' AND "status" = 'completed' AND "isDeleted" = false
      GROUP BY "customerName"
      ORDER BY "totalSpent" DESC
      LIMIT 100 OFFSET $2`,
      [tenantId, offset]
    );

    return NextResponse.json(customers);
  } catch (err: any) {
      console.error('[customer-history] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
