-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 9: WiPay Payment Gateway Integration + Cash Payments for Renters
--
-- WiPayTransaction: Records all payment transactions processed through
-- WiPay (online payments) and cash payments recorded by landlords.
--
-- Tracks the full lifecycle: initiated → processing → completed / failed / refunded
-- Links to RentPayment for rent-specific transactions.
-- Stores WiPay-specific metadata (transaction IDs, fees, card info).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── WiPayTransaction ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WiPayTransaction" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,

  -- Linked rent payment (nullable — supports future non-rent payments)
  "rentPaymentId" TEXT,

  -- Renter who initiated the payment
  "renterId"      TEXT,

  -- Payment method: "wipay" for online, "cash" for cash recordings
  "paymentMethod" TEXT NOT NULL DEFAULT 'wipay',

  -- Transaction status lifecycle
  --   initiated   → Payment order created, awaiting customer
  --   processing  → Customer is on WiPay checkout page
  --   completed   → Payment successfully captured
  --   failed      → Payment declined or error
  --   refunded    → Full or partial refund issued
  --   expired     → Payment link expired
  status          TEXT NOT NULL DEFAULT 'initiated',

  -- Amount details
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'TTD',
  "processingFee" NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- WiPay-specific fields
  "wipayOrderId"      TEXT,
  "wipayTransactionId" TEXT UNIQUE,
  "wipayFee"          NUMERIC(14,2) NOT NULL DEFAULT 0,
  "wipayCurrency"     TEXT,
  "cardType"          TEXT,         -- visa, mastercard, etc.
  "cardLast4"         TEXT,         -- Last 4 digits of card

  -- Customer info (snapshot at time of payment)
  "customerName"  TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,

  -- Cash payment fields (used when paymentMethod = 'cash')
  "cashReference" TEXT,             -- Receipt number or reference
  "cashNotes"     TEXT,             -- Notes from landlord or renter

  -- Refund tracking
  "refundAmount"    NUMERIC(14,2) NOT NULL DEFAULT 0,
  "refundReason"    TEXT,
  "refundedAt"      TIMESTAMPTZ,

  -- IP address for fraud audit
  "ipAddress"       TEXT,

  -- Timestamps
  "initiatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt"   TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_tenantId" ON "WiPayTransaction"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_rentPaymentId" ON "WiPayTransaction"("rentPaymentId");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_renterId" ON "WiPayTransaction"("renterId");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_status" ON "WiPayTransaction"("status");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_tenant_status" ON "WiPayTransaction"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_wipayTransactionId" ON "WiPayTransaction"("wipayTransactionId") WHERE "wipayTransactionId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_paymentMethod" ON "WiPayTransaction"("tenantId", "paymentMethod");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_createdAt" ON "WiPayTransaction"("tenantId", "createdAt");

-- ─── Enable RLS (Row Level Security) ────────────────────────────────────────
ALTER TABLE "WiPayTransaction" ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can only see their own transactions
CREATE POLICY "wipay_transaction_tenant_isolation" ON "WiPayTransaction"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));

-- ─── Column comments for documentation ──────────────────────────────────────
COMMENT ON TABLE "WiPayTransaction" IS 'Phase 9: WiPay payment transactions and cash payment records for rent payments';
COMMENT ON COLUMN "WiPayTransaction"."paymentMethod" IS 'Payment method: wipay (online) or cash (manual recording)';
COMMENT ON COLUMN "WiPayTransaction"."wipayTransactionId" IS 'Unique WiPay transaction ID — used for verification and refunds';
COMMENT ON COLUMN "WiPayTransaction"."cashReference" IS 'Reference number when paymentMethod is cash (receipt, cheque #, etc.)';
