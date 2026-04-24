-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 4: Landlord ↔ Tenant Chat / Messaging System
--
-- ChatConversation: Represents a conversation between a landlord (tenant user)
--   and a renter. Each conversation is scoped to a tenant (landlord business)
--   and optionally linked to a property, unit, and lease.
--
-- ChatMessage: Individual messages within a conversation.
--   Supports multiple message types (text, image, document, system).
--   Tracks read status per participant.
--   Immutable: no UPDATE or DELETE allowed on messages.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ChatConversation ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ChatConversation" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,

  -- Renter reference (required — one conversation per landlord-renter pair per property)
  "renterId"      TEXT NOT NULL,

  -- Optional property / unit / lease context
  "propertyId"    TEXT,
  "unitId"        TEXT,
  "leaseId"       TEXT,

  -- Conversation metadata
  subject         TEXT,

  -- Status: active, archived, closed
  status          TEXT NOT NULL DEFAULT 'active',

  -- The last message text (denormalized for list views)
  "lastMessageAt" TIMESTAMPTZ,
  "lastMessagePreview" TEXT,

  -- Who the last message was from: 'landlord' or 'renter'
  "lastMessageFrom" TEXT,

  -- Timestamps
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active conversation per tenant-renter pair
  CONSTRAINT "ChatConversation_tenant_renter_active_key"
    UNIQUE ("tenantId", "renterId", "propertyId", status) WHERE (status = 'active')
);

CREATE INDEX IF NOT EXISTS "idx_ChatConversation_tenantId" ON "ChatConversation"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_ChatConversation_renterId" ON "ChatConversation"("renterId");
CREATE INDEX IF NOT EXISTS "idx_ChatConversation_propertyId" ON "ChatConversation"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_ChatConversation_status" ON "ChatConversation"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_ChatConversation_lastMessageAt" ON "ChatConversation"("tenantId", "lastMessageAt" DESC NULLS LAST);

-- ─── ChatMessage ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conversationId" TEXT NOT NULL REFERENCES "ChatConversation"(id) ON DELETE CASCADE,
  "tenantId"      TEXT NOT NULL,

  -- Who sent the message: 'landlord' or 'renter'
  "senderType"    TEXT NOT NULL,

  -- Reference to the specific user who sent (optional)
  "senderId"      TEXT,

  -- Message content
  content         TEXT NOT NULL,

  -- Message type: text, image, document, system
  "messageType"   TEXT NOT NULL DEFAULT 'text',

  -- File attachment URL (for image/document types)
  "fileUrl"       TEXT,

  -- Original file name
  "fileName"      TEXT,

  -- Whether the landlord has read this message
  "landlordReadAt" TIMESTAMPTZ,

  -- Whether the renter has read this message
  "renterReadAt"  TIMESTAMPTZ,

  -- Timestamp
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ChatMessage_conversationId" ON "ChatMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_tenantId" ON "ChatMessage"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_createdAt" ON "ChatMessage"("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_senderType" ON "ChatMessage"("conversationId", "senderType");
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_unread_landlord" ON "ChatMessage"("conversationId", "createdAt" DESC)
  WHERE "landlordReadAt" IS NULL AND "senderType" = 'renter';
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_unread_renter" ON "ChatMessage"("conversationId", "createdAt" DESC)
  WHERE "renterReadAt" IS NULL AND "senderType" = 'landlord';

-- ─── Enable RLS (Row Level Security) ────────────────────────────────────────
ALTER TABLE "ChatConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can only access their own conversations
CREATE POLICY "chat_conversation_tenant_isolation" ON "ChatConversation"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));

-- Policy: tenants can only access messages in their own conversations
CREATE POLICY "chat_message_tenant_isolation" ON "ChatMessage"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));
