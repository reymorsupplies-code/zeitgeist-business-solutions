/**
 * ZBS Email Service — Resend Integration
 *
 * Lazy-initialises the Resend client only when `sendEmail` is actually called.
 * This prevents build-time crashes when RESEND_API_KEY is not yet configured.
 */

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@zeitgeist.business';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@zeitgeist.business';

export { FROM_EMAIL, ADMIN_EMAIL };

/**
 * Send an HTML email via Resend.
 *
 * The Resend SDK is imported dynamically so that the module can be
 * tree-shaken / bundled even when no API key is present at build time.
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  replyTo?: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[ZBS Email] RESEND_API_KEY not set — email skipped.');
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    // Dynamic import — only resolved at runtime
    const Resend = (await import('resend') as any).default;
    const resend = new Resend(apiKey);

    const recipients = Array.isArray(to) ? to : [to];

    const { data, error } = await resend.emails.send({
      from: `Zeitgeist Business Solutions <${FROM_EMAIL}>`,
      to: recipients,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      console.error('[ZBS Email] Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('[ZBS Email] Unexpected error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
