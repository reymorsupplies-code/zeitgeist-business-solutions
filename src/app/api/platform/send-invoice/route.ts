import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { generateInvoiceEmail } from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { tenantId, currency, billingCycle, description } = data;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    if (!tenant.email) {
      return NextResponse.json({ error: 'Tenant has no email' }, { status: 400 });
    }

    const planName = tenant.planName || tenant.plan?.name || 'Starter Suite';
    const cur = currency || tenant.currency || 'TTD';
    const cycle = billingCycle || 'monthly';
    const sym = cur === 'TTD' ? 'TT$' : '$';

    const price = cur === 'TTD'
      ? (tenant.plan?.priceTTD || 500)
      : (tenant.plan?.priceUSD || 75);

    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const invoiceNumber = `INV-${tenant.slug?.toUpperCase().slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;

    // Create a PlatformInvoice record
    await db.platformInvoice.create({
      data: {
        tenantId,
        invoiceNumber,
        amountUSD: cur === 'USD' ? price : 0,
        amountTTD: cur === 'TTD' ? price : 0,
        status: 'sent',
        issueDate,
        dueDate,
      },
    });

    const result = await sendEmail(
      tenant.email,
      `Invoice ${invoiceNumber} — ${tenant.name}`,
      generateInvoiceEmail({
        tenantName: tenant.name,
        tenantEmail: tenant.email,
        invoiceNumber,
        planName,
        amount: price.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        currency: sym,
        issueDate: issueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        dueDate: dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        billingCycle: cycle.charAt(0).toUpperCase() + cycle.slice(1),
        description: description || `${planName} subscription — ${cycle}`,
      }),
    );

    await db.auditLog.create({
      data: {
        tenantId,
        action: 'invoice_sent',
        details: `Invoice ${invoiceNumber} sent to ${tenant.email}`,
        severity: 'info',
      },
    });

    if (result.success) {
      return NextResponse.json({ success: true, invoiceNumber, emailId: result.id });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
