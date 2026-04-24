import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyToken } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Renter token verification (JWT) ──
function verifyRenterToken(req: NextRequest): any {
  const token = extractBearerToken(req);
  if (!token) return null;
  return verifyToken(token);
}

// ── GET: List conversations for this renter ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);

    const conversations = await pgQuery<any>(
      `SELECT
        "c".*,
        "p"."name" AS "propertyName",
        "p"."address" AS "propertyAddress",
        "u"."unitNumber",
        COALESCE("unread"."count", 0)::int AS "unreadCount"
      FROM "ChatConversation" "c"
      LEFT JOIN "Property" "p" ON "p"."id" = "c"."propertyId"
      LEFT JOIN "PropertyUnit" "u" ON "u"."id" = "c"."unitId"
      LEFT JOIN (
        SELECT "conversationId", COUNT(*) AS count
        FROM "ChatMessage"
        WHERE "renterReadAt" IS NULL AND "senderType" = 'landlord'
        GROUP BY "conversationId"
      ) "unread" ON "unread"."conversationId" = "c"."id"
      WHERE "c"."renterId" = $1 AND "c"."tenantId" = $2 AND "c"."status" != 'archived'
      ORDER BY "c"."lastMessageAt" DESC NULLS LAST
      LIMIT $3`,
      [renterId, session.tenantId, limit]
    );

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('List renter conversations error:', error);
    return NextResponse.json({ error: 'Error listing conversations' }, { status: 500 });
  }
}

// ── POST: Send message ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { conversationId, content, messageType } = body;

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'conversationId and content are required' }, { status: 400 });
    }

    // Verify the conversation belongs to this renter + tenant
    const conv = await pgQueryOne<any>(
      `SELECT id FROM "ChatConversation" WHERE id = $1 AND "renterId" = $2 AND "tenantId" = $3`,
      [conversationId, renterId, session.tenantId]
    );

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const msgType = messageType || 'text';

    // Insert the message
    const message = await pgQueryOne<any>(
      `INSERT INTO "ChatMessage" ("conversationId", "tenantId", "senderType", "senderId", content, "messageType", "createdAt")
       VALUES ($1, $2, 'renter', $3, $4, $5, NOW())
       RETURNING *`,
      [conversationId, session.tenantId, renterId, content, msgType]
    );

    // Update conversation's lastMessageAt and preview
    const preview = content.length > 100 ? content.substring(0, 100) + '…' : content;
    await pgQuery(
      `UPDATE "ChatConversation"
       SET "lastMessageAt" = NOW(), "lastMessagePreview" = $1, "lastMessageFrom" = 'renter', "updatedAt" = NOW()
       WHERE id = $2`,
      [preview, conversationId]
    );

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: any) {
    console.error('Send renter message error:', error);
    return NextResponse.json({ error: 'Error sending message' }, { status: 500 });
  }
}

// ── PUT: Mark messages as read ──
export async function PUT(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    // Verify the conversation belongs to this renter + tenant
    const conv = await pgQueryOne<any>(
      `SELECT id FROM "ChatConversation" WHERE id = $1 AND "renterId" = $2 AND "tenantId" = $3`,
      [conversationId, renterId, session.tenantId]
    );

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Mark all unread landlord messages in this conversation as read by renter
    await pgQuery(
      `UPDATE "ChatMessage"
       SET "renterReadAt" = NOW()
       WHERE "conversationId" = $1 AND "senderType" = 'landlord' AND "renterReadAt" IS NULL`,
      [conversationId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Renter mark as read error:', error);
    return NextResponse.json({ error: 'Error marking messages as read' }, { status: 500 });
  }
}
