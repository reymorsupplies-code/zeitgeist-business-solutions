import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { db } from '@/lib/db';

// ── WiPay Transaction Management (Landlord Dashboard) ──
// GET: List WiPay transactions with filters (status, date range, payment method)
// POST: Create a manual payment link for a rent payment (generate WiPay link)

// Ensure WiPayTransaction table exists (idempotent)
async function ensureWiPayTable() {
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
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_wipayTransactionId" ON "WiPayTransaction"("wipayTransactionId")`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_tenant_status" ON "WiPayTransaction"("tenantId", status)`);
}

// ── GET: List WiPay transactions with filters ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureWiPayTable();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const paymentMethod = searchParams.get('paymentMethod');
    const rentPaymentId = searchParams.get('rentPaymentId');
    const renterId = searchParams.get('renterId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // Build query dynamically
    const conditions: string[] = [`"tenantId" = $1`];
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (status && status !== 'all') {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }
    if (paymentMethod && paymentMethod !== 'all') {
      conditions.push(`"paymentMethod" = $${paramIdx++}`);
      params.push(paymentMethod);
    }
    if (rentPaymentId) {
      conditions.push(`"rentPaymentId" = $${paramIdx++}`);
      params.push(rentPaymentId);
    }
    if (renterId) {
      conditions.push(`"renterId" = $${paramIdx++}`);
      params.push(renterId);
    }
    if (dateFrom) {
      conditions.push(`"createdAt" >= $${paramIdx++}`);
      params.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      conditions.push(`"createdAt" <= $${paramIdx++}`);
      params.push(new Date(dateTo).toISOString());
    }

    const whereClause = conditions.join(' AND ');

    // Get transactions
    const transactions = await pgQuery(
      `SELECT * FROM "WiPayTransaction"
       WHERE ${whereClause}
       ORDER BY "createdAt" DESC
       LIMIT ${Math.max(limit + 1, 0)} OFFSET ${Math.max(offset, 0)}`,
      params
    );

    // Get summary stats
    const stats = await pgQueryOne(
      `SELECT
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
         COUNT(*) FILTER (WHERE status = 'pending' OR status = 'initiated' OR status = 'processing')::int as pending,
         COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
         COUNT(*) FILTER (WHERE status = 'refunded')::int as refunded,
         COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::numeric as totalAmount,
         COALESCE(SUM("wipayFee") FILTER (WHERE status = 'completed'), 0)::numeric as totalFees
       FROM "WiPayTransaction"
       WHERE "tenantId" = $1`,
      [tenantId]
    );

    return NextResponse.json({
      transactions,
      stats: stats || {
        total: 0, completed: 0, pending: 0, failed: 0, refunded: 0,
        totalAmount: 0, totalFees: 0,
      },
      pagination: {
        limit,
        offset,
        hasMore: transactions.length > limit,
      },
    });
  } catch (error: any) {
    console.error('[WiPay Management] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Create manual payment link for a rent payment ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureWiPayTable();

    const body = await req.json();
    const { rentPaymentId } = body;

    if (!rentPaymentId) {
      return NextResponse.json({ error: 'rentPaymentId is required' }, { status: 400 });
    }

    // Verify the rent payment belongs to this tenant
    const rentPayment = await db.rentPayment.findFirst({
      where: {
        id: rentPaymentId,
        property: { tenantId },
      },
      include: {
        property: true,
        lease: true,
        unit: true,
      },
    });

    if (!rentPayment) {
      return NextResponse.json({ error: 'Rent payment not found' }, { status: 404 });
    }

    if (rentPayment.status === 'paid') {
      return NextResponse.json({ error: 'This rent payment is already fully paid' }, { status: 400 });
    }

    // Calculate amount due
    const amountDue = Number(rentPayment.amountDue) + Number(rentPayment.lateFee) - Number(rentPayment.amountPaid);
    if (amountDue <= 0) {
      return NextResponse.json({ error: 'No outstanding amount for this payment' }, { status: 400 });
    }

    // Find the renter associated with this lease
    const renter = rentPayment.leaseId
      ? await db.renter.findFirst({
          where: { leaseId: rentPayment.leaseId, status: 'active' },
        })
      : null;

    const { getWiPay } = await import('@/lib/wipay');
    const wipay = getWiPay();

    if (!wipay.isConfigured()) {
      return NextResponse.json(
        { error: 'WiPay is not configured. Please set WIPAY_API_KEY and WIPAY_MERCHANT_ID.' },
        { status: 503 }
      );
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://app.zeitgeist.business';
    const webhookUrl = `${origin}/api/wipay-webhook`;

    // Generate a hosted payment link
    const paymentUrl = wipay.generatePaymentLink({
      total: Math.round(amountDue * 100) / 100,
      currency: rentPayment.currency || 'TTD',
      description: `Rent Payment - ${rentPayment.property?.name || 'Property'} Unit ${rentPayment.unit?.unitNumber || ''}`,
      orderId: rentPaymentId,
      customerName: renter?.fullName || '',
      customerEmail: renter?.email || '',
      customerPhone: renter?.phone || '',
      returnUrl: `${origin}/renter/${renter?.id || 'portal'}/payments?status=success`,
      cancelUrl: `${origin}/renter/${renter?.id || 'portal'}/payments?status=cancelled`,
      webhookUrl,
    });

    // Create a WiPayTransaction record for tracking
    await pgQuery(
      `INSERT INTO "WiPayTransaction" ("id", "tenantId", "rentPaymentId", "renterId", "paymentMethod", "status", "amount", "currency", "wipayOrderId", "customerName", "customerEmail", "customerPhone", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        crypto.randomUUID(),
        tenantId,
        rentPaymentId,
        renter?.id || null,
        'wipay',
        'initiated',
        amountDue,
        rentPayment.currency || 'TTD',
        rentPaymentId,
        renter?.fullName || '',
        renter?.email || '',
        renter?.phone || '',
      ]
    );

    return NextResponse.json({
      success: true,
      paymentUrl,
      amount: amountDue,
      currency: rentPayment.currency || 'TTD',
      rentPaymentId,
      renter: renter ? { id: renter.id, name: renter.fullName, email: renter.email } : null,
      message: 'Share this payment link with the renter. They will be redirected to WiPay to complete the payment.',
    });
  } catch (error: any) {
    console.error('[WiPay Management] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
