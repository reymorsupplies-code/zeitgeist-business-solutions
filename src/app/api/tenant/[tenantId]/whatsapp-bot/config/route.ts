import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── WhatsApp Bot Configuration API ──
// Manages per-tenant WhatsApp bot settings stored in Tenant.settings JSON field.
// Settings include: botEnabled, whatsappAccessToken, whatsappPhoneNumberId,
// whatsappVerifyToken, language, autoReply flags, etc.

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const tenant = await pgQueryOne<{ settings: any }>(
      `SELECT settings FROM "Tenant" WHERE id = $1`,
      [tenantId]
    );
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    let settings: any = {};
    try {
      settings = typeof tenant.settings === 'string'
        ? JSON.parse(tenant.settings)
        : tenant.settings;
    } catch {
      // Malformed settings
    }

    // Extract bot-specific settings with defaults
    const botConfig = {
      botEnabled: settings.botEnabled || false,
      whatsappAccessToken: settings.whatsappAccessToken || '',
      whatsappPhoneNumberId: settings.whatsappPhoneNumberId || '',
      whatsappVerifyToken: settings.whatsappVerifyToken || '',
      welcomeMessage: settings.botWelcomeMessage || '',
      autoReplyMaintenance: settings.autoReplyMaintenance !== false,
      autoReplyPayments: settings.autoReplyPayments !== false,
      autoReplyBalance: settings.autoReplyBalance !== false,
      language: settings.botLanguage || settings.defaultLanguage || 'es',
    };

    return NextResponse.json(botConfig);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();

    // Read current settings
    const tenant = await pgQueryOne<{ settings: any }>(
      `SELECT settings FROM "Tenant" WHERE id = $1`,
      [tenantId]
    );
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    let settings: any = {};
    try {
      settings = typeof tenant.settings === 'string'
        ? JSON.parse(tenant.settings)
        : tenant.settings;
    } catch {
      settings = {};
    }

    // Merge bot settings (only known keys to prevent injection)
    const allowedKeys = [
      'botEnabled', 'whatsappAccessToken', 'whatsappPhoneNumberId',
      'whatsappVerifyToken', 'botWelcomeMessage',
      'autoReplyMaintenance', 'autoReplyPayments', 'autoReplyBalance',
      'botLanguage',
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        settings[key] = body[key];
      }
    }

    // Update tenant settings
    await pgQuery(
      `UPDATE "Tenant" SET settings = $1, "updatedAt" = $2 WHERE id = $3`,
      [JSON.stringify(settings), new Date().toISOString(), tenantId]
    );

    return NextResponse.json({
      success: true,
      botEnabled: settings.botEnabled || false,
      whatsappConfigured: !!(settings.whatsappAccessToken && settings.whatsappPhoneNumberId),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
