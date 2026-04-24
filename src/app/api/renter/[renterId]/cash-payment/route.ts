import { NextRequest, NextResponse } from 'next/server';

// ── Cash Payment Recording (Renter Portal) ──
// Allows authenticated renters to record that they have made a cash payment.
// The landlord will need to confirm the payment.
//
// POST: Record cash payment
//   Body: { rentPaymentId, amount, reference, notes }

function verifyRenterToken(req: NextRequest): any {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!auth) return null;
  try {
    const payload = JSON.parse(Buffer.from(auth, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ renterId: string }> }) {
  const { renterId } = await params;
  const session = verifyRenterToken(req);
  if (!session || session.renterId !== renterId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rentPaymentId, amount, reference, notes } = body;

    if (!rentPaymentId || !amount) {
      return NextResponse.json(
        { error: 'rentPaymentId and amount are required' },
        { status: 400 }
      );
    }

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    const { db } = await import('@/lib/db');
    const { pgQuery } = await import('@/lib/pg-query');

    // Ensure WiPayTransaction table exists
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "WiPayTransaction" (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"      TEXT NOT NULL,
        "rentPaymentId" TEXT,
        "renterId"      TEXT,
        "paymentMethod" TEXT NOT NULL DEFAULT 'wipay',
        status          TEXT NOT NULL DEFAULT 'initiated',
        amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
        currency        TEXT NOT NULL DEFAULT 'TTD',
        "processingFee" NUMERIC(14,2) NOT NULL DEFAULT 0,
        "wipayOrderId"      TEXT,
        "wipayTransactionId" TEXT,
        "wipayFee"          NUMERIC(14,2) NOT NULL DEFAULT 0,
        "wipayCurrency"     TEXT,
        "cardType"          TEXT,
        "cardLast4"         TEXT,
        "customerName"  TEXT,
        "customerEmail" TEXT,
        "customerPhone" TEXT,
        "cashReference" TEXT,
        "cashNotes"     TEXT,
        "refundAmount"    NUMERIC(14,2) NOT NULL DEFAULT 0,
        "refundReason"    TEXT,
        "refundedAt"      TIMESTAMPTZ,
        "ipAddress"       TEXT,
        "initiatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "completedAt"   TIMESTAMPTZ,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_tenantId" ON "WiPayTransaction"("tenantId")`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_rentPaymentId" ON "WiPayTransaction"("rentPaymentId")`);

    // Fetch the rent payment and verify it belongs to this renter
    const rentPayment = await db.rentPayment.findFirst({
      where: {
        id: rentPaymentId,
        tenantId: session.tenantId,
        leaseId: session.leaseId,
      },
      include: {
        property: true,
        unit: true,
      },
    });

    if (!rentPayment) {
      return NextResponse.json(
        { error: 'Rent payment not found or access denied' },
        { status: 404 }
      );
    }

    if (rentPayment.status === 'paid') {
      return NextResponse.json(
        { error: 'This rent payment has already been paid' },
        { status: 400 }
      );
    }

    // Verify the amount doesn't exceed what's due
    const amountDue = Number(rentPayment.amountDue) + Number(rentPayment.lateFee) - Number(rentPayment.amountPaid);
    if (paymentAmount > amountDue) {
      return NextResponse.json(
        { error: `Amount exceeds balance due of ${rentPayment.currency} ${amountDue.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Get renter info
    const renter = await db.renter.findUnique({
      where: { id: renterId },
    });

    // Create a WiPayTransaction record with paymentMethod = 'cash'
    // Status is 'initiated' — landlord needs to confirm
    const cashTxn = await pgQuery(
      `INSERT INTO "WiPayTransaction" ("id", "tenantId", "rentPaymentId", "renterId", "paymentMethod", "status", "amount", "currency", "cashReference", "cashNotes", "customerName", "customerEmail", "customerPhone", "initiatedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW())
       RETURNING *`,
      [
        crypto.randomUUID(),
        session.tenantId,
        rentPaymentId,
        renterId,
        'cash',
        'initiated', // Awaiting landlord confirmation
        paymentAmount,
        rentPayment.currency || 'TTD',
        reference || '',
        notes || '',
        renter?.fullName || '',
        renter?.email || '',
        renter?.phone || '',
      ]
    );

    // Update rent payment status to reflect cash payment submission
    await db.rentPayment.update({
      where: { id: rentPaymentId },
      data: {
        status: 'partial',
        paymentMethod: 'cash',
        notes: `${rentPayment.notes || ''}\n[Cash] Renter recorded cash payment of ${rentPayment.currency} ${paymentAmount.toFixed(2)} at ${new Date().toISOString()}${reference ? ` (Ref: ${reference})` : ''}`.trim(),
      },
    });

    // Send notification to landlord
    try {
      await db.notification.create({
        data: {
          tenantId: session.tenantId,
          title: `Cash Payment Submitted - ${rentPayment.property?.name || 'Property'}`,
          message: `${renter?.fullName || 'Renter'} has recorded a cash payment of ${rentPayment.currency} ${paymentAmount.toFixed(2)} for unit ${rentPayment.unit?.unitNumber || 'N/A'}. Please verify and confirm this payment.${reference ? ` Reference: ${reference}` : ''}`,
          type: 'payment_received',
          category: 'payment',
          metadata: JSON.stringify({
            type: 'cash_payment_submitted',
            rentPaymentId,
            renterId,
            amount: paymentAmount,
            currency: rentPayment.currency || 'TTD',
            cashTransactionId: cashTxn[0]?.id,
            reference,
          }),
        },
      });
    } catch (notifyError) {
      console.error('[Cash Payment] Failed to create landlord notification:', notifyError);
    }

    return NextResponse.json({
      success: true,
      transaction: cashTxn[0],
      message: 'Cash payment recorded. Your landlord will be notified to confirm this payment.',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Cash Payment] Error recording cash payment:', error);
    return NextResponse.json({ error: 'Error registrando pago en efectivo' }, { status: 500 });
  }
}
