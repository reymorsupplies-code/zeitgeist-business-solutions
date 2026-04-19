import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { generateReceiptEmail } from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { tenantId, invoiceNumber, method, currency } = data;

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
    const sym = cur === 'TTD' ? 'TT$' : '$';
    const paymentMethod = method || 'WiPay';

    const price = cur === 'TTD'
      ? (tenant.plan?.priceTTD || 500)
      : (tenant.plan?.priceUSD || 75);

    const receiptNumber = `RCT-${tenant.slug?.toUpperCase().slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    const invoiceRef = invoiceNumber || 'N/A';

    const result = await sendEmail(
      tenant.email,
      `Receipt ${receiptNumber} — Payment Confirmed`,
      generateReceiptEmail({
        tenantName: tenant.name,
        tenantEmail: tenant.email,
        receiptNumber,
        invoiceNumber: invoiceRef,
        planName,
        amount: price.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        currency: sym,
        paidDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        method: paymentMethod,
        billingCycle: 'Monthly',
      }),
    );

    await db.auditLog.create({
      data: {
        tenantId,
        action: 'receipt_sent',
        details: `Receipt ${receiptNumber} sent to ${tenant.email} for ${invoiceRef}`,
        severity: 'info',
      },
    });

    if (result.success) {
      return NextResponse.json({ success: true, receiptNumber, emailId: result.id });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
