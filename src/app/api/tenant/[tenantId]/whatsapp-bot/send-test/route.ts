import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { getWhatsAppConfig, sendTextMessage, logSentMessage } from '@/lib/whatsapp-sender';

// ── WhatsApp Bot Test Message API ──
// Sends a test message to verify WhatsApp configuration is working.

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { to } = await req.json();

    if (!to || typeof to !== 'string') {
      return NextResponse.json({ error: 'Phone number (to) is required' }, { status: 400 });
    }

    // Get WhatsApp config
    const config = await getWhatsAppConfig(tenantId);
    if (!config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured. Set Access Token and Phone Number ID first.' },
        { status: 400 }
      );
    }

    // Check if bot is enabled
    const tenant = await pgQueryOne<{ settings: any }>(
      `SELECT settings FROM "Tenant" WHERE id = $1`,
      [tenantId]
    );
    let settings: any = {};
    if (tenant) {
      try {
        settings = typeof tenant.settings === 'string'
          ? JSON.parse(tenant.settings)
          : tenant.settings;
      } catch { /* ignore */ }
    }

    const language = settings.botLanguage || 'es';
    const testMessage = language === 'es'
      ? 'Prueba de ZBS - Tu WhatsApp Bot esta configurado correctamente! Los inquilinos ahora pueden interactuar contigo por WhatsApp.'
      : 'ZBS Test - Your WhatsApp Bot is configured correctly! Tenants can now interact with you via WhatsApp.';

    // Send the test message
    const result = await sendTextMessage(config, to, testMessage);

    // Log the message
    await logSentMessage({
      tenantId,
      to,
      body: testMessage,
      waMessageId: result.messageId,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: 'Test message sent successfully',
      });
    }

    return NextResponse.json(
      { error: `Failed to send test message: ${result.error}` },
      { status: 502 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
