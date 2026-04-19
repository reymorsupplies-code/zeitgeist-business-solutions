import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/pg-query';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';

// ─── GET: Low stock alerts ───
// Returns all raw materials where quantity <= minStock
// Also includes items approaching expiry (expiryDate within next 7 days)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth guard
  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    // Low stock items: quantity <= minStock
    const lowStockItems = await pgQuery<any>(
      `SELECT * FROM "RawMaterial"
       WHERE "tenantId" = $1 AND "isDeleted" = false AND quantity <= "minStock"
       ORDER BY quantity ASC`,
      [tenantId]
    );

    // Expiring soon items: expiryDate within next 7 days
    const expiringItems = await pgQuery<any>(
      `SELECT * FROM "RawMaterial"
       WHERE "tenantId" = $1 AND "isDeleted" = false
         AND "expiryDate" IS NOT NULL
         AND "expiryDate" <= NOW() + INTERVAL '7 days'
         AND "expiryDate" >= NOW()
       ORDER BY "expiryDate" ASC`,
      [tenantId]
    );

    // Expired items: expiryDate in the past
    const expiredItems = await pgQuery<any>(
      `SELECT * FROM "RawMaterial"
       WHERE "tenantId" = $1 AND "isDeleted" = false
         AND "expiryDate" IS NOT NULL
         AND "expiryDate" < NOW()
       ORDER BY "expiryDate" ASC`,
      [tenantId]
    );

    // Build alert list
    const alerts: any[] = [];

    for (const item of lowStockItems) {
      alerts.push({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        minStock: item.minStock,
        unit: item.unit,
        type: 'low_stock',
        message: `${item.name} is low on stock (${item.quantity} ${item.unit || 'units'} remaining, min: ${item.minStock})`,
      });
    }

    for (const item of expiringItems) {
      alerts.push({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        expiryDate: item.expiryDate,
        type: 'expiring_soon',
        message: `${item.name} expires on ${item.expiryDate}`,
      });
    }

    for (const item of expiredItems) {
      alerts.push({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        expiryDate: item.expiryDate,
        type: 'expired',
        message: `${item.name} expired on ${item.expiryDate}`,
      });
    }

    return NextResponse.json({
      summary: {
        lowStockCount: lowStockItems.length,
        expiringSoonCount: expiringItems.length,
        expiredCount: expiredItems.length,
        totalAlerts: alerts.length,
      },
      alerts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
