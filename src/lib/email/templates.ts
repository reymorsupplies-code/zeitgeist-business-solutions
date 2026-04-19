/**
 * ZBS Professional Email Templates
 *
 * All templates return ready-to-send HTML with inline styles.
 * Brand colours: #1D4ED8 (blue), #D4A843 (gold), #0F1A2E (navy).
 */

// ─── Shared helpers ────────────────────────────────────────────

function baseWrapper(inner: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Zeitgeist Business Solutions</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
${preheader ? `<div style="display:none;font-size:1px;color:#F4F6F9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;min-height:100%;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,26,46,0.08);">
${inner}
</table></td></tr>
<tr><td align="center" style="padding:24px 16px 40px;font-size:12px;color:#94A3B8;text-align:center;">
&copy; ${new Date().getFullYear()} Zeitgeist Business Solutions &mdash; Building the Digital Landlord for the Caribbean<br/>
<a href="https://zeitgeist.business" style="color:#1D4ED8;text-decoration:none;">zeitgeist.business</a>
</td></tr>
</table></body></html>`;
}

function header() {
  return `<tr><td style="background:linear-gradient(135deg,#0F1A2E,#1E3A8A);padding:32px 40px;text-align:center;">
<a href="https://zeitgeist.business" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px;">
<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#D4A843,#F0D68A);color:#0F1A2E;font-weight:800;font-size:18px;">Z</span>
<span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Zeitgeist Business Solutions</span>
</a>
</td></tr>`;
}

function footer(unsubscribe = false) {
  const extra = unsubscribe
    ? `<br/><br/><a href="#" style="color:#94A3B8;text-decoration:underline;">Unsubscribe</a> from marketing emails.`
    : '';
  return `<tr><td style="padding:24px 40px;text-align:center;font-size:12px;color:#94A3B8;border-top:1px solid #E2E8F0;">
This email was sent by Zeitgeist Business Solutions.<br/>
If you did not expect this message, please ignore it.${extra}
</td></tr>`;
}

function button(label: string, href: string, color = '#1D4ED8') {
  return `<tr><td style="padding:0 40px 32px;text-align:center;">
<a href="${href}" style="display:inline-block;padding:14px 32px;background:${color};color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>
</td></tr>`;
}

function section(html: string) {
  return `<tr><td style="padding:32px 40px;font-size:15px;line-height:1.7;color:#334155;">${html}</td></tr>`;
}

// ─── 1. Registration Welcome ──────────────────────────────────

export function registrationWelcome(data: { name: string; email: string; tenantName: string; planName: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Welcome aboard, ${data.name}! 🎉</h1>
      <p>Your account for <strong>${data.tenantName}</strong> has been successfully created.</p>
      <p>You are now on the <strong style="color:#1D4ED8;">${data.planName}</strong> plan. Your 7-day free trial starts today — explore every module, invite your team, and see how ZBS transforms your operations.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;">
          <strong style="color:#0F1A2E;">Account Details</strong><br/>
          Email: ${data.email}<br/>
          Business: ${data.tenantName}<br/>
          Plan: ${data.planName}
        </td></tr>
      </table>
      <p>Need help? Reply to this email or visit our <a href="https://zeitgeist.business" style="color:#1D4ED8;">help center</a>.</p>
    `)}
    ${button('Go to Dashboard', 'https://zeitgeist.business')}
    ${footer()}`,
    'Your ZBS account is ready! Start your free trial today.'
  );
}

// ─── 2. Payment Confirmation ──────────────────────────────────

export function paymentConfirmation(data: { name: string; tenantName: string; planName: string; amount: string; currency: string; nextBilling: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Payment Confirmed ✅</h1>
      <p>Hi ${data.name},</p>
      <p>We have received your payment successfully. Here is your receipt:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;">
          <strong style="color:#0F1A2E;">Payment Summary</strong><br/><br/>
          Business: ${data.tenantName}<br/>
          Plan: ${data.planName}<br/>
          Amount: <strong>${data.currency}${data.amount}</strong><br/>
          Next billing date: ${data.nextBilling}
        </td></tr>
      </table>
      <p>Thank you for choosing Zeitgeist Business Solutions. Your account is active and all features are unlocked.</p>
    `)}
    ${button('View Invoice', 'https://zeitgeist.business')}
    ${footer()}`,
    'Your payment has been confirmed. Thank you!'
  );
}

// ─── 3. Trial Expiring (3 days before) ────────────────────────

export function trialExpiring(data: { name: string; tenantName: string; expiryDate: string; planName: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#B45309;">⏰ Your Free Trial Ends in 3 Days</h1>
      <p>Hi ${data.name},</p>
      <p>Your <strong>${data.planName}</strong> trial for <strong>${data.tenantName}</strong> expires on <strong style="color:#B45309;">${data.expiryDate}</strong>.</p>
      <p>Don't lose access to your data and settings. Upgrade now to keep everything running smoothly — no interruption, no setup required.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#92400E;">
          <strong>What happens if you don't upgrade?</strong><br/>
          Your account will be paused. All data is preserved for 30 days, but you won't be able to access it until you subscribe.
        </td></tr>
      </table>
    `)}
    ${button('Upgrade Now', 'https://zeitgeist.business', '#B45309')}
    ${footer()}`,
    'Your free trial expires soon. Upgrade to keep your account active.'
  );
}

// ─── 4. Account Suspended ─────────────────────────────────────

export function accountSuspended(data: { name: string; tenantName: string; reason: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#DC2626;">Account Suspended</h1>
      <p>Hi ${data.name},</p>
      <p>Your account for <strong>${data.tenantName}</strong> has been suspended.</p>
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p>Your data is safe and preserved. To reactivate your account, please contact our team or reply directly to this email.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#991B1B;">
          <strong>Need help?</strong><br/>
          Contact us at <a href="mailto:admin@zeitgeist.business" style="color:#1D4ED8;">admin@zeitgeist.business</a> and we will assist you promptly.
        </td></tr>
      </table>
    `)}
    ${button('Contact Support', 'mailto:admin@zeitgeist.business', '#DC2626')}
    ${footer()}`,
    'Your ZBS account has been suspended. Contact us to reactivate.'
  );
}

// ─── 5. Daily Report (Admin) ─────────────────────────────────

export function dailyReport(data: { totalTenants: number; activeTrials: number; newSignups: number; activeSubscriptions: number; revenue: string; currency: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">📊 Daily Platform Report</h1>
      <p>Here is your ZBS platform summary for today, ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#F8FAFC;">
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;">Total Tenants</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#1D4ED8;text-align:right;">${data.totalTenants}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Active Subscriptions</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#16A34A;text-align:right;">${data.activeSubscriptions}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Active Trials</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#B45309;text-align:right;">${data.activeTrials}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">New Sign-ups Today</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.newSignups}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Revenue (MTD)</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#16A34A;text-align:right;">${data.currency}${data.revenue}</td>
        </tr>
      </table>
    `)}
    ${button('Open Control Tower', 'https://zeitgeist.business')}
    ${footer()}`,
    'Your daily ZBS platform report is ready.'
  );
}

// ─── 6. Welcome to ZBS (General) ──────────────────────────────

export function welcomeToZBS(data: { name: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Welcome to Zeitgeist Business Solutions 👋</h1>
      <p>Hi ${data.name},</p>
      <p>Thank you for joining ZBS — the Digital Building for Caribbean businesses. We are thrilled to have you on board.</p>
      <p>Here is what you can look forward to:</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li style="margin-bottom:8px;"><strong>Industry-Tailored Suites</strong> — Bakery, Salon & Spa, Retail, and more.</li>
        <li style="margin-bottom:8px;"><strong>Complete Operations Hub</strong> — Invoicing, inventory, appointments, bookkeeping.</li>
        <li style="margin-bottom:8px;"><strong>Multi-Currency Support</strong> — TTD, USD, JMD, BBD, and more.</li>
        <li style="margin-bottom:8px;"><strong>Enterprise-Grade Security</strong> — Your data is protected at every layer.</li>
      </ul>
      <p>If you have any questions or need help getting started, our team is just an email away.</p>
    `)}
    ${button('Get Started', 'https://zeitgeist.business')}
    ${footer()}`,
    'Welcome to ZBS — the Digital Landlord for Caribbean business.'
  );
}

// ─── 7. Contact Form Admin Notification ───────────────────────

export function contactFormAdminNotification(data: { name: string; email: string; phone?: string; industry?: string; message: string; submittedAt: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">📩 New Contact Form Submission</h1>
      <p>A new inquiry has been submitted via the website contact form:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;">
          <strong style="color:#0F1A2E;">Contact Details</strong><br/><br/>
          <strong>Name:</strong> ${data.name}<br/>
          <strong>Email:</strong> <a href="mailto:${data.email}" style="color:#1D4ED8;">${data.email}</a><br/>
          ${data.phone ? `<strong>Phone:</strong> ${data.phone}<br/>` : ''}
          ${data.industry ? `<strong>Industry:</strong> ${data.industry}<br/>` : ''}
          <strong>Submitted:</strong> ${data.submittedAt}
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;">
          <strong style="color:#0F1A2E;">Message</strong><br/><br/>
          ${data.message.replace(/\n/g, '<br/>')}
        </td></tr>
      </table>
      <p><strong>Recommended Action:</strong> Reply to ${data.email} within 24 hours.</p>
    `)}
    ${button('Reply Now', `mailto:${data.email}`)}
    ${footer()}`,
    `New contact form inquiry from ${data.name}`
  );
}

// ─── 8. Contact Form Auto-Reply to Visitor ────────────────────

export function contactFormAutoReply(data: { name: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Thank You, ${data.name}! 🙏</h1>
      <p>We have received your message and will get back to you within <strong>24 hours</strong> during business days (Monday – Friday).</p>
      <p>In the meantime, feel free to explore our <a href="https://zeitgeist.business" style="color:#1D4ED8;">website</a> to learn more about how ZBS can transform your business operations.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#166534;">
          <strong>Quick Tip:</strong> Book a free demo and see ZBS in action for your specific industry.
        </td></tr>
      </table>
      <p>Best regards,<br/><strong>The Zeitgeist Team</strong></p>
    `)}
    ${button('Explore ZBS', 'https://zeitgeist.business')}
    ${footer(true)}`,
    'We received your message. We will reply within 24 hours.'
  );
}

// ─── 9. Platform Invoice Email ──────────────────────────────

export function generateInvoiceEmail(data: {
  tenantName: string;
  tenantEmail: string;
  invoiceNumber: string;
  planName: string;
  amount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  billingCycle: string;
  description?: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Invoice</h1>
      <p>Hi ${data.tenantName},</p>
      <p>Please find your subscription invoice below. Payment is due by <strong style="color:#B45309;">${data.dueDate}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#0F1A2E;">
          <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#D4A843;">Invoice #</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#FFFFFF;text-align:right;">${data.invoiceNumber}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Business</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.tenantName}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Plan</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1D4ED8;text-align:right;">${data.planName}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Billing Cycle</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.billingCycle}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Issue Date</td>
          <td style="padding:14px 20px;font-size:14px;color:#0F1A2E;text-align:right;">${data.issueDate}</td>
        </tr>
        ${data.description ? `<tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Description</td>
          <td style="padding:14px 20px;font-size:14px;color:#0F1A2E;text-align:right;">${data.description}</td>
        </tr>` : ''}
        <tr style="background:linear-gradient(135deg,#0F1A2E,#1E3A8A);border-top:2px solid #D4A843;">
          <td style="padding:16px 20px;font-size:15px;font-weight:700;color:#D4A843;">Total Due</td>
          <td style="padding:16px 20px;font-size:18px;font-weight:800;color:#FFFFFF;text-align:right;">${data.currency}${data.amount}</td>
        </tr>
      </table>
      <p>Please remit payment via WiPay or bank transfer. Reference <strong>${data.invoiceNumber}</strong> in your payment memo.</p>
    `)}
    ${button('Pay Now', 'https://zeitgeist.business', '#B45309')}
    ${footer()}`,
    `Invoice ${data.invoiceNumber} — ${data.tenantName}`
  );
}

// ─── 10. Platform Receipt Email ─────────────────────────────

export function generateReceiptEmail(data: {
  tenantName: string;
  tenantEmail: string;
  receiptNumber: string;
  invoiceNumber: string;
  planName: string;
  amount: string;
  currency: string;
  paidDate: string;
  method: string;
  billingCycle: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Payment Receipt ✅</h1>
      <p>Hi ${data.tenantName},</p>
      <p>We have received your payment. Thank you! Here is your receipt:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#F0FDF4;border-bottom:2px solid #16A34A;">
          <td style="padding:16px 20px;font-size:14px;color:#166534;">
            <strong>✅ Payment Confirmed</strong><br/>
            <span style="font-size:12px;">Receipt #${data.receiptNumber}</span>
          </td>
          <td style="padding:16px 20px;font-size:20px;font-weight:800;color:#166534;text-align:right;">${data.currency}${data.amount}</td>
        </tr>
        <tr>
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Business</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.tenantName}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Plan</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1D4ED8;text-align:right;">${data.planName}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Invoice Ref</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.invoiceNumber}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Billing Cycle</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.billingCycle}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Payment Method</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.method}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Date Paid</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.paidDate}</td>
        </tr>
      </table>
      <p>Your subscription is active and all features are unlocked. Thank you for choosing Zeitgeist Business Solutions!</p>
    `)}
    ${footer()}`,
    `Receipt ${data.receiptNumber} — Payment confirmed`
  );
}
