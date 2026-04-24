import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── WhatsApp Messaging Integration API ──

// Default bakery templates seeded for new tenants
const DEFAULT_TEMPLATES = [
  {
    name: 'order_confirmation',
    category: 'order',
    body: 'Hello {{clientName}}, your order #{{orderNumber}} has been confirmed! Total: {{total}}. We\'ll notify you when it\'s ready.',
    language: 'en',
  },
  {
    name: 'tasting_reminder',
    category: 'appointment',
    body: 'Hi {{clientName}}, this is a reminder for your cake tasting tomorrow at {{time}}. See you at {{address}}! Reply CANCEL to reschedule.',
    language: 'en',
  },
  {
    name: 'design_approved',
    category: 'order',
    body: 'Great news {{clientName}}! Your cake design has been approved. We\'ll start production for delivery on {{deliveryDate}}. Total: {{total}}.',
    language: 'en',
  },
  {
    name: 'order_ready',
    category: 'order',
    body: '{{clientName}}, your order #{{orderNumber}} is ready for pickup! {{address}}. Thank you for choosing us!',
    language: 'en',
  },
  {
    name: 'deposit_reminder',
    category: 'payment',
    body: 'Hi {{clientName}}, a reminder that your deposit of {{depositAmount}} is due for order #{{orderNumber}}. Please confirm to secure your date.',
    language: 'en',
  },
];

// ── Helper: Generate unique ID ──
function generateId(): string {
  return crypto.randomUUID();
}

// ── Helper: Ensure WhatsApp tables exist (idempotent) ──
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
}

// ── Helper: Auto-seed default templates if none exist for tenant ──
async function seedDefaultTemplates(tenantId: string): Promise<any[]> {
  const existing = await pgQuery(
    `SELECT COUNT(*)::int as count FROM "WhatsAppTemplate" WHERE "tenantId" = $1`,
    [tenantId]
  );
  if (existing[0]?.count > 0) {
    return pgQuery(
      `SELECT * FROM "WhatsAppTemplate" WHERE "tenantId" = $1 ORDER BY "createdAt" ASC`,
      [tenantId]
    );
  }

  const now = new Date().toISOString();
  const rows: any[] = [];

  for (const tpl of DEFAULT_TEMPLATES) {
    const id = generateId();
    const row = {
      id,
      tenantId,
      name: tpl.name,
      category: tpl.category,
      body: tpl.body,
      language: tpl.language,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    rows.push(row);
  }

  for (const row of rows) {
    await pgQuery(
      `INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "category", "body", "language", "active", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [row.id, row.tenantId, row.name, row.category, row.body, row.language, row.active, row.createdAt, row.updatedAt]
    );
  }

  return rows;
}

// ── Helper: Render template body with {{variable}} substitution ──
function renderTemplate(body: string, variables: Record<string, string>): string {
  let rendered = body;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return rendered;
}

// ── Helper: Validate phone number (E.164 format) ──
function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

// ── GET: Templates, Queue, Stats, or Recent Messages ──
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // If x-webhook-secret header is present, route to webhook handler
  const webhookSecret = _req.headers.get('x-webhook-secret');
  if (webhookSecret) {
    return handleWebhook(_req, tenantId, webhookSecret);
  }

  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureWhatsAppTables();

    const { searchParams } = new URL(_req.url);

    // ?templates=true — return all message templates (auto-seeds if empty)
    if (searchParams.get('templates') === 'true') {
      const templates = await seedDefaultTemplates(tenantId);
      return NextResponse.json(templates);
    }

    // ?queue=true — return pending message queue
    if (searchParams.get('queue') === 'true') {
      const queue = await pgQuery(
        `SELECT * FROM "WhatsAppMessage" WHERE "tenantId" = $1 AND "status" IN ('queued', 'sent') ORDER BY "createdAt" ASC`,
        [tenantId]
      );
      return NextResponse.json(queue);
    }

    // ?stats=true — return message statistics
    if (searchParams.get('stats') === 'true') {
      const stats = await pgQueryOne(
        `SELECT
          COUNT(*) FILTER (WHERE "status" = 'queued') AS queued,
          COUNT(*) FILTER (WHERE "status" = 'sent') AS sent,
          COUNT(*) FILTER (WHERE "status" = 'delivered') AS delivered,
          COUNT(*) FILTER (WHERE "status" = 'read') AS read_count,
          COUNT(*) FILTER (WHERE "status" = 'failed') AS failed,
          COUNT(*) FILTER (WHERE "status" = 'received') AS received,
          COUNT(*) AS total
         FROM "WhatsAppMessage" WHERE "tenantId" = $1`,
        [tenantId]
      );
      const dailyStats = await pgQuery(
        `SELECT
          DATE("createdAt") AS date,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE "status" = 'delivered') AS delivered,
          COUNT(*) FILTER (WHERE "status" = 'read') AS read_count,
          COUNT(*) FILTER (WHERE "status" = 'failed') AS failed
         FROM "WhatsAppMessage"
         WHERE "tenantId" = $1 AND "createdAt" >= NOW() - INTERVAL '7 days'
         GROUP BY DATE("createdAt")
         ORDER BY date DESC`,
        [tenantId]
      );
      return NextResponse.json({ ...stats, daily: dailyStats });
    }

    // Default: return recent messages (last 50) ordered by createdAt DESC
    const messages = await pgQuery(
      `SELECT * FROM "WhatsAppMessage" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
      [tenantId]
    );
    return NextResponse.json(messages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Send Message or Create Template ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // If x-webhook-secret header is present, route to webhook handler
  const webhookSecret = req.headers.get('x-webhook-secret');
  if (webhookSecret) {
    return handleWebhook(req, tenantId, webhookSecret);
  }

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureWhatsAppTables();
    const data = await req.json();

    // ── Action: send ──
    if (data._action === 'send') {
      const { to, templateId, variables } = data;

      if (!to) {
        return NextResponse.json({ error: 'Recipient phone number (to) is required' }, { status: 400 });
      }
      if (!isValidPhone(to)) {
        return NextResponse.json({ error: 'Invalid phone number. Use E.164 format: +1234567890' }, { status: 400 });
      }

      let body: string;
      let resolvedTemplateId: string | null = null;

      if (templateId) {
        const template = await pgQueryOne(
          `SELECT * FROM "WhatsAppTemplate" WHERE "id" = $1 AND "tenantId" = $2 AND "active" = true`,
          [templateId, tenantId]
        );
        if (!template) {
          return NextResponse.json({ error: 'Template not found or inactive' }, { status: 404 });
        }
        body = renderTemplate(template.body, variables || {});
        resolvedTemplateId = templateId;
      } else if (data.body) {
        body = renderTemplate(data.body, variables || {});
      } else {
        return NextResponse.json({ error: 'Either templateId or body is required' }, { status: 400 });
      }

      const id = generateId();
      const now = new Date().toISOString();

      const message = await pgQueryOne(
        `INSERT INTO "WhatsAppMessage" ("id", "tenantId", "templateId", "to", "body", "variables", "status", "waMessageId", "errorMessage", "sentAt", "deliveredAt", "readAt", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          id,
          tenantId,
          resolvedTemplateId,
          to,
          body,
          JSON.stringify(variables || {}),
          'queued',
          '',
          '',
          '',
          '',
          '',
          now,
        ]
      );

      return NextResponse.json(message, { status: 201 });
    }

    // ── Action: create_template ──
    if (data._action === 'create_template') {
      const { name, body, category, language } = data;

      if (!name || !body) {
        return NextResponse.json({ error: 'Template name and body are required' }, { status: 400 });
      }

      // Check for duplicate name within tenant
      const existing = await pgQueryOne(
        `SELECT id FROM "WhatsAppTemplate" WHERE "tenantId" = $1 AND "name" = $2`,
        [tenantId, name]
      );
      if (existing) {
        return NextResponse.json({ error: `Template "${name}" already exists for this tenant` }, { status: 409 });
      }

      // Extract variable names from body for response
      const variableMatches = body.match(/\{\{(\w+)\}\}/g);
      const variableNames = variableMatches
        ? [...new Set(variableMatches.map((m: string) => m.replace(/\{\{|\}\}/g, '')))]
        : [];

      const id = generateId();
      const now = new Date().toISOString();

      const template = await pgQueryOne(
        `INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "category", "body", "language", "active", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          tenantId,
          name,
          category || 'general',
          body,
          language || 'en',
          true,
          now,
          now,
        ]
      );

      return NextResponse.json({ ...template, variables: variableNames }, { status: 201 });
    }

    // ── Action: sendMessage (real Meta API integration) ──
    if (data._action === 'sendMessage') {
      const { templateName, to, variables } = data;

      if (!templateName) {
        return NextResponse.json({ error: 'Template name (templateName) is required' }, { status: 400 });
      }
      if (!to) {
        return NextResponse.json({ error: 'Recipient phone number (to) is required' }, { status: 400 });
      }
      if (!isValidPhone(to)) {
        return NextResponse.json({ error: 'Invalid phone number. Use E.164 format: +1234567890' }, { status: 400 });
      }

      // Look up template by name
      const template = await pgQueryOne(
        `SELECT * FROM "WhatsAppTemplate" WHERE "name" = $1 AND "tenantId" = $2 AND "active" = true`,
        [templateName, tenantId]
      );
      if (!template) {
        return NextResponse.json({ error: `Template "${templateName}" not found or inactive` }, { status: 404 });
      }

      // Resolve WhatsApp credentials from tenant settings
      const tenant = await pgQueryOne(
        `SELECT settings FROM "Tenant" WHERE id = $1`,
        [tenantId]
      );
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }

      let tenantSettings: any = {};
      try {
        tenantSettings = typeof tenant.settings === 'string'
          ? JSON.parse(tenant.settings)
          : tenant.settings;
      } catch {
        // Malformed settings
      }

      const accessToken = tenantSettings.whatsappAccessToken;
      const phoneNumberId = tenantSettings.whatsappPhoneNumberId;

      if (!accessToken || !phoneNumberId) {
        return NextResponse.json(
          { error: 'WhatsApp not configured. Set whatsappAccessToken and whatsappPhoneNumberId in tenant settings.' },
          { status: 400 }
        );
      }

      // Build template components for Meta API
      const bodyText = renderTemplate(template.body, variables || {});
      const components: any[] = [
        {
          type: 'body',
          parameters: [{ type: 'text', text: bodyText }],
        },
      ];

      // Create the message record in DB first (status: queued)
      const id = generateId();
      const now = new Date().toISOString();
      const renderedBody = bodyText;

      await pgQueryOne(
        `INSERT INTO "WhatsAppMessage" ("id", "tenantId", "templateId", "to", "body", "variables", "status", "waMessageId", "errorMessage", "sentAt", "deliveredAt", "readAt", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [id, tenantId, template.id, to, renderedBody, JSON.stringify(variables || {}), 'queued', '', '', '', '', '', now]
      );

      // Call Meta WhatsApp Business API
      try {
        const metaResponse = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: to,
              type: 'template',
              template: {
                name: templateName,
                language: { code: template.language || 'en' },
                components: components,
              },
            }),
          }
        );

        const metaResult = await metaResponse.json();

        if (!metaResponse.ok) {
          // Meta API returned an error — update message status to failed
          const errorMsg = metaResult.error?.message || metaResult.error?.title || JSON.stringify(metaResult.error || metaResult);
          await pgQuery(
            `UPDATE "WhatsAppMessage" SET "status" = $1, "errorMessage" = $2 WHERE id = $3`,
            ['failed', errorMsg, id]
          );

          const failedMsg = await pgQueryOne(`SELECT * FROM "WhatsAppMessage" WHERE id = $1`, [id]);
          return NextResponse.json(
            { error: `Meta API error: ${errorMsg}`, message: failedMsg },
            { status: 502 }
          );
        }

        // Success — update message status to sent with the WhatsApp message ID
        const waMessageId = metaResult.messages?.[0]?.id || '';
        await pgQuery(
          `UPDATE "WhatsAppMessage" SET "status" = 'sent', "waMessageId" = $1, "sentAt" = $2 WHERE id = $3`,
          [waMessageId, new Date().toISOString(), id]
        );

        const sentMessage = await pgQueryOne(`SELECT * FROM "WhatsAppMessage" WHERE id = $1`, [id]);
        return NextResponse.json(sentMessage, { status: 201 });
      } catch (apiError: any) {
        // Network or fetch error
        const errorMsg = apiError.message || 'Failed to reach Meta WhatsApp API';
        await pgQuery(
          `UPDATE "WhatsAppMessage" SET "status" = $1, "errorMessage" = $2 WHERE id = $3`,
          ['failed', errorMsg, id]
        );

        const failedMsg = await pgQueryOne(`SELECT * FROM "WhatsAppMessage" WHERE id = $1`, [id]);
        return NextResponse.json(
          { error: `Failed to send message: ${errorMsg}`, message: failedMsg },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Use _action: "send", "sendMessage", or _action: "create_template"' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT: Update Template or Message Status ──
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  const { id, status, waMessageId, name, body, category, active, errorMessage } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await ensureWhatsAppTables();

    // ── Update message status ──
    if (status) {
      const validStatuses = ['queued', 'sent', 'delivered', 'read', 'failed'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }

      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;

      setParts.push(`"status" = $${pIdx++}`);
      paramValues.push(status);

      if (status === 'sent') {
        setParts.push(`"sentAt" = $${pIdx++}`);
        paramValues.push(new Date().toISOString());
      }
      if (status === 'delivered') {
        setParts.push(`"deliveredAt" = $${pIdx++}`);
        paramValues.push(new Date().toISOString());
        // Auto-fill sentAt if empty
        const ts = new Date().toISOString();
        setParts.push(`"sentAt" = CASE WHEN "sentAt" = '' THEN $${pIdx} ELSE "sentAt" END`);
        paramValues.push(ts);
      }
      if (status === 'read') {
        setParts.push(`"readAt" = $${pIdx++}`);
        paramValues.push(new Date().toISOString());
        // Auto-fill sentAt and deliveredAt if empty
        const ts = new Date().toISOString();
        setParts.push(`"sentAt" = CASE WHEN "sentAt" = '' THEN $${pIdx} ELSE "sentAt" END`);
        paramValues.push(ts);
        setParts.push(`"deliveredAt" = CASE WHEN "deliveredAt" = '' THEN $${pIdx} ELSE "deliveredAt" END`);
        paramValues.push(ts);
      }
      if (status === 'failed' && errorMessage) {
        setParts.push(`"errorMessage" = $${pIdx++}`);
        paramValues.push(errorMessage);
      }
      if (waMessageId) {
        setParts.push(`"waMessageId" = $${pIdx++}`);
        paramValues.push(waMessageId);
      }

      await pgQuery(
        `UPDATE "WhatsAppMessage" SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1}`,
        [...paramValues, id, tenantId]
      );

      const updated = await pgQueryOne(`SELECT * FROM "WhatsAppMessage" WHERE id = $1`, [id]);
      if (!updated) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      return NextResponse.json(updated);
    }

    // ── Update template fields ──
    if (name !== undefined || body !== undefined || category !== undefined || active !== undefined) {
      if (name !== undefined) {
        // Check for duplicate name excluding current template
        const dup = await pgQueryOne(
          `SELECT id FROM "WhatsAppTemplate" WHERE "tenantId" = $1 AND "name" = $2 AND id != $3`,
          [tenantId, name, id]
        );
        if (dup) {
          return NextResponse.json({ error: `Template "${name}" already exists for this tenant` }, { status: 409 });
        }
      }

      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;

      if (name !== undefined) {
        setParts.push(`"name" = $${pIdx++}`);
        paramValues.push(name);
      }
      if (body !== undefined) {
        setParts.push(`"body" = $${pIdx++}`);
        paramValues.push(body);
      }
      if (category !== undefined) {
        setParts.push(`"category" = $${pIdx++}`);
        paramValues.push(category);
      }
      if (active !== undefined) {
        setParts.push(`"active" = $${pIdx++}`);
        paramValues.push(active);
      }
      setParts.push(`"updatedAt" = $${pIdx++}`);
      paramValues.push(new Date().toISOString());

      await pgQuery(
        `UPDATE "WhatsAppTemplate" SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1}`,
        [...paramValues, id, tenantId]
      );

      const updated = await pgQueryOne(`SELECT * FROM "WhatsAppTemplate" WHERE id = $1`, [id]);
      if (!updated) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

      // Extract variable names from the (possibly updated) body
      const variableMatches = updated.body.match(/\{\{(\w+)\}\}/g);
      const variableNames = variableMatches
        ? [...new Set(variableMatches.map((m: string) => m.replace(/\{\{|\}\}/g, '')))]
        : [];

      return NextResponse.json({ ...updated, variables: variableNames });
    }

    return NextResponse.json(
      { error: 'No valid fields to update. Provide status (for messages) or name/body/category/active (for templates).' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Delete a Template ──
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureWhatsAppTables();

    // Verify template exists and belongs to tenant
    const template = await pgQueryOne(
      `SELECT id, name FROM "WhatsAppTemplate" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Prevent deletion if template has active queued/sent messages
    const inUse = await pgQueryOne(
      `SELECT COUNT(*)::int as count FROM "WhatsAppMessage" WHERE "templateId" = $1 AND "tenantId" = $2 AND "status" IN ('queued', 'sent')`,
      [id, tenantId]
    );
    if (inUse && inUse.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete template "${template.name}" — it has ${inUse.count} active message(s) in queue. Deactivate it instead.` },
        { status: 409 }
      );
    }

    await pgQuery(
      `DELETE FROM "WhatsAppTemplate" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    return NextResponse.json({ success: true, deleted: template.name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── Webhook Handler: Process incoming WhatsApp webhook events ──
async function handleWebhook(
  req: NextRequest,
  tenantId: string,
  webhookSecret: string
): Promise<NextResponse> {
  try {
    await ensureWhatsAppTables();

    // Verify webhook secret against tenant's stored settings
    const tenant = await pgQueryOne(
      `SELECT settings FROM "Tenant" WHERE id = $1`,
      [tenantId]
    );
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    let tenantSettings: any = {};
    try {
      tenantSettings = typeof tenant.settings === 'string'
        ? JSON.parse(tenant.settings)
        : tenant.settings;
    } catch {
      // Malformed settings — default to empty
    }

    const expectedSecret = tenantSettings.whatsappWebhookSecret || tenantSettings.webhook_secret;
    if (!expectedSecret || expectedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const body = await req.json();

    // ── WhatsApp Cloud API webhook format (standard Meta format) ──
    if (body.object && body.entry) {
      const processedEvents: any[] = [];

      for (const entry of body.entry || []) {
        if (!entry.changes) continue;

        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const value = change.value || {};
            const statuses = value.statuses || [];
            const messages = value.messages || [];

            // Process status updates (delivered, read, sent, failed)
            for (const msgStatus of statuses) {
              const waMsgId = msgStatus.id;
              const waStatus = msgStatus.status;

              if (waMsgId) {
                const statusMap: Record<string, string> = {
                  sent: 'sent',
                  delivered: 'delivered',
                  read: 'read',
                  failed: 'failed',
                };
                const mappedStatus = statusMap[waStatus] || waStatus;

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
                    setParts.push(`"deliveredAt" = $${pIdx++}`);
                    params.push(new Date().toISOString());
                  } else if (mappedStatus === 'read') {
                    setParts.push(`"readAt" = $${pIdx++}`);
                    params.push(new Date().toISOString());
                  } else if (mappedStatus === 'failed') {
                    const errInfo = msgStatus.errors?.[0];
                    setParts.push(`"errorMessage" = $${pIdx++}`);
                    params.push(errInfo ? JSON.stringify(errInfo) : 'Unknown error');
                  }

                  await pgQuery(
                    `UPDATE "WhatsAppMessage" SET ${setParts.join(', ')} WHERE id = $${pIdx}`,
                    [...params, existing.id]
                  );

                  processedEvents.push({ waMessageId: waMsgId, status: mappedStatus, type: 'status_update' });
                }
              }
            }

            // Process incoming messages from customers
            for (const msg of messages) {
              const from = msg.from;
              const msgType = msg.type;
              const msgId = msg.id;
              const text = msg.text?.body || '';
              const timestamp = msg.timestamp;

              const incomingId = generateId();
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
                  JSON.stringify({ type: 'incoming', msgType, from }),
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
                text: text.substring(0, 100),
              });
            }
          }
        }
      }

      return NextResponse.json({ success: true, eventsProcessed: processedEvents.length, events: processedEvents });
    }

    // ── Generic webhook format fallback ──
    if (body.event) {
      const eventType = body.event;
      const waMessageId = body.waMessageId || body.message_id;
      const newStatus = body.status;
      const error = body.error;

      if (waMessageId && newStatus) {
        const validStatuses = ['sent', 'delivered', 'read', 'failed'];
        if (validStatuses.includes(newStatus)) {
          const existing = await pgQueryOne(
            `SELECT id FROM "WhatsAppMessage" WHERE "waMessageId" = $1 AND "tenantId" = $2`,
            [waMessageId, tenantId]
          );

          if (existing) {
            const setParts: string[] = [`"status" = $1`];
            const params: any[] = [newStatus];
            let pIdx = 2;

            if (newStatus === 'sent') {
              setParts.push(`"sentAt" = $${pIdx++}`);
              params.push(new Date().toISOString());
            } else if (newStatus === 'delivered') {
              setParts.push(`"deliveredAt" = $${pIdx++}`);
              params.push(new Date().toISOString());
            } else if (newStatus === 'read') {
              setParts.push(`"readAt" = $${pIdx++}`);
              params.push(new Date().toISOString());
            } else if (newStatus === 'failed' && error) {
              setParts.push(`"errorMessage" = $${pIdx++}`);
              params.push(typeof error === 'string' ? error : JSON.stringify(error));
            }

            await pgQuery(
              `UPDATE "WhatsAppMessage" SET ${setParts.join(', ')} WHERE id = $${pIdx}`,
              [...params, existing.id]
            );

            return NextResponse.json({ success: true, event: eventType, status: newStatus, waMessageId });
          }
        }
      }

      // Incoming message event
      if (eventType === 'message.received' || eventType === 'incoming') {
        const incomingId = generateId();
        const now = new Date().toISOString();
        await pgQuery(
          `INSERT INTO "WhatsAppMessage" ("id", "tenantId", "templateId", "to", "body", "variables", "status", "waMessageId", "errorMessage", "sentAt", "deliveredAt", "readAt", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            incomingId,
            tenantId,
            null,
            body.from || body.phone || '',
            body.text || body.body || '',
            JSON.stringify({ type: 'incoming', event: eventType }),
            'received',
            body.waMessageId || body.message_id || '',
            '',
            '',
            '',
            '',
            now,
          ]
        );
        return NextResponse.json({ success: true, event: eventType, incomingMessageId: incomingId });
      }

      return NextResponse.json({ success: true, event: eventType, note: 'Event acknowledged but no matching message found' });
    }

    return NextResponse.json({ success: true, note: 'Webhook received but no matching event format recognized' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
