import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Pastelería Analytics Dashboard API ──

/**
 * Parse a period string (7d, 30d, 90d, 12m) or custom from/to into date range.
 * Returns { start, end, prevStart, prevEnd } where prev is the equivalent previous period.
 */
function parsePeriod(searchParams: URLSearchParams): {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
} {
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  if (fromParam && toParam) {
    const start = new Date(fromParam);
    const end = new Date(toParam);
    end.setHours(23, 59, 59, 999);
    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs + 1);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      prevStart: prevStart.toISOString(),
      prevEnd: prevEnd.toISOString(),
    };
  }

  const period = searchParams.get('period') || '30d';
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start: Date;
  let prevEnd: Date;
  let prevStart: Date;

  const match = period.match(/^(\d+)(d|m)$/);
  if (!match) {
    // Default to 30d
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      prevStart: prevStart.toISOString(),
      prevEnd: prevEnd.toISOString(),
    };
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === 'd') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - amount);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - amount * 2);
  } else {
    // months
    start = new Date(now.getFullYear(), now.getMonth() - amount, now.getDate());
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - amount * 2, now.getDate());
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString(),
  };
}

// ── Safe query wrappers ──

async function safeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    return await pgQuery<T>(sql, params);
  } catch {
    return [];
  }
}

async function safeQueryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  try {
    return await pgQueryOne<T>(sql, params);
  } catch {
    return null;
  }
}

// ── Revenue metrics ──

async function getRevenueMetrics(tenantId: string, period: ReturnType<typeof parsePeriod>) {
  const result: any = {
    total: 0,
    vsPreviousPeriod: 0,
    daily: [],
    byCategory: [],
    depositRate: 0,
  };

  // Current period total
  const currentTotal = await safeQueryOne<{ total: number }>(
    `SELECT COALESCE(SUM("totalAmount"), 0) as total
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );
  result.total = Number(currentTotal?.total) || 0;

  // Previous period total
  const prevTotal = await safeQueryOne<{ total: number }>(
    `SELECT COALESCE(SUM("totalAmount"), 0) as total
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.prevStart, period.prevEnd]
  );
  const prev = Number(prevTotal?.total) || 0;
  result.vsPreviousPeriod = prev > 0
    ? Math.round(((result.total - prev) / prev) * 1000) / 10
    : (result.total > 0 ? 100 : 0);

  // Daily breakdown
  result.daily = await safeQuery<{ date: string; revenue: number }>(
    `SELECT DATE("createdAt") as date, COALESCE(SUM("totalAmount"), 0) as revenue
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3
     GROUP BY DATE("createdAt")
     ORDER BY date ASC`,
    [tenantId, period.start, period.end]
  );

  // Category breakdown — derived from order items JSON (category field in items array)
  const itemsRows = await safeQuery<{ items: string }>(
    `SELECT "items"
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );

  const categoryMap: Record<string, number> = {};
  for (const row of itemsRows) {
    try {
      const items: any[] = JSON.parse(row.items || '[]');
      for (const item of items) {
        const cat = item.category || item.type || 'Otros';
        categoryMap[cat] = (categoryMap[cat] || 0) + (Number(item.price) || Number(item.total) || 0);
      }
    } catch {
      // skip malformed JSON
    }
  }
  result.byCategory = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  // Deposit rate — orders where depositPaid > 0 vs total orders
  const depositStats = await safeQueryOne<{ with_deposit: number; total: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE COALESCE("depositPaid", 0) > 0) as with_deposit,
       COUNT(*) as total
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3
       AND "totalAmount" > 0`,
    [tenantId, period.start, period.end]
  );
  const depTotal = Number(depositStats?.total) || 0;
  result.depositRate = depTotal > 0
    ? Math.round(((Number(depositStats?.with_deposit) || 0) / depTotal) * 100) / 100
    : 0;

  return result;
}

// ── Order metrics ──

async function getOrderMetrics(tenantId: string, period: ReturnType<typeof parsePeriod>) {
  const result: any = {
    total: 0,
    vsPreviousPeriod: 0,
    byStatus: { pending: 0, confirmed: 0, preparing: 0, completed: 0 },
    avgCompletionDays: 0,
    onlineOrders: 0,
    installmentOrders: 0,
    cancelRate: 0,
  };

  // Current period count
  const currentCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );
  result.total = Number(currentCount?.total) || 0;

  // Previous period count
  const prevCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.prevStart, period.prevEnd]
  );
  const prev = Number(prevCount?.total) || 0;
  result.vsPreviousPeriod = prev > 0
    ? Math.round(((result.total - prev) / prev) * 1000) / 10
    : (result.total > 0 ? 100 : 0);

  // Status distribution
  const statusRows = await safeQuery<{ status: string; count: number }>(
    `SELECT "status", COUNT(*) as count
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3
     GROUP BY "status"`,
    [tenantId, period.start, period.end]
  );
  for (const row of statusRows) {
    const key = row.status as string;
    if (key in result.byStatus) {
      result.byStatus[key] = Number(row.count);
    } else {
      // Handle unknown statuses by adding them dynamically
      (result.byStatus as any)[key] = Number(row.count);
    }
  }

  // Average completion days (for completed orders)
  const avgDays = await safeQueryOne<{ avg_days: number }>(
    `SELECT COALESCE(AVG(
       EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400
     ), 0) as avg_days
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "status" IN ('completed', 'paid', 'delivered')
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );
  result.avgCompletionDays = Math.round((Number(avgDays?.avg_days) || 0) * 10) / 10;

  // Online orders count
  const onlineCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "OnlineOrder"
     WHERE "tenantId" = $1 AND "deletedAt" IS NULL
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );
  result.onlineOrders = Number(onlineCount?.total) || 0;

  // Installment orders (orders with paymentSchedule JSON containing multiple installments)
  const installmentCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3
       AND "paymentSchedule" IS NOT NULL
       AND "paymentSchedule" != ''`,
    [tenantId, period.start, period.end]
  );
  result.installmentOrders = Number(installmentCount?.total) || 0;

  // Cancel rate
  const cancelCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "status" = 'cancelled'
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );
  result.cancelRate = result.total > 0
    ? Math.round(((Number(cancelCount?.total) || 0) / result.total) * 100) / 100
    : 0;

  return result;
}

// ── Product metrics ──

async function getProductMetrics(tenantId: string, period: ReturnType<typeof parsePeriod>) {
  const result: any = {
    topSellers: [],
    lowMargin: [],
    totalProducts: 0,
    avgMargin: 0,
  };

  // Parse order items to calculate product-level sales
  const itemsRows = await safeQuery<{ items: string }>(
    `SELECT "items"
     FROM "Order"
     WHERE "tenantId" = $1 AND "isDeleted" = false
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );

  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};

  for (const row of itemsRows) {
    try {
      const items: any[] = JSON.parse(row.items || '[]');
      for (const item of items) {
        const key = (item.name || item.id || 'Desconocido').toLowerCase().trim();
        if (!productMap[key]) {
          productMap[key] = { name: item.name || item.id || 'Desconocido', qty: 0, revenue: 0 };
        }
        const qty = Number(item.qty) || Number(item.quantity) || 1;
        const price = Number(item.price) || Number(item.total) || 0;
        productMap[key].qty += qty;
        productMap[key].revenue += price;
      }
    } catch {
      // skip malformed JSON
    }
  }

  result.topSellers = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(p => ({ name: p.name, qty: p.qty, revenue: Math.round(p.revenue * 100) / 100 }));

  // CatalogItem margins
  const catalogItems = await safeQuery<{ name: string; price: number; cost: number }>(
    `SELECT name, price, cost FROM "CatalogItem"
     WHERE "tenantId" = $1 AND "isDeleted" = false AND price > 0`,
    [tenantId]
  );

  // RetailProduct margins
  const retailItems = await safeQuery<{ name: string; price: number; cost: number }>(
    `SELECT name, price, cost FROM "RetailProduct"
     WHERE "tenantId" = $1 AND "isDeleted" = false AND price > 0`,
    [tenantId]
  );

  const allProducts = [...catalogItems, ...retailItems];
  result.totalProducts = allProducts.length;

  const margins: number[] = [];
  const lowMarginList: { name: string; margin: number }[] = [];

  for (const item of allProducts) {
    const price = Number(item.price) || 0;
    const cost = Number(item.cost) || 0;
    if (price > 0) {
      const margin = Math.round(((price - cost) / price) * 100);
      margins.push(margin);
      if (margin < 25) {
        lowMarginList.push({ name: item.name, margin });
      }
    }
  }

  result.avgMargin = margins.length > 0
    ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10
    : 0;
  result.lowMargin = lowMarginList.sort((a, b) => a.margin - b.margin).slice(0, 10);

  return result;
}

// ── Tasting metrics ──

async function getTastingMetrics(tenantId: string, period: ReturnType<typeof parsePeriod>) {
  const result: any = {
    total: 0,
    conversionRate: 0,
    upcoming: 0,
    byFlavor: [],
  };

  // Total tastings in period
  const totalCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "TastingBooking"
     WHERE "tenantId" = $1
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );
  result.total = Number(totalCount?.total) || 0;

  // Conversion rate: completed tastings / total tastings
  const completedCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "TastingBooking"
     WHERE "tenantId" = $1 AND "status" = 'completed'
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );
  const completed = Number(completedCount?.total) || 0;
  result.conversionRate = result.total > 0
    ? Math.round((completed / result.total) * 100) / 100
    : 0;

  // Upcoming tastings (requested or confirmed, future date)
  const upcomingCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "TastingBooking"
     WHERE "tenantId" = $1
       AND "status" IN ('requested', 'confirmed')
       AND "date" >= CURRENT_DATE`,
    [tenantId]
  );
  result.upcoming = Number(upcomingCount?.total) || 0;

  // Flavor breakdown — parse flavors JSON array from all tastings in period
  const flavorRows = await safeQuery<{ flavors: string }>(
    `SELECT flavors
     FROM "TastingBooking"
     WHERE "tenantId" = $1
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );

  const flavorMap: Record<string, number> = {};
  for (const row of flavorRows) {
    try {
      const flavors: any[] = JSON.parse(row.flavors || '[]');
      for (const f of flavors) {
        const name = typeof f === 'string' ? f : ((f as any).name || (f as any).flavor || '');
        if (name) {
          flavorMap[name] = (flavorMap[name] || 0) + 1;
        }
      }
    } catch {
      // skip malformed JSON
    }
  }
  result.byFlavor = Object.entries(flavorMap)
    .map(([flavor, count]) => ({ flavor, count }))
    .sort((a, b) => b.count - a.count);

  return result;
}

// ── Loyalty metrics ──

async function getLoyaltyMetrics(tenantId: string, period: ReturnType<typeof parsePeriod>) {
  const result: any = {
    totalMembers: 0,
    newThisPeriod: 0,
    tierDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
  };

  // Total members
  const memberCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM "LoyaltyMember" WHERE "tenantId" = $1`,
    [tenantId]
  );
  result.totalMembers = Number(memberCount?.total) || 0;

  // New members this period
  const newCount = await safeQueryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM "LoyaltyMember"
     WHERE "tenantId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3`,
    [tenantId, period.start, period.end]
  );
  result.newThisPeriod = Number(newCount?.total) || 0;

  // Tier distribution
  const tierRows = await safeQuery<{ tier: string; count: number }>(
    `SELECT tier, COUNT(*) as count
     FROM "LoyaltyMember"
     WHERE "tenantId" = $1
     GROUP BY tier`,
    [tenantId]
  );
  for (const row of tierRows) {
    const key = (row.tier || 'bronze').toLowerCase();
    if (key in result.tierDistribution) {
      result.tierDistribution[key] = Number(row.count);
    }
  }

  // Points issued vs redeemed in period
  const pointsStats = await safeQuery<{ type: string; total: number }>(
    `SELECT type, COALESCE(SUM(ABS("points")), 0) as total
     FROM "LoyaltyTransaction"
     WHERE "tenantId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
     GROUP BY type`,
    [tenantId, period.start, period.end]
  );
  for (const row of pointsStats) {
    if (row.type === 'earn') {
      result.totalPointsIssued = Number(row.total) || 0;
    } else if (row.type === 'redeem' || row.type === 'burn') {
      result.totalPointsRedeemed = Number(row.total) || 0;
    }
  }

  return result;
}

// ── GET handler ──

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric');
    const period = parsePeriod(searchParams);

    // ── Single metric request ──
    if (metric === 'revenue') {
      return NextResponse.json(await getRevenueMetrics(tenantId, period));
    }
    if (metric === 'orders') {
      return NextResponse.json(await getOrderMetrics(tenantId, period));
    }
    if (metric === 'products') {
      return NextResponse.json(await getProductMetrics(tenantId, period));
    }
    if (metric === 'tastings') {
      return NextResponse.json(await getTastingMetrics(tenantId, period));
    }
    if (metric === 'loyalty') {
      return NextResponse.json(await getLoyaltyMetrics(tenantId, period));
    }

    // ── Full dashboard (no metric param) ──
    const [revenue, orders, products, tastings, loyalty] = await Promise.all([
      getRevenueMetrics(tenantId, period),
      getOrderMetrics(tenantId, period),
      getProductMetrics(tenantId, period),
      getTastingMetrics(tenantId, period),
      getLoyaltyMetrics(tenantId, period),
    ]);

    return NextResponse.json({
      revenue,
      orders,
      products,
      tastings,
      loyalty,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
