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

// ─── 10. Registration Pending (User Notification) ──────────

export function registrationPending(data: { name: string; email: string; companyName: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Application Received! 📋</h1>
      <p>Hi ${data.name},</p>
      <p>Thank you for registering <strong>${data.companyName}</strong> on Zeitgeist Business Solutions.</p>
      <p>Your application is currently <strong style="color:#B45309;">under review</strong>. Our team will verify your information and get back to you within <strong>24–48 hours</strong> during business days.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#92400E;">
          <strong>What happens next?</strong><br/>
          <ol style="margin:8px 0 0 0;padding-left:20px;">
            <li style="margin-bottom:4px;">We review your application</li>
            <li style="margin-bottom:4px;">You receive an approval email</li>
            <li style="margin-bottom:4px;">Your free trial begins immediately</li>
          </ol>
        </td></tr>
      </table>
      <p>No payment is required at this time. You will not be charged until your free trial ends and you choose to subscribe.</p>
    `)}
    ${footer()}`,
    'Your ZBS application has been received. We will review it shortly.'
  );
}

// ─── 11. New Registration (Admin Notification) ─────────────

export function newRegistrationAdmin(data: { name: string; email: string; companyName: string; industry?: string; plan?: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">🔔 New Registration Pending Approval</h1>
      <p>A new business has registered and is waiting for your review:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;">
          <strong style="color:#0F1A2E;">Registration Details</strong><br/><br/>
          <strong>Business:</strong> ${data.companyName}<br/>
          <strong>Contact:</strong> ${data.name}<br/>
          <strong>Email:</strong> <a href="mailto:${data.email}" style="color:#1D4ED8;">${data.email}</a><br/>
          ${data.industry ? `<strong>Industry:</strong> ${data.industry}<br/>` : ''}
          ${data.plan ? `<strong>Plan:</strong> ${data.plan}<br/>` : ''}
          <strong>Submitted:</strong> ${new Date().toLocaleString()}
        </td></tr>
      </table>
    `)}
    ${button('Open Control Tower', 'https://zeitgeist.business')}
    ${footer()}`,
    `New registration: ${data.companyName} — pending approval`
  );
}

// ─── 12. Registration Approved (User) ──────────────────────

export function registrationApproved(data: { name: string; companyName: string; trialDays: number }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#16A34A;">Approved! Your Trial Has Started 🎉</h1>
      <p>Hi ${data.name},</p>
      <p>Great news! Your application for <strong>${data.companyName}</strong> has been <strong style="color:#16A34A;">approved</strong>.</p>
      <p>Your <strong>${data.trialDays}-day free trial</strong> starts now. Log in and start exploring every module — no restrictions, no commitments.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#166534;">
          <strong>Trial Details</strong><br/>
          Duration: ${data.trialDays} days<br/>
          Access: All features unlocked<br/>
          Cost: $0.00 — no payment required during trial
        </td></tr>
      </table>
    `)}
    ${button('Log In Now', 'https://zeitgeist.business')}
    ${footer()}`,
    'Your ZBS trial has been approved! Log in to get started.'
  );
}

// ─── 13. Registration Rejected (User) ──────────────────────

export function registrationRejected(data: { name: string; companyName: string; reason?: string }): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#DC2626;">Application Update</h1>
      <p>Hi ${data.name},</p>
      <p>We have reviewed the application for <strong>${data.companyName}</strong> and unfortunately, we were unable to approve it at this time.</p>
      ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#991B1B;">
          <strong>What can I do?</strong><br/>
          If you believe this is an error, or if you have additional information to provide, please reply to this email or contact us at <a href="mailto:admin@zeitgeist.business" style="color:#1D4ED8;">admin@zeitgeist.business</a>.
        </td></tr>
      </table>
    `)}
    ${button('Contact Support', 'mailto:admin@zeitgeist.business', '#DC2626')}
    ${footer()}`,
    'Update on your ZBS application'
  );
}

// ─── 14. Platform Receipt Email ─────────────────────────────

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

// ─── 15. Insurance Claim Acknowledged ──────────────────────

export function insuranceClaimAcknowledged(data: {
  insuredName: string;
  claimNumber: string;
  policyNumber: string;
  claimType: string;
  incidentDate: string;
  assignedTo: string;
  companyName: string;
  portalUrl: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Claim Acknowledged 📋</h1>
      <p>Dear ${data.insuredName},</p>
      <p>We confirm that your claim has been received and is now being reviewed by our claims team. Your claim has been assigned to <strong>${data.assignedTo}</strong>, who will be your dedicated adjuster throughout the process.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;">
          <strong style="color:#0F1A2E;">Claim Details</strong><br/><br/>
          <strong>Claim Number:</strong> ${data.claimNumber}<br/>
          <strong>Policy Number:</strong> ${data.policyNumber}<br/>
          <strong>Claim Type:</strong> ${data.claimType}<br/>
          <strong>Incident Date:</strong> ${data.incidentDate}<br/>
          <strong>Assigned Adjuster:</strong> ${data.assignedTo}
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#92400E;">
          <strong>What happens next?</strong><br/>
          <ol style="margin:8px 0 0 0;padding-left:20px;">
            <li style="margin-bottom:4px;">Your adjuster will review the submitted documentation</li>
            <li style="margin-bottom:4px;">You may be contacted for additional information</li>
            <li style="margin-bottom:4px;">You will receive a status update within 5 business days</li>
          </ol>
        </td></tr>
      </table>
      <p>If you have any questions, please don't hesitate to contact your adjuster or visit your portal.</p>
    `)}
    ${button('View Claim in Portal', data.portalUrl)}
    ${footer()}`,
    `Claim ${data.claimNumber} acknowledged by ${data.companyName}`
  );
}

// ─── 16. Insurance Claim Status Update ────────────────────

export function insuranceClaimStatusUpdate(data: {
  insuredName: string;
  claimNumber: string;
  newStatus: string;
  statusDescription: string;
  nextSteps: string;
  companyName: string;
  portalUrl: string;
}): string {
  const statusColor = ['approved', 'settled', 'complete'].some(s => data.newStatus.toLowerCase().includes(s)) ? '#16A34A'
    : ['denied', 'rejected', 'closed'].some(s => data.newStatus.toLowerCase().includes(s)) ? '#DC2626'
    : '#B45309';
  const statusBg = statusColor === '#16A34A' ? '#F0FDF4' : statusColor === '#DC2626' ? '#FEF2F2' : '#FFFBEB';
  const statusBorder = statusColor === '#16A34A' ? '#BBF7D0' : statusColor === '#DC2626' ? '#FECACA' : '#FDE68A';
  const statusTextColor = statusColor === '#16A34A' ? '#166534' : statusColor === '#DC2626' ? '#991B1B' : '#92400E';

  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Claim Status Update</h1>
      <p>Dear ${data.insuredName},</p>
      <p>Your claim <strong>${data.claimNumber}</strong> has been updated.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${statusBg};border-radius:8px;border:1px solid ${statusBorder};">
        <tr><td style="padding:16px 20px;font-size:14px;color:${statusTextColor};">
          <strong style="font-size:16px;">New Status: ${data.newStatus}</strong><br/><br/>
          ${data.statusDescription}
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;">
          <strong style="color:#0F1A2E;">Next Steps</strong><br/><br/>
          ${data.nextSteps.replace(/\n/g, '<br/>')}
        </td></tr>
      </table>
      <p>You can monitor the progress of your claim at any time through your online portal.</p>
    `)}
    ${button('View Claim in Portal', data.portalUrl)}
    ${footer()}`,
    `Claim ${data.claimNumber} updated: ${data.newStatus}`
  );
}

// ─── 17. Insurance Claim Settlement ───────────────────────

export function insuranceClaimSettlement(data: {
  insuredName: string;
  claimNumber: string;
  settlementAmount: string;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  companyName: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#16A34A;">Claim Settled ✅</h1>
      <p>Dear ${data.insuredName},</p>
      <p>We are pleased to inform you that your claim <strong>${data.claimNumber}</strong> has been settled. Payment has been processed and will be disbursed as detailed below.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#F0FDF4;border-bottom:2px solid #16A34A;">
          <td style="padding:16px 20px;font-size:14px;color:#166534;">
            <strong>✅ Settlement Approved</strong><br/>
            <span style="font-size:12px;">Claim #${data.claimNumber}</span>
          </td>
          <td style="padding:16px 20px;font-size:20px;font-weight:800;color:#166534;text-align:right;">${data.currency}${data.settlementAmount}</td>
        </tr>
        <tr>
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Claim Number</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.claimNumber}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Payment Method</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.paymentMethod}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Expected Payment Date</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#16A34A;text-align:right;">${data.paymentDate}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#166534;">
          <strong>Please note:</strong> Payment processing times may vary depending on your financial institution. If you do not receive your settlement within 10 business days of the expected date, please contact our claims department.
        </td></tr>
      </table>
      <p>Thank you for your patience throughout this process. We appreciate your trust in ${data.companyName}.</p>
    `)}
    ${footer()}`,
    `Claim ${data.claimNumber} settled — ${data.currency}${data.settlementAmount}`
  );
}

// ─── 18. Insurance Policy Renewal ─────────────────────────

export function insurancePolicyRenewal(data: {
  insuredName: string;
  policyNumber: string;
  policyType: string;
  currentExpiry: string;
  renewalPremium: string;
  currency: string;
  coverage: string;
  companyName: string;
  portalUrl: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#B45309;">Policy Renewal Reminder ⏰</h1>
      <p>Dear ${data.insuredName},</p>
      <p>Your <strong>${data.policyType}</strong> policy is approaching its expiry date. To ensure uninterrupted coverage, please review your renewal details below and take action before <strong style="color:#DC2626;">${data.currentExpiry}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#0F1A2E;">
          <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#D4A843;">Policy Number</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#FFFFFF;text-align:right;">${data.policyNumber}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Policy Type</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.policyType}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Current Expiry</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#DC2626;text-align:right;">${data.currentExpiry}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Renewal Premium</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#1D4ED8;text-align:right;">${data.currency}${data.renewalPremium}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Coverage</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.coverage}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#92400E;">
          <strong>Important:</strong> If your policy lapses, you may experience a gap in coverage. Any claims arising during a lapse period will not be covered. Renew early to avoid disruption.
        </td></tr>
      </table>
      <p>Log in to your portal to review your renewal offer, update your details, or make your renewal payment.</p>
    `)}
    ${button('Renew Policy', data.portalUrl, '#B45309')}
    ${footer()}`,
    `Policy ${data.policyNumber} expires on ${data.currentExpiry} — Renew now`
  );
}

// ─── 19. Insurance Quote Sent ─────────────────────────────

export function insuranceQuoteSent(data: {
  insuredName: string;
  quoteNumber: string;
  productName: string;
  quotedPremium: string;
  currency: string;
  quotedCoverage: string;
  validUntil: string;
  companyName: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Your Insurance Quote 📄</h1>
      <p>Dear ${data.insuredName},</p>
      <p>Thank you for your interest in ${data.companyName}. We have prepared your personalised quote for <strong>${data.productName}</strong> coverage.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#0F1A2E;">
          <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#D4A843;">Quote Number</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#FFFFFF;text-align:right;">${data.quoteNumber}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Product</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.productName}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Quoted Coverage</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1D4ED8;text-align:right;">${data.quotedCoverage}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Annual Premium</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.currency}${data.quotedPremium}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Valid Until</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#B45309;text-align:right;">${data.validUntil}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#166534;">
          <strong>What's included?</strong><br/>
          This quote includes standard coverages and benefits for the selected product. Optional add-ons and endorsements are available upon request — speak with your advisor to customise your plan.
        </td></tr>
      </table>
      <p>This quote is valid until <strong style="color:#B45309;">${data.validUntil}</strong>. Premiums may change after this date based on updated risk assessment.</p>
    `)}
    ${footer()}`,
    `Quote ${data.quoteNumber} for ${data.productName} — ${data.currency}${data.quotedPremium}`
  );
}

// ─── 20. Insurance Portal Welcome ─────────────────────────

export function insurancePortalWelcome(data: {
  insuredName: string;
  portalUrl: string;
  companyName: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Welcome to Your Insurance Portal 🛡️</h1>
      <p>Dear ${data.insuredName},</p>
      <p>${data.companyName} has set up your personalised insurance portal. This secure online platform gives you 24/7 access to manage your policies, track claims, and stay on top of important deadlines.</p>
      <p>Here is what you can do from your portal:</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li style="margin-bottom:8px;"><strong>View Policies</strong> — See all active policies, coverage details, and renewal dates.</li>
        <li style="margin-bottom:8px;"><strong>Track Claims</strong> — Monitor the progress of your claims in real time.</li>
        <li style="margin-bottom:8px;"><strong>Make Payments</strong> — Pay premiums securely online.</li>
        <li style="margin-bottom:8px;"><strong>Download Documents</strong> — Access certificates, policy documents, and receipts.</li>
        <li style="margin-bottom:8px;"><strong>Update Information</strong> — Keep your contact and coverage details current.</li>
      </ul>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#166534;">
          <strong>🔒 Secure Access:</strong> This portal link is unique to you. Do not share it with others. If you did not request this access, please contact us immediately.
        </td></tr>
      </table>
    `)}
    ${button('Access Your Portal', data.portalUrl)}
    ${footer()}`,
    `Access your ${data.companyName} insurance portal`
  );
}

// ─── 21. Insurance Premium Due ────────────────────────────

export function insurancePremiumDue(data: {
  insuredName: string;
  policyNumber: string;
  amount: string;
  currency: string;
  dueDate: string;
  companyName: string;
  portalUrl: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#B45309;">Premium Payment Reminder 💳</h1>
      <p>Dear ${data.insuredName},</p>
      <p>This is a reminder that your insurance premium is coming due. Timely payment ensures your coverage remains active and uninterrupted.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#0F1A2E;">
          <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#D4A843;">Policy Number</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#FFFFFF;text-align:right;">${data.policyNumber}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Premium Due</td>
          <td style="padding:14px 20px;font-size:16px;font-weight:700;color:#0F1A2E;text-align:right;">${data.currency}${data.amount}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Due Date</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#DC2626;text-align:right;">${data.dueDate}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#991B1B;">
          <strong>⚠️ Please pay on or before the due date.</strong> Late payments may result in a lapse of coverage. If your policy lapses, any claims during the lapse period will not be covered, and reinstatement may require additional documentation or underwriting review.
        </td></tr>
      </table>
      <p>Log in to your portal to make a secure payment, set up auto-pay, or view your billing history.</p>
    `)}
    ${button('Pay Now', data.portalUrl, '#B45309')}
    ${footer()}`,
    `Premium of ${data.currency}${data.amount} due on ${data.dueDate}`
  );
}

// ─── 22. Insurance New Policy ─────────────────────────────

export function insuranceNewPolicy(data: {
  insuredName: string;
  policyNumber: string;
  policyType: string;
  premium: string;
  currency: string;
  coverage: string;
  startDate: string;
  endDate: string;
  companyName: string;
  portalUrl: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#16A34A;">Your Policy Is Active! 🎉</h1>
      <p>Dear ${data.insuredName},</p>
      <p>Congratulations! Your <strong>${data.policyType}</strong> policy has been issued by ${data.companyName}. Your coverage is now active. Please review your policy details below and keep this email for your records.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#0F1A2E;">
          <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#D4A843;">Policy Number</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#FFFFFF;text-align:right;">${data.policyNumber}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Policy Type</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.policyType}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Coverage</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1D4ED8;text-align:right;">${data.coverage}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Annual Premium</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.currency}${data.premium}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Effective Date</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#16A34A;text-align:right;">${data.startDate}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Expiry Date</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.endDate}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#166534;">
          <strong>Welcome aboard!</strong> Log in to your portal to download your policy documents, set up auto-pay, and explore additional coverage options.
        </td></tr>
      </table>
      <p>Thank you for choosing ${data.companyName}. We are committed to protecting what matters most to you.</p>
    `)}
    ${button('View Your Policy', data.portalUrl)}
    ${footer()}`,
    `Your ${data.policyType} policy ${data.policyNumber} is now active`
  );
}

// ─── 23. Insurance Document Request ───────────────────────

export function insuranceDocumentRequest(data: {
  insuredName: string;
  claimNumber: string;
  documentTypes: string;
  companyName: string;
  portalUrl: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Documents Required 📎</h1>
      <p>Dear ${data.insuredName},</p>
      <p>As part of the assessment for your claim <strong>${data.claimNumber}</strong>, our underwriting team requires additional documentation to proceed with the evaluation.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#92400E;">
          <strong style="color:#0F1A2E;font-size:15px;">Requested Documents</strong><br/><br/>
          ${data.documentTypes.replace(/\n/g, '<br/>')}
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;">
          <strong style="color:#0F1A2E;">Upload Instructions</strong><br/><br/>
          <ol style="margin:8px 0 0 0;padding-left:20px;">
            <li style="margin-bottom:4px;">Log in to your insurance portal</li>
            <li style="margin-bottom:4px;">Navigate to the Documents section for claim ${data.claimNumber}</li>
            <li style="margin-bottom:4px;">Upload clear, legible copies of each requested document</li>
            <li style="margin-bottom:4px;">Accepted formats: PDF, JPG, PNG (max 10MB each)</li>
          </ol>
        </td></tr>
      </table>
      <p><strong style="color:#B45309;">Please submit the requested documents within 10 business days</strong> to avoid delays in processing your claim. If you have any questions about the requirements, contact our underwriting team.</p>
    `)}
    ${button('Upload Documents', data.portalUrl, '#B45309')}
    ${footer()}`,
    `Action required: Documents needed for claim ${data.claimNumber}`
  );
}

// ─── 24. Insurance Agent Commission ───────────────────────

export function insuranceAgentCommission(data: {
  agentName: string;
  statementNumber: string;
  periodStart: string;
  periodEnd: string;
  totalCommission: string;
  currency: string;
  policiesCount: number;
  companyName: string;
}): string {
  return baseWrapper(
    `${header()}
    ${section(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Commission Statement 💰</h1>
      <p>Hi ${data.agentName},</p>
      <p>Your commission statement for the period <strong>${data.periodStart}</strong> to <strong>${data.periodEnd}</strong> is now available. Please review the summary below.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#F0FDF4;border-bottom:2px solid #16A34A;">
          <td style="padding:16px 20px;font-size:14px;color:#166534;">
            <strong>Total Commission Earned</strong><br/>
            <span style="font-size:12px;">Statement #${data.statementNumber}</span>
          </td>
          <td style="padding:16px 20px;font-size:20px;font-weight:800;color:#166534;text-align:right;">${data.currency}${data.totalCommission}</td>
        </tr>
        <tr>
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Statement Number</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.statementNumber}</td>
        </tr>
        <tr style="background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Period</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#0F1A2E;text-align:right;">${data.periodStart} — ${data.periodEnd}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:14px 20px;font-size:14px;color:#334155;">Policies Written</td>
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1D4ED8;text-align:right;">${data.policiesCount}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
        <tr><td style="padding:16px 20px;font-size:14px;color:#334155;">
          <strong style="color:#0F1A2E;">Disbursement Details</strong><br/><br/>
          Commission payments are processed on the 15th of each month for the preceding period. Your payment will be deposited directly into your registered bank account. If you have changed your banking details, please update them in your agent portal before the next disbursement date.
        </td></tr>
      </table>
      <p>For a detailed breakdown of your commissions by policy, please refer to the full statement in your agent portal. If you have any discrepancies, contact our finance team within 30 days.</p>
    `)}
    ${footer()}`,
    `Commission statement ${data.statementNumber}: ${data.currency}${data.totalCommission} earned`
  );
}
