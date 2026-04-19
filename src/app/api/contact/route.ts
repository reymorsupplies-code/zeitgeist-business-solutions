import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, ADMIN_EMAIL } from '@/lib/email';
import {
  contactFormAdminNotification,
  contactFormAutoReply,
} from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, industry, message } = body;

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 },
      );
    }

    const submittedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    // 1. Send admin notification
    const adminHtml = contactFormAdminNotification({
      name,
      email,
      phone: phone || undefined,
      industry: industry || undefined,
      message,
      submittedAt,
    });

    const adminResult = await sendEmail(
      ADMIN_EMAIL,
      `[ZBS Contact] New inquiry from ${name}`,
      adminHtml,
      email, // reply-to the visitor
    );

    // 2. Send auto-reply to visitor
    const replyHtml = contactFormAutoReply({ name });

    const replyResult = await sendEmail(
      email,
      'Thank you for contacting Zeitgeist Business Solutions',
      replyHtml,
    );

    // Log results (non-blocking)
    if (!adminResult.success) {
      console.warn('[Contact API] Admin notification failed:', adminResult.error);
    }
    if (!replyResult.success) {
      console.warn('[Contact API] Auto-reply failed:', replyResult.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully. We will get back to you within 24 hours.',
    });
  } catch (error: any) {
    console.error('[Contact API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error.' },
      { status: 500 },
    );
  }
}
