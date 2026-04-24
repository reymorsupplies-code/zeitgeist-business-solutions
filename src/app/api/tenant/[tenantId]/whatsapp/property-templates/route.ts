import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Real Estate WhatsApp Templates ──
// Predefined templates for property management: rent reminders, maintenance,
// lease notices, tenant onboarding, and more.

const PROPERTY_TEMPLATES = [
  {
    name: 'rent_reminder',
    category: 'payment',
    body: 'Your rent of {{amount}} for {{unit}} is due on {{dueDate}}. Pay now at {{paymentLink}}',
    language: 'en',
  },
  {
    name: 'rent_overdue',
    category: 'payment',
    body: 'Urgent: Your rent of {{amount}} for {{unit}} is {{daysOverdue}} days overdue. Please pay immediately.',
    language: 'en',
  },
  {
    name: 'payment_received',
    category: 'payment',
    body: 'Payment of {{amount}} received for {{unit}}. Thank you! Reference: {{reference}}',
    language: 'en',
  },
  {
    name: 'maintenance_update',
    category: 'maintenance',
    body: 'Update on your maintenance request #{{ticketId}} ({{category}}): {{status}}. {{message}}',
    language: 'en',
  },
  {
    name: 'lease_renewal',
    category: 'lease',
    body: 'Your lease for {{unit}} expires on {{endDate}}. Renew now to secure your home.',
    language: 'en',
  },
  {
    name: 'lease_expiring_30',
    category: 'lease',
    body: 'Reminder: Your lease for {{unit}} expires in 30 days ({{endDate}}). Contact us to discuss renewal.',
    language: 'en',
  },
  {
    name: 'new_tenant_welcome',
    category: 'onboarding',
    body: 'Welcome to {{propertyName}}! Your unit {{unit}} is ready. Move-in date: {{moveInDate}}. Portal: {{portalLink}}',
    language: 'en',
  },
  {
    name: 'security_deposit_return',
    category: 'payment',
    body: 'Your security deposit of {{amount}} for {{unit}} has been processed. Refund method: {{method}}.',
    language: 'en',
  },
  {
    name: 'inspection_scheduled',
    category: 'maintenance',
    body: 'Property inspection scheduled for {{date}} at {{time}} for {{unit}}. Please ensure access.',
    language: 'en',
  },
  {
    name: 'general_announcement',
    category: 'announcement',
    body: '{{message}} — {{propertyName}} Management',
    language: 'en',
  },
  {
    name: 'late_fee_applied',
    category: 'payment',
    body: 'A late fee of {{feeAmount}} has been applied to your {{unit}} rent. Total now due: {{totalDue}}',
    language: 'en',
  },
  {
    name: 'emergency_maintenance',
    category: 'maintenance',
    body: 'URGENT: Maintenance issue reported for {{unit}}. Our team is on it. ETA: {{eta}}',
    language: 'en',
  },
];

// Ensure WhatsApp template table exists
async function ensureWhatsAppTable() {
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
  await pgQuery(
    `CREATE INDEX IF NOT EXISTS "idx_wa_template_tenant" ON "WhatsAppTemplate"("tenantId")`
  );
}

// ── GET: Return list of available property management templates ──
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
    // Enrich templates with variable extraction and current status
    const enriched = PROPERTY_TEMPLATES.map((tpl) => {
      const variableMatches = tpl.body.match(/\{\{(\w+)\}\}/g);
      const variables = variableMatches
        ? [...new Set(variableMatches.map((m) => m.replace(/\{\{|\}\}/g, '')))]
        : [];
      return {
        ...tpl,
        variables,
      };
    });

    return NextResponse.json({
      count: enriched.length,
      templates: enriched,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Seed property management templates into WhatsAppTemplate table ──
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
    await ensureWhatsAppTable();

    const now = new Date().toISOString();
    const seeded: any[] = [];
    const skipped: string[] = [];
    const updated: string[] = [];

    for (const tpl of PROPERTY_TEMPLATES) {
      // Check if template already exists for this tenant
      const existing = await pgQueryOne(
        `SELECT id, name FROM "WhatsAppTemplate" WHERE "tenantId" = $1 AND "name" = $2`,
        [tenantId, tpl.name]
      );

      if (existing) {
        // Update existing template if body has changed
        if (existing.body !== tpl.body) {
          await pgQuery(
            `UPDATE "WhatsAppTemplate" SET "body" = $1, "category" = $2, "language" = $3, "updatedAt" = $4 WHERE id = $5`,
            [tpl.body, tpl.category, tpl.language, now, existing.id]
          );
          updated.push(tpl.name);
        } else {
          skipped.push(tpl.name);
        }
        continue;
      }

      // Insert new template
      const id = crypto.randomUUID();
      await pgQuery(
        `INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "category", "body", "language", "active", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, tenantId, tpl.name, tpl.category, tpl.body, tpl.language, true, now, now]
      );

      const variableMatches = tpl.body.match(/\{\{(\w+)\}\}/g);
      const variables = variableMatches
        ? [...new Set(variableMatches.map((m) => m.replace(/\{\{|\}\}/g, '')))]
        : [];

      seeded.push({
        id,
        name: tpl.name,
        category: tpl.category,
        body: tpl.body,
        language: tpl.language,
        variables,
      });
    }

    return NextResponse.json({
      success: true,
      seeded: seeded.length,
      updated: updated.length,
      skipped: skipped.length,
      templates: seeded,
      updatedTemplates: updated,
      skippedTemplates: skipped,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
