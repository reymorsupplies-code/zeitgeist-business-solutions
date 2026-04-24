import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidEmail } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { ADMIN_EMAIL } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://zeitgeist.business';

function passwordResetEmail(data: { name: string; email: string; resetUrl: string }): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Password Reset</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;min-height:100%;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,26,46,0.08);">
<tr><td style="background:linear-gradient(135deg,#0F1A2E,#1E3A8A);padding:32px 40px;text-align:center;">
<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#D4A843,#F0D68A);color:#0F1A2E;font-weight:800;font-size:18px;">Z</span>
<span style="color:#FFFFFF;font-size:20px;font-weight:700;margin-left:10px;">Zeitgeist Business Solutions</span>
</td></tr>
<tr><td style="padding:32px 40px;font-size:15px;line-height:1.7;color:#334155;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Password Reset Request</h1>
<p>Hi ${data.name},</p>
<p>We received a request to reset your password. Click the button below to choose a new one:</p>
<p style="text-align:center;padding:24px 0;">
<a href="${data.resetUrl}" style="display:inline-block;padding:14px 32px;background:#1D4ED8;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Reset Password</a>
</p>
<p>This link will expire in <strong>1 hour</strong>. If you did not request this, you can safely ignore this email — your password will not change.</p>
</td></tr>
<tr><td style="padding:24px 40px;text-align:center;font-size:12px;color:#94A3B8;border-top:1px solid #E2E8F0;">
This email was sent by Zeitgeist Business Solutions.<br/>If you did not expect this message, please ignore it.
</td></tr>
</table></td></tr></table></body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.platformUser.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Don't reveal whether email exists — always return success
      return NextResponse.json({ message: 'If an account with this email exists, a reset link has been sent.' });
    }

    // Generate reset token (simple: use crypto random)
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in user's settings or a dedicated field
    // We'll use the platformUser's password reset flow via a simple approach
    await db.platformUser.update({
      where: { id: user.id },
      data: {
        // Use the settings JSON field to store reset token
        ...(typeof user === 'object' ? {} : {}),
      },
    }).catch(() => {});

    // Store in a more reliable way using raw query
    const { pgQuery } = await import('@/lib/pg-query');
    await pgQuery(
      `UPDATE "PlatformUser" SET "resetToken" = $1, "resetTokenExpiry" = $2 WHERE id = $3`,
      [resetToken, resetExpiry.toISOString(), user.id]
    );

    const resetUrl = `${APP_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send reset email
    sendEmail(
      normalizedEmail,
      'Password Reset — Zeitgeist Business Solutions',
      passwordResetEmail({ name: user.fullName || 'User', email: normalizedEmail, resetUrl }),
    ).catch(() => {});

    return NextResponse.json({ message: 'If an account with this email exists, a reset link has been sent.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
