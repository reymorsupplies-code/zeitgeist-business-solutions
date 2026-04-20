import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { randomUUID } from 'crypto';

// ── Smart Notifications API for ZBS (Bakery/Cake Shop SaaS) ──

// Allowed notification types
const VALID_TYPES = ['order', 'tasting', 'design', 'system', 'loyalty'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

// ── Ensure Notification table exists ──
async function ensureNotificationTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "userId" TEXT,
      "type" TEXT NOT NULL DEFAULT 'system',
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "data" TEXT DEFAULT '{}',
      "priority" TEXT NOT NULL DEFAULT 'normal',
      "read" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TEXT NOT NULL,
      "expiresAt" TEXT
    )
  `);
}

// ── Auto-expire old notifications (30 days) ──
async function expireOldNotifications(tenantId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  await pgQuery(
    `DELETE FROM "Notification" WHERE "tenantId" = $1 AND "createdAt" < $2`,
    [tenantId, thirtyDaysAgo.toISOString()]
  );
}

// ── GET: Fetch notifications with filtering, pagination ──
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureNotificationTable();
    await expireOldNotifications(tenantId);

    const url = new URL(_req.url);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20') || 20, 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0);
    const type = url.searchParams.get('type');

    // Build dynamic query
    const conditions: string[] = [`"tenantId" = $1`];
    const params: any[] = [tenantId];
    let paramIdx = 2;

    // Filter by user: show user-specific OR broadcast (userId IS NULL) notifications
    conditions.push(`("userId" IS NULL OR "userId" = $${paramIdx++})`);
    params.push(auth.payload?.userId);

    // Filter unread only
    if (unreadOnly) {
      conditions.push(`"read" = false`);
    }

    // Filter by type
    if (type && VALID_TYPES.includes(type)) {
      conditions.push(`"type" = $${paramIdx++}`);
      params.push(type);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count for pagination metadata
    const countRow = await pgQueryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM "Notification" WHERE ${whereClause}`,
      params
    );

    // Fetch notifications
    const notifications = await pgQuery(
      `SELECT * FROM "Notification" WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    // Parse data JSON for each notification
    const parsed = notifications.map((n: any) => ({
      ...n,
      data: typeof n.data === 'string' ? JSON.parse(n.data) : (n.data || {}),
    }));

    return NextResponse.json({
      notifications: parsed,
      total: parseInt(countRow?.count || '0'),
      unreadCount: parsed.filter((n: any) => !n.read).length,
      limit,
      offset,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Create notification (manual or broadcast or system trigger) ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    await ensureNotificationTable();

    const data = await req.json();

    // ── System-triggered notification actions ──
    if (data._action) {
      return handleTriggerAction(tenantId, auth, data);
    }

    // ── Manual notification creation ──
    const { userId, type, title, body, data: notifData, priority } = data;

    // Validate required fields
    if (!title || !body) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
    }
    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` }, { status: 400 });
    }

    const notifType = type || 'system';
    const notifPriority = priority || 'normal';
    const notifDataStr = notifData ? JSON.stringify(notifData) : '{}';
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    if (!userId) {
      // ── Broadcast to all users in the tenant ──
      const teamMembers = await pgQuery<{ id: string }>(
        `SELECT id FROM "TeamMember" WHERE "tenantId" = $1 AND "isActive" = true`,
        [tenantId]
      );

      if (teamMembers.length > 0) {
        const values = teamMembers
          .map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6}, $${i * 6 + 7}, $${i * 6 + 8})`)
          .join(', ');

        const insertParams: any[] = [];
        for (const member of teamMembers) {
          insertParams.push(
            id + '_' + member.id, // unique id per recipient
            tenantId,
            member.id,
            notifType,
            title,
            body,
            notifDataStr,
            notifPriority,
            createdAt
          );
        }

        await pgQuery(
          `INSERT INTO "Notification" ("id", "tenantId", "userId", "type", "title", "body", "data", "priority", "read", "createdAt") VALUES ${values}`,
          insertParams
        );
      } else {
        // No team members — insert a single broadcast notification (userId = NULL)
        await pgQuery(
          `INSERT INTO "Notification" ("id", "tenantId", "userId", "type", "title", "body", "data", "priority", "read", "createdAt") VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, false, $8)`,
          [id, tenantId, notifType, title, body, notifDataStr, notifPriority, createdAt]
        );
      }

      return NextResponse.json({
        success: true,
        broadcast: true,
        recipientCount: teamMembers.length || 1,
        type: notifType,
        title,
      });
    }

    // ── Single user notification ──
    await pgQuery(
      `INSERT INTO "Notification" ("id", "tenantId", "userId", "type", "title", "body", "data", "priority", "read", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9)`,
      [id, tenantId, userId, notifType, title, body, notifDataStr, notifPriority, createdAt]
    );

    const notification = await pgQueryOne(`SELECT * FROM "Notification" WHERE id = $1`, [id]);
    return NextResponse.json({
      success: true,
      notification: {
        ...notification,
        data: typeof notification?.data === 'string' ? JSON.parse(notification.data) : {},
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT: Mark as read / mark all as read / mark all by type as read ──
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureNotificationTable();

    const body = await req.json();

    // ── Mark specific notifications as read ──
    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
      await pgQuery(
        `UPDATE "Notification" SET "read" = true WHERE "tenantId" = $1 AND id = ANY($2)`,
        [tenantId, body.ids]
      );
      return NextResponse.json({ success: true, markedCount: body.ids.length });
    }

    // ── Mark single notification as read ──
    if (body.id) {
      await pgQuery(
        `UPDATE "Notification" SET "read" = $1 WHERE "tenantId" = $2 AND id = $3`,
        [body.read !== undefined ? body.read : true, tenantId, body.id]
      );
      return NextResponse.json({ success: true, id: body.id });
    }

    // ── Mark all as read ──
    if (body.readAll) {
      const result = await pgQuery(
        `UPDATE "Notification" SET "read" = true WHERE "tenantId" = $1 AND ("userId" IS NULL OR "userId" = $2) AND "read" = false`,
        [tenantId, auth.payload?.userId]
      );
      return NextResponse.json({ success: true, markedCount: result.length });
    }

    // ── Mark all as read for a specific type ──
    if (body.readAllType) {
      const type = body.readAllType;
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
      }
      const result = await pgQuery(
        `UPDATE "Notification" SET "read" = true WHERE "tenantId" = $1 AND "type" = $2 AND ("userId" IS NULL OR "userId" = $3) AND "read" = false`,
        [tenantId, type, auth.payload?.userId]
      );
      return NextResponse.json({ success: true, type, markedCount: result.length });
    }

    return NextResponse.json({ error: 'No valid operation specified. Use { id }, { ids }, { readAll }, or { readAllType }' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Remove a notification ──
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await ensureNotificationTable();

    const deleted = await pgQuery(
      `DELETE FROM "Notification" WHERE "tenantId" = $1 AND id = $2 RETURNING id`,
      [tenantId, id]
    );

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── System-Triggered Notification Actions ──
async function handleTriggerAction(
  tenantId: string,
  auth: { payload: { userId?: string } | null },
  data: Record<string, any>
): Promise<NextResponse> {
  const { _action, orderData, tastingData, designData, productData } = data;

  let title = '';
  let body = '';
  let type = 'system';
  let priority = 'normal';
  let notifData = {};

  switch (_action) {
    case 'order_new': {
      if (!orderData) return NextResponse.json({ error: 'orderData is required' }, { status: 400 });
      const clientName = orderData.clientName || orderData.customerName || 'Unknown client';
      const orderNumber = orderData.orderNumber || '';
      title = `New online order from ${clientName}`;
      body = `Order #${orderNumber} received — ${orderData.items?.length || 0} item(s), $${orderData.totalAmount || 0}`;
      type = 'order';
      priority = 'high';
      notifData = { action: 'order_new', orderId: orderData.id, orderNumber, clientName };
      break;
    }

    case 'tasting_reminder': {
      if (!tastingData) return NextResponse.json({ error: 'tastingData is required' }, { status: 400 });
      const clientName = tastingData.clientName || 'Client';
      const time = tastingData.time || tastingData.scheduledTime || 'scheduled time';
      const date = tastingData.date || tastingData.scheduledDate || 'tomorrow';
      title = `Tasting with ${clientName} tomorrow`;
      body = `Tasting session on ${date} at ${time}. ${tastingData.notes ? `Notes: ${tastingData.notes}` : ''}`;
      type = 'tasting';
      priority = 'high';
      notifData = { action: 'tasting_reminder', tastingId: tastingData.id, clientName, date, time };
      break;
    }

    case 'design_approved': {
      if (!designData) return NextResponse.json({ error: 'designData is required' }, { status: 400 });
      const clientName = designData.clientName || 'Client';
      const designName = designData.designName || designData.cakeName || 'Custom design';
      title = `Design approved for ${clientName}`;
      body = `"${designName}" has been approved and is ready for production.`;
      type = 'design';
      priority = 'normal';
      notifData = { action: 'design_approved', designId: designData.id, clientName, designName };
      break;
    }

    case 'low_stock': {
      if (!productData) return NextResponse.json({ error: 'productData is required' }, { status: 400 });
      const productName = productData.name || productData.productName || 'Product';
      const currentStock = productData.stock ?? productData.currentStock ?? 0;
      const minStock = productData.minStock ?? productData.minimumStock ?? 0;
      title = `Low stock alert: ${productName}`;
      body = `Current stock: ${currentStock} (minimum: ${minStock}). Consider restocking soon.`;
      type = 'system';
      priority = 'urgent';
      notifData = { action: 'low_stock', productId: productData.id, productName, currentStock, minStock };
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${_action}` }, { status: 400 });
  }

  // Create the notification — broadcast to all tenant users
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  // Fetch all active team members for broadcast
  const teamMembers = await pgQuery<{ id: string }>(
    `SELECT id FROM "TeamMember" WHERE "tenantId" = $1 AND "isActive" = true`,
    [tenantId]
  );

  if (teamMembers.length > 0) {
    const valuesClauses: string[] = [];
    const insertParams: any[] = [];

    for (const member of teamMembers) {
      valuesClauses.push(
        `($${insertParams.length + 1}, $${insertParams.length + 2}, $${insertParams.length + 3}, $${insertParams.length + 4}, $${insertParams.length + 5}, $${insertParams.length + 6}, $${insertParams.length + 7}, $${insertParams.length + 8}, $${insertParams.length + 9}, $${insertParams.length + 10}, $${insertParams.length + 11})`
      );
      insertParams.push(
        id + '_' + member.id,
        tenantId,
        member.id,
        type,
        title,
        body,
        JSON.stringify(notifData),
        priority,
        false,
        createdAt,
        expiresAt
      );
    }

    await pgQuery(
      `INSERT INTO "Notification" ("id", "tenantId", "userId", "type", "title", "body", "data", "priority", "read", "createdAt", "expiresAt") VALUES ${valuesClauses.join(', ')}`,
      insertParams
    );
  } else {
    // No team members — insert a single broadcast notification
    await pgQuery(
      `INSERT INTO "Notification" ("id", "tenantId", "userId", "type", "title", "body", "data", "priority", "read", "createdAt", "expiresAt") VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, false, $8, $9)`,
      [id, tenantId, type, title, body, JSON.stringify(notifData), priority, createdAt, expiresAt]
    );
  }

  return NextResponse.json({
    success: true,
    action: _action,
    type,
    title,
    priority,
    recipientCount: teamMembers.length || 1,
  });
}
