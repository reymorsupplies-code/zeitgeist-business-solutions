import { NextRequest, NextResponse } from 'next/server';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { processBotMessage } from '@/lib/whatsapp-bot';

// ── WhatsApp Webhook Endpoint ──
// Handles Meta WhatsApp Business API webhook verification and incoming events.
// This is a global endpoint (not tenant-scoped) — tenant is resolved from
// the webhook payload or the x-tenant-id header.

// Ensure WhatsApp tables exist (idempotent)
async function ensureWhatsAppTables() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "WhatsAppTemplate" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'general',
      "body" TEXT NOT NULL,
      "language" TEXT NOT NULL DEFAULT 'en',
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "templateId" TEXT,
      "to" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "variables" TEXT DEFAULT '{}',
      "status" TEXT NOT NULL DEFAULT 'queued',
      "waMessageId" TEXT DEFAULT '',
      "errorMessage" TEXT DEFAULT '',
      "sentAt" TEXT DEFAULT '',
      "deliveredAt" TEXT DEFAULT '',
      "readAt" TEXT DEFAULT '',
      "createdAt" TEXT NOT NULL
    )
  `);
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "idx_wa_template_tenant" ON "WhatsAppTemplate"("tenantId")`
  );
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "idx_wa_message_tenant" ON "WhatsAppMessage"("tenantId")`
  );
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "idx_wa_message_status" ON "WhatsAppMessage"("status")`
  );
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "idx_wa_message_waid" ON "WhatsAppMessage"("waMessageId")`
  );
}

// ── Resolve tenant ID from Meta webhook payload ──
// Meta sends the phone number metadata in the entry changes. We use the
// WhatsApp phone number ID to look up the owning tenant.
async function resolveTenantFromPhoneId(phoneNumberId: string): Promise<string | null> {
  try {
    // Look through all tenants' settings to find one with matching phoneNumberId
    const tenants = await pgQuery(
      `SELECT id, settings FROM "Tenant"`
    );
    for (const tenant of tenants) {
      let settings: any = {};
      try {
        settings = typeof tenant.settings === 'string'
          ? JSON.parse(tenant.settings)
          : tenant.settings;
      } catch {
        continue;
      }
      if (settings.whatsappPhoneNumberId === phoneNumberId) {
        return tenant.id;
      }
    }
  } catch {
    // DB error — return null
  }
  return null;
}

// ── GET: Meta Webhook Verification Challenge ──
// When you configure a webhook in Meta App Dashboard, Meta sends a GET request
// with hub.mode, hub.verify_token, and hub.challenge query params.
// We must verify the token and return the challenge.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Meta verification requires all three params
  if (mode === 'subscribe' && token && challenge) {
    // Verify token against environment variable or all tenant settings
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

    // Option 1: Simple env var verification
    if (expectedToken && token === expectedToken) {
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Option 2: Check against tenant-stored verify tokens
    try {
      const tenants = await pgQuery(
        `SELECT settings FROM "Tenant"`
      );
      for (const tenant of tenants) {
        let settings: any = {};
        try {
          settings = typeof tenant.settings === 'string'
            ? JSON.parse(tenant.settings)
            : tenant.settings;
        } catch {
          continue;
        }
        const tenantToken = settings.whatsappVerifyToken || settings.webhook_verify_token;
        if (tenantToken && tenantToken === token) {
          return new NextResponse(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      }
    } catch {
      // DB error — fall through to error
    }

    // Token mismatch
    return NextResponse.json(
      { error: 'Verification token mismatch' },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { error: 'Missing required params. Expected hub.mode, hub.verify_token, hub.challenge.' },
    { status: 400 }
  );
}

// ── POST: Receive incoming messages and status updates from Meta ──
export async function POST(req: NextRequest) {
  try {
    await ensureWhatsAppTables();

    const body = await req.json();

    // Meta sends { object: "whatsapp_business_account", entry: [...] }
    if (!body.object || !body.entry) {
      return NextResponse.json(
        { error: 'Invalid webhook payload — missing object or entry' },
        { status: 400 }
      );
    }

    const processedEvents: any[] = [];

    for (const entry of body.entry || []) {
      // Extract phone number ID from metadata to resolve tenant
      const metadata = entry.metadata || {};
      const phoneNumberId = metadata.phone_number_id;
      const displayPhoneNumber = metadata.display_phone_number || '';

      // Resolve tenant — either from header or from phone number lookup
      let tenantId = req.headers.get('x-tenant-id');
      if (!tenantId && phoneNumberId) {
        tenantId = await resolveTenantFromPhoneId(phoneNumberId);
      }

      if (!tenantId) {
        // Could not resolve tenant — skip this entry but acknowledge receipt
        processedEvents.push({
          note: 'Could not resolve tenant for entry',
          phoneNumberId,
          displayPhoneNumber,
        });
        continue;
      }

      for (const change of entry.changes || []) {
        const field = change.field;
        const value = change.value || {};

        // ── Process message status updates ──
        if (field === 'messages' && value.statuses) {
          for (const msgStatus of value.statuses || []) {
            const waMsgId = msgStatus.id;
            const waStatus = msgStatus.status;
            const recipientPhone = msgStatus.recipient_id;

            if (!waMsgId) continue;

            const statusMap: Record<string, string> = {
              sent: 'sent',
              delivered: 'delivered',
              read: 'read',
              failed: 'failed',
            };
            const mappedStatus = statusMap[waStatus] || waStatus;

            // Find the message by waMessageId
            const existing = await pgQueryOne(
              `SELECT id FROM "WhatsAppMessage" WHERE "waMessageId" = $1 AND "tenantId" = $2`,
              [waMsgId, tenantId]
            );

            if (existing) {
              const setParts: string[] = [`"status" = $1`];
              const params: any[] = [mappedStatus];
              let pIdx = 2;

              if (mappedStatus === 'sent') {
                setParts.push(`"sentAt" = $${pIdx++}`);
                params.push(new Date().toISOString());
              } else if (mappedStatus === 'delivered') {
                const ts = new Date().toISOString();
                setParts.push(`"deliveredAt" = $${pIdx++}`);
                params.push(ts);
                setParts.push(`"sentAt" = CASE WHEN "sentAt" = '' THEN $${pIdx} ELSE "sentAt" END`);
                params.push(ts);
              } else if (mappedStatus === 'read') {
                const ts = new Date().toISOString();
                setParts.push(`"readAt" = $${pIdx++}`);
                params.push(ts);
                setParts.push(`"sentAt" = CASE WHEN "sentAt" = '' THEN $${pIdx} ELSE "sentAt" END`);
                params.push(ts);
                setParts.push(`"deliveredAt" = CASE WHEN "deliveredAt" = '' THEN $${pIdx} ELSE "deliveredAt" END`);
                params.push(ts);
              } else if (mappedStatus === 'failed') {
                const errInfo = msgStatus.errors?.[0];
                setParts.push(`"errorMessage" = $${pIdx++}`);
                params.push(errInfo ? JSON.stringify(errInfo) : 'Unknown error');
              }

              await pgQuery(
                `UPDATE "WhatsAppMessage" SET ${setParts.join(', ')} WHERE id = $${pIdx}`,
                [...params, existing.id]
              );

              processedEvents.push({
                waMessageId: waMsgId,
                status: mappedStatus,
                type: 'status_update',
                recipientPhone,
              });
            }
          }
        }

        // ── Process incoming messages ──
        if (field === 'messages' && value.messages) {
          for (const msg of value.messages || []) {
            const from = msg.from;
            const msgType = msg.type;
            const msgId = msg.id;
            const timestamp = msg.timestamp;

            // Extract text content
            let text = '';
            if (msgType === 'text' && msg.text) {
              text = msg.text.body || '';
            } else if (msgType === 'interactive' && msg.interactive) {
              // Handle list_reply and button_reply — extract the selected ID
              const listReply = msg.interactive.list_reply;
              const buttonReply = msg.interactive.button_reply;
              if (listReply?.id) {
                text = listReply.id; // e.g. 'balance', 'maintenance_start', 'mant_plumbing'
              } else if (buttonReply?.id) {
                text = buttonReply.id; // e.g. 'mant_confirm_yes', 'mant_confirm_no'
              } else {
                text = msg.interactive.body?.text || msg.interactive.type || '';
              }
            } else if (msgType === 'image' && msg.image) {
              text = `[Image] ${msg.image.caption || ''}`.trim();
            } else if (msgType === 'document' && msg.document) {
              text = `[Document] ${msg.document.filename || ''}`.trim();
            } else if (msgType === 'location' && msg.location) {
              text = `[Location] ${msg.location.name || ''} (${msg.location.latitude}, ${msg.location.longitude})`;
            } else {
              text = `[${msgType}]`;
            }

            const incomingId = crypto.randomUUID();
            const createdAt = timestamp
              ? new Date(parseInt(timestamp) * 1000).toISOString()
              : new Date().toISOString();

            await pgQuery(
              `INSERT INTO "WhatsAppMessage" ("id", "tenantId", "templateId", "to", "body", "variables", "status", "waMessageId", "errorMessage", "sentAt", "deliveredAt", "readAt", "createdAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                incomingId,
                tenantId,
                null,
                from,
                text,
                JSON.stringify({ type: 'incoming', msgType, from, displayPhoneNumber }),
                'received',
                msgId || '',
                '',
                '',
                '',
                '',
                createdAt,
              ]
            );

            processedEvents.push({
              waMessageId: msgId,
              from,
              type: 'incoming_message',
              msgType,
              text: text.substring(0, 100),
            });

            // ── Trigger WhatsApp Self-Service Bot (non-blocking) ──
            // Only process text and interactive messages for the bot
            if ((msgType === 'text' || msgType === 'interactive') && text) {
              // Fire-and-forget — don't block the webhook response
              processBotMessage(from, text, tenantId, phoneNumberId || '').catch((err) => {
                console.error('[WhatsApp Webhook] Bot processing error:', err);
              });
            }
          }
        }

        // ── Process account status updates ──
        if (field === 'account_update' && value.statuses) {
          processedEvents.push({
            type: 'account_update',
            statuses: value.statuses,
          });
        }
      }
    }

    // Always return 200 to acknowledge receipt (Meta expects this)
    return NextResponse.json({
      success: true,
      eventsProcessed: processedEvents.length,
      events: processedEvents,
    });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error processing webhook:', error);
    // Still return 200 to prevent Meta from retrying excessively
    return NextResponse.json(
      { error: error.message, note: 'Webhook received but processing failed' },
      { status: 200 }
    );
  }
}
