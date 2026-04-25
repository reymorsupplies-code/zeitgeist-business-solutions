/**
 * Renter Pay Online API — Generate a WiPay payment link for a specific rent payment.
 * This is a convenience endpoint that renters use from the renter portal UI.
 * Returns the WiPay payment URL to redirect the user to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyToken } from '@/lib/auth';

function verifyRenterToken(req: NextRequest): any {
  const token = extractBearerToken(req);
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rentPaymentId } = body;

    if (!rentPaymentId) {
      return NextResponse.json({ error: 'rentPaymentId is required' }, { status: 400 });
    }

    const { db } = await import('@/lib/db');
    const { pgQuery } = await import('@/lib/pg-query');

    // Fetch the rent payment
    const rentPayment = await db.rentPayment.findFirst({
      where: {
        id: rentPaymentId,
        tenantId: session.tenantId,
      },
      include: {
        property: true,
        lease: true,
      },
    });

    if (!rentPayment) {
      return NextResponse.json({ error: 'Rent payment not found' }, { status: 404 });
    }

    if (rentPayment.status === 'paid') {
      return NextResponse.json({ error: 'This payment has already been paid' }, { status: 400 });
    }

    // Get WiPay instance
    const { getWiPay } = await import('@/lib/wipay');
    const wipay = getWiPay();

    if (!wipay.isConfigured()) {
      return NextResponse.json(
        { error: 'Online payment is not available at this time' },
        { status: 503 }
      );
    }

    // Calculate amount due
    const amountDue = Number(rentPayment.amountDue) + Number(rentPayment.lateFee) - Number(rentPayment.amountPaid);
    if (amountDue <= 0) {
      return NextResponse.json({ error: 'No amount due' }, { status: 400 });
    }

    // Get renter info
    const renter = await db.renter.findUnique({ where: { id: renterId } });

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://app.zeitgeist.business';
    const webhookUrl = `${origin}/api/wipay-webhook`;

    const orderResult = await wipay.createOrder({
      total: Math.round(amountDue * 100) / 100,
      currency: rentPayment.currency || 'TTD',
      description: `Rent Payment - ${rentPayment.property?.name || 'Property'}`,
      orderId: rentPaymentId,
      customerName: renter?.fullName || '',
      customerEmail: renter?.email || '',
      customerPhone: renter?.phone || '',
      returnUrl: `${origin}?renter_portal=true&payment=success`,
      cancelUrl: `${origin}?renter_portal=true&payment=cancelled`,
      webhookUrl,
      expiry: 3600,
    });

    if (!orderResult.success || !orderResult.paymentUrl) {
      return NextResponse.json(
        { error: 'Failed to create payment link' },
        { status: 502 }
      );
    }

    // Create WiPayTransaction record
    await pgQuery(
      `INSERT INTO "WiPayTransaction" ("id", "tenantId", "rentPaymentId", "renterId", "paymentMethod", "status", "amount", "currency", "wipayOrderId", "wipayTransactionId", "customerName", "customerEmail", "customerPhone", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
      [
        crypto.randomUUID(),
        session.tenantId,
        rentPaymentId,
        renterId,
        'wipay',
        'initiated',
        amountDue,
        rentPayment.currency || 'TTD',
        orderResult.orderId || rentPaymentId,
        orderResult.transactionId || null,
        renter?.fullName || '',
        renter?.email || '',
        renter?.phone || '',
      ]
    );

    return NextResponse.json({
      success: true,
      paymentUrl: orderResult.paymentUrl,
      transactionId: orderResult.transactionId,
      amount: amountDue,
      currency: rentPayment.currency || 'TTD',
    });
  } catch (error: any) {
    console.error('[Pay Online] Error:', error);
    return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 });
  }
}
