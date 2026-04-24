import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── GET: List conversations for this landlord/tenant ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const renterId = searchParams.get('renterId');
    const propertyId = searchParams.get('propertyId');
    const archived = searchParams.get('archived');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);

    let where = `"c"."tenantId" = $1`;
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (renterId) {
      where += ` AND "c"."renterId" = $${paramIdx++}`;
      queryParams.push(renterId);
    }
    if (propertyId) {
      where += ` AND "c"."propertyId" = $${paramIdx++}`;
      queryParams.push(propertyId);
    }
    if (archived === 'true') {
      where += ` AND "c"."status" = 'archived'`;
    } else if (archived === 'false' || !archived) {
      where += ` AND "c"."status" != 'archived'`;
    }

    const conversations = await pgQuery<any>(
      `SELECT
        "c".*,
        "r"."fullName" AS "renterName",
        "r"."email" AS "renterEmail",
        "p"."name" AS "propertyName",
        "p"."address" AS "propertyAddress",
        "u"."unitNumber",
        COALESCE("unread"."count", 0)::int AS "unreadCount"
      FROM "ChatConversation" "c"
      LEFT JOIN "Renter" "r" ON "r"."id" = "c"."renterId"
      LEFT JOIN "Property" "p" ON "p"."id" = "c"."propertyId"
      LEFT JOIN "PropertyUnit" "u" ON "u"."id" = "c"."unitId"
      LEFT JOIN (
        SELECT "conversationId", COUNT(*) AS count
        FROM "ChatMessage"
        WHERE "landlordReadAt" IS NULL AND "senderType" = 'renter'
        GROUP BY "conversationId"
      ) "unread" ON "unread"."conversationId" = "c"."id"
      WHERE ${where}
      ORDER BY "c"."lastMessageAt" DESC NULLS LAST
      LIMIT $${paramIdx}`,
      [...queryParams, limit]
    );

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('List conversations error:', error);
    return NextResponse.json({ error: 'Error listing conversations' }, { status: 500 });
  }
}

// ── POST: Create new conversation or send message ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();
    const { _action } = body;

    if (!_action) {
      return NextResponse.json({ error: 'Missing _action' }, { status: 400 });
    }

    // ── Action: newConversation ──
    if (_action === 'newConversation') {
      const { renterId, propertyId, unitId, leaseId, subject } = body;

      if (!renterId) {
        return NextResponse.json({ error: 'renterId is required' }, { status: 400 });
      }

      // Check if an active conversation already exists for this tenant-renter-property pair
      const existing = await pgQueryOne<any>(
        `SELECT id FROM "ChatConversation"
         WHERE "tenantId" = $1 AND "renterId" = $2 AND "propertyId" = $3 AND status = 'active'
         LIMIT 1`,
        [tenantId, renterId, propertyId || null]
      );

      if (existing) {
        return NextResponse.json({ conversation: existing, existing: true });
      }

      const conversation = await pgQueryOne<any>(
        `INSERT INTO "ChatConversation" ("tenantId", "renterId", "propertyId", "unitId", "leaseId", subject, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
         RETURNING *`,
        [tenantId, renterId, propertyId || null, unitId || null, leaseId || null, subject || null]
      );

      return NextResponse.json({ conversation }, { status: 201 });
    }

    // ── Action: sendMessage ──
    if (_action === 'sendMessage') {
      const { conversationId, content, messageType } = body;

      if (!conversationId || !content) {
        return NextResponse.json({ error: 'conversationId and content are required' }, { status: 400 });
      }

      // Verify the conversation belongs to this tenant
      const conv = await pgQueryOne<any>(
        `SELECT id FROM "ChatConversation" WHERE id = $1 AND "tenantId" = $2`,
        [conversationId, tenantId]
      );

      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const msgType = messageType || 'text';

      // Insert the message
      const message = await pgQueryOne<any>(
        `INSERT INTO "ChatMessage" ("conversationId", "tenantId", "senderType", "senderId", content, "messageType", "createdAt")
         VALUES ($1, $2, 'landlord', $3, $4, $5, NOW())
         RETURNING *`,
        [conversationId, tenantId, auth.payload?.userId || null, content, msgType]
      );

      // Update conversation's lastMessageAt and preview
      const preview = content.length > 100 ? content.substring(0, 100) + '…' : content;
      await pgQuery(
        `UPDATE "ChatConversation"
         SET "lastMessageAt" = NOW(), "lastMessagePreview" = $1, "lastMessageFrom" = 'landlord', "updatedAt" = NOW()
         WHERE id = $2`,
        [preview, conversationId]
      );

      return NextResponse.json({ message }, { status: 201 });
    }

    return NextResponse.json({ error: `Unknown action: ${_action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Chat POST error:', error);
    return NextResponse.json({ error: 'Error processing chat action' }, { status: 500 });
  }
}

// ── PUT: Mark messages as read ──
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    // Verify the conversation belongs to this tenant
    const conv = await pgQueryOne<any>(
      `SELECT id FROM "ChatConversation" WHERE id = $1 AND "tenantId" = $2`,
      [conversationId, tenantId]
    );

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Mark all unread renter messages in this conversation as read by landlord
    await pgQuery(
      `UPDATE "ChatMessage"
       SET "landlordReadAt" = NOW()
       WHERE "conversationId" = $1 AND "senderType" = 'renter' AND "landlordReadAt" IS NULL`,
      [conversationId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    return NextResponse.json({ error: 'Error marking messages as read' }, { status: 500 });
  }
}
