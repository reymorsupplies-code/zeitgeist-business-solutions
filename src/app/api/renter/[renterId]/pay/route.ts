import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyToken } from '@/lib/auth';

// ── Renter Payment Initiation Endpoint ──
// Allows authenticated renters to initiate payment for a rent payment.
// Supports two payment methods:
//   - "wipay": Creates a WiPay order and returns a payment URL
//   - "cash": Marks the payment as pending landlord confirmation

function verifyRenterToken(req: NextRequest): any {
  const token = extractBearerToken(req);
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rentPaymentId, paymentMethod } = body;

    if (!rentPaymentId || !paymentMethod) {
      return NextResponse.json(
        { error: 'rentPaymentId and paymentMethod are required' },
        { status: 400 }
      );
    }

    if (!['wipay', 'cash'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: 'paymentMethod must be "wipay" or "cash"' },
        { status: 400 }
      );
    }

    const { db } = await import('@/lib/db');
    const { pgQuery } = await import('@/lib/pg-query');

    // Fetch the rent payment and verify it belongs to this renter's lease/tenant
    const rentPayment = await db.rentPayment.findFirst({
      where: {
        id: rentPaymentId,
        tenantId: session.tenantId,
        leaseId: session.leaseId,
      },
      include: {
        property: true,
        lease: true,
      },
    });

    if (!rentPayment) {
      return NextResponse.json(
        { error: 'Rent payment not found or access denied' },
        { status: 404 }
      );
    }

    // Prevent duplicate payments for already paid items
    if (rentPayment.status === 'paid') {
      return NextResponse.json(
        { error: 'This rent payment has already been paid' },
        { status: 400 }
      );
    }

    // ─── WiPay Online Payment ───
    if (paymentMethod === 'wipay') {
      const { getWiPay } = await import('@/lib/wipay');
      const wipay = getWiPay();

      if (!wipay.isConfigured()) {
        return NextResponse.json(
          { error: 'Online payment is not available at this time. Please contact your landlord.' },
          { status: 503 }
        );
      }

      // Calculate amount to pay (amount due minus any partial payments)
      const amountDue = Number(rentPayment.amountDue) + Number(rentPayment.lateFee) - Number(rentPayment.amountPaid);
      if (amountDue <= 0) {
        return NextResponse.json(
          { error: 'No amount due for this rent payment' },
          { status: 400 }
        );
      }

      // Get renter info for the payment
      const renter = await db.renter.findUnique({
        where: { id: renterId },
      });

      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://app.zeitgeist.business';
      const webhookUrl = `${origin}/api/wipay-webhook`;

      // Create the WiPay order
      const orderResult = await wipay.createOrder({
        total: Math.round(amountDue * 100) / 100, // Round to 2 decimals
        currency: rentPayment.currency || 'TTD',
        description: `Rent Payment - ${rentPayment.property?.name || 'Property'} (Period: ${new Date(rentPayment.periodStart).toLocaleDateString()} - ${new Date(rentPayment.periodEnd).toLocaleDateString()})`,
        orderId: rentPaymentId,
        customerName: renter?.fullName || '',
        customerEmail: renter?.email || '',
        customerPhone: renter?.phone || '',
        returnUrl: `${origin}/renter/${renterId}/payments?status=success`,
        cancelUrl: `${origin}/renter/${renterId}/payments?status=cancelled`,
        webhookUrl,
        expiry: 3600, // 1 hour
      });

      if (!orderResult.success) {
        console.error('[Pay] WiPay order creation failed:', orderResult.error);
        return NextResponse.json(
          { error: 'Failed to create payment. Please try again or use cash payment.' },
          { status: 502 }
        );
      }

      // Create a WiPayTransaction record to track this payment attempt
      await pgQuery(
        `INSERT INTO "WiPayTransaction" ("id", "tenantId", "rentPaymentId", "renterId", "paymentMethod", "status", "amount", "currency", "wipayOrderId", "wipayTransactionId", "customerName", "customerEmail", "customerPhone", "ipAddress", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
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
          req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
        ]
      );

      // Update rent payment status to reflect that payment has been initiated
      if (rentPayment.status === 'pending' || rentPayment.status === 'overdue') {
        await db.rentPayment.update({
          where: { id: rentPaymentId },
          data: {
            status: 'partial',
            paymentMethod: 'wipay',
            notes: `${rentPayment.notes || ''}\n[WiPay] Payment initiated at ${new Date().toISOString()}`.trim(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        paymentUrl: orderResult.paymentUrl,
        transactionId: orderResult.transactionId,
        amount: amountDue,
        currency: rentPayment.currency || 'TTD',
        message: 'Redirect the user to the paymentUrl to complete payment.',
      });
    }

    // ─── Cash Payment ───
    if (paymentMethod === 'cash') {
      // Mark the rent payment as pending landlord confirmation
      if (rentPayment.status === 'pending' || rentPayment.status === 'overdue') {
        await db.rentPayment.update({
          where: { id: rentPaymentId },
          data: {
            status: 'partial',
            paymentMethod: 'cash',
            notes: `${rentPayment.notes || ''}\n[Cash] Renter requested cash payment confirmation at ${new Date().toISOString()}`.trim(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Cash payment has been submitted for landlord confirmation. Please give your payment to the landlord and provide a reference number if available.',
        nextStep: 'cash_confirmation',
      });
    }
  } catch (error: any) {
    console.error('[Pay] Error initiating payment:', error);
    return NextResponse.json({ error: 'Error iniciando pago' }, { status: 500 });
  }
}
