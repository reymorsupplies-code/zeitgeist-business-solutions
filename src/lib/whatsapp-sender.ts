/**
 * ZBS WhatsApp Message Sender
 *
 * Sends messages via Meta WhatsApp Business API (Cloud API).
 * Each tenant has their own access token and phone number ID
 * stored in Tenant.settings (whatsappAccessToken, whatsappPhoneNumberId).
 *
 * Supports:
 * - Text messages
 * - Interactive messages (list menus, reply buttons)
 * - Template messages (pre-approved templates)
 * - Location requests
 * - Document/media links
 */

import { pgQuery, pgQueryOne } from './pg-query';

// ─── Types ───

export interface WhatsAppSenderConfig {
  accessToken: string;
  phoneNumberId: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: any;
}

export interface ListSection {
  title: string;
  rows: { id: string; title: string; description?: string }[];
}

export interface InteractiveListOptions {
  header?: string;
  body: string;
  footer?: string;
  buttonText: string;
  sections: ListSection[];
}

export interface ReplyButton {
  id: string;
  title: string;
}

export interface InteractiveReplyOptions {
  body: string;
  footer?: string;
  buttons: ReplyButton[];
}

// ─── Meta API Endpoints ───

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Tenant Config Resolver ───

/**
 * Get WhatsApp sender config for a tenant from database.
 * Looks for whatsappAccessToken and whatsappPhoneNumberId in Tenant.settings.
 */
export async function getWhatsAppConfig(tenantId: string): Promise<WhatsAppSenderConfig | null> {
  try {
    const tenant = await pgQueryOne<{ settings: any }>(
      `SELECT settings FROM "Tenant" WHERE id = $1`,
      [tenantId]
    );
    if (!tenant) return null;

    const settings = typeof tenant.settings === 'string'
      ? JSON.parse(tenant.settings)
      : tenant.settings;

    if (!settings.whatsappAccessToken || !settings.whatsappPhoneNumberId) {
      return null;
    }

    return {
      accessToken: settings.whatsappAccessToken,
      phoneNumberId: settings.whatsappPhoneNumberId,
    };
  } catch (error) {
    console.error('[WhatsApp Sender] Error fetching tenant config:', error);
    return null;
  }
}

/**
 * Find tenant by phone number ID (reverse lookup).
 */
export async function findTenantByPhoneId(phoneNumberId: string): Promise<string | null> {
  try {
    const tenants = await pgQuery<{ id: string; settings: any }>(
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
    // DB error
  }
  return null;
}

// ─── Message Senders ───

/**
 * Send a text message via WhatsApp Cloud API.
 */
export async function sendTextMessage(
  config: WhatsAppSenderConfig,
  to: string,
  text: string,
  previewUrl: boolean = false
): Promise<SendMessageResult> {
  try {
    const url = `${META_API_BASE}/${config.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formatPhone(to),
        type: 'text',
        text: {
          preview_url: previewUrl,
          body: text,
        },
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        raw: result,
      };
    }

    return {
      success: false,
      error: result.error?.message || `HTTP ${response.status}`,
      raw: result,
    };
  } catch (error: any) {
    console.error('[WhatsApp Sender] sendTextMessage error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send an interactive list message (menu with options).
 * Max 10 sections, 10 rows per section.
 */
export async function sendListMessage(
  config: WhatsAppSenderConfig,
  to: string,
  options: InteractiveListOptions
): Promise<SendMessageResult> {
  try {
    const url = `${META_API_BASE}/${config.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatPhone(to),
        type: 'interactive',
        interactive: {
          type: 'list',
          header: options.header ? { type: 'text', text: options.header } : undefined,
          body: { text: options.body },
          footer: options.footer ? { text: options.footer } : undefined,
          action: {
            button: options.buttonText,
            sections: options.sections.map(s => ({
              title: s.title,
              rows: s.rows.map(r => ({
                id: r.id,
                title: r.title,
                description: r.description || '',
              })),
            })),
          },
        },
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        raw: result,
      };
    }

    return {
      success: false,
      error: result.error?.message || `HTTP ${response.status}`,
      raw: result,
    };
  } catch (error: any) {
    console.error('[WhatsApp Sender] sendListMessage error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send an interactive reply buttons message (up to 3 buttons).
 */
export async function sendReplyButtons(
  config: WhatsAppSenderConfig,
  to: string,
  options: InteractiveReplyOptions
): Promise<SendMessageResult> {
  try {
    const url = `${META_API_BASE}/${config.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatPhone(to),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: options.body },
          footer: options.footer ? { text: options.footer } : undefined,
          action: {
            buttons: options.buttons.slice(0, 3).map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        raw: result,
      };
    }

    return {
      success: false,
      error: result.error?.message || `HTTP ${response.status}`,
      raw: result,
    };
  } catch (error: any) {
    console.error('[WhatsApp Sender] sendReplyButtons error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a location request message.
 */
export async function sendLocationRequest(
  config: WhatsAppSenderConfig,
  to: string,
  body: string
): Promise<SendMessageResult> {
  try {
    const url = `${META_API_BASE}/${config.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatPhone(to),
        type: 'interactive',
        interactive: {
          type: 'location_request',
          body: { text: body },
          action: {
            name: 'send_location',
          },
        },
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        raw: result,
      };
    }

    return {
      success: false,
      error: result.error?.message || `HTTP ${response.status}`,
      raw: result,
    };
  } catch (error: any) {
    console.error('[WhatsApp Sender] sendLocationRequest error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a document (PDF, etc.) via WhatsApp.
 */
export async function sendDocument(
  config: WhatsAppSenderConfig,
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<SendMessageResult> {
  try {
    const url = `${META_API_BASE}/${config.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatPhone(to),
        type: 'document',
        document: {
          link: documentUrl,
          filename: filename,
          caption: caption || '',
        },
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        raw: result,
      };
    }

    return {
      success: false,
      error: result.error?.message || `HTTP ${response.status}`,
      raw: result,
    };
  } catch (error: any) {
    console.error('[WhatsApp Sender] sendDocument error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark a message as read (green checkmarks).
 */
export async function markAsRead(
  config: WhatsAppSenderConfig,
  messageId: string
): Promise<boolean> {
  try {
    const url = `${META_API_BASE}/${messageId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Log a sent WhatsApp message to the database.
 */
export async function logSentMessage(params: {
  tenantId: string;
  to: string;
  body: string;
  waMessageId?: string;
  status?: string;
  errorMessage?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  try {
    await pgQuery(
      `INSERT INTO "WhatsAppMessage"
        ("id", "tenantId", "templateId", "to", "body", "variables", "status", "waMessageId", "errorMessage", "sentAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        params.tenantId,
        null,
        params.to,
        params.body,
        JSON.stringify({ direction: 'outgoing' }),
        params.status || 'sent',
        params.waMessageId || '',
        params.errorMessage || '',
        params.status === 'failed' ? '' : new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
  } catch (error) {
    console.error('[WhatsApp Sender] Error logging sent message:', error);
  }
  return id;
}

// ─── Helpers ───

/**
 * Format phone number for WhatsApp API.
 * Removes +, spaces, dashes, and ensures country code prefix.
 */
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  // WhatsApp requires country code without +
  return cleaned;
}
