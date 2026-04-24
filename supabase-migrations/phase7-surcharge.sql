-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 7: Landlord Surcharge Compliance T&T (effective January 2026)
--
-- The Residential Tenancies Act in Trinidad & Tobago (effective Jan 2026)
-- introduces surcharges that landlords may be required to collect and remit
-- to the Board of Inland Revenue (BIR).
--
-- SurchargeConfig: One configuration per tenant (landlord business).
--   - Defines the surcharge rate, effective date, exemptions.
--   - isApplicable flag to enable/disable surcharge collection.
--
-- SurchargeRecord: One record per lease per billing period.
--   - Immutable compliance records — no DELETE allowed.
--   - Tracks base rent, surcharge rate, calculated surcharge amount.
--   - Status tracks collection lifecycle: pending → collected/waived/overdue.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── SurchargeConfig ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SurchargeConfig" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,

  -- Surcharge rate as a decimal (e.g. 0.05 = 5%)
  "surchargeRate" NUMERIC(6,4) NOT NULL DEFAULT 0.0000,

  -- Date when surcharge collection becomes effective
  "effectiveDate" TIMESTAMPTZ NOT NULL DEFAULT '2026-01-01 00:00:00+00',

  -- Whether surcharge is currently being collected
  "isApplicable"  BOOLEAN NOT NULL DEFAULT false,

  -- Currency (default TTD for T&T)
  currency        TEXT NOT NULL DEFAULT 'TTD',

  -- JSON array of exempt lease IDs or property types
  -- e.g. ["government", "charity", "lease_id_here"]
  exemptions      TEXT NOT NULL DEFAULT '[]',

  -- Cap: maximum surcharge amount per period (NULL = no cap)
  "capAmount"     NUMERIC(14,2),

  -- Floor: minimum surcharge amount per period (NULL = no floor)
  "floorAmount"   NUMERIC(14,2),

  -- Notes
  notes           TEXT,

  -- Timestamps
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One config per tenant
  CONSTRAINT "SurchargeConfig_tenantId_key" UNIQUE ("tenantId")
);

CREATE INDEX IF NOT EXISTS "idx_SurchargeConfig_tenantId" ON "SurchargeConfig"("tenantId");

-- ─── SurchargeRecord ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SurchargeRecord" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "configId"      TEXT NOT NULL REFERENCES "SurchargeConfig"(id) ON DELETE RESTRICT,

  -- Lease / Property / Unit references
  "leaseId"       TEXT NOT NULL,
  "propertyId"    TEXT NOT NULL,
  "unitId"        TEXT NOT NULL,

  -- Billing period
  "periodStart"   TIMESTAMPTZ NOT NULL,
  "periodEnd"     TIMESTAMPTZ NOT NULL,

  -- Period label (e.g. "Jan 2026", "Q1 2026")
  "periodLabel"   TEXT,

  -- Rent amounts for the period
  "baseRent"      NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Surcharge calculation
  "surchargeRate" NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  "surchargeAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Cap/floor applied
  "capAmount"     NUMERIC(14,2),
  "floorAmount"   NUMERIC(14,2),

  -- Collection status: pending, collected, waived, overdue, remitted
  status          TEXT NOT NULL DEFAULT 'pending',

  -- When collected
  "collectedAt"   TIMESTAMPTZ,

  -- When remitted to BIR
  "remittedAt"    TIMESTAMPTZ,

  -- BIR remittance reference
  "remittanceRef" TEXT,

  -- Currency
  currency        TEXT NOT NULL DEFAULT 'TTD',

  -- Notes (e.g. reason for waiver)
  notes           TEXT,

  -- Timestamps
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One record per lease per period
  CONSTRAINT "SurchargeRecord_lease_period_key" UNIQUE ("leaseId", "periodStart", "periodEnd")
);

CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_tenantId" ON "SurchargeRecord"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_configId" ON "SurchargeRecord"("configId");
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_leaseId" ON "SurchargeRecord"("leaseId");
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_propertyId" ON "SurchargeRecord"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_status" ON "SurchargeRecord"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_period" ON "SurchargeRecord"("tenantId", "periodStart", "periodEnd");

-- ─── Enable RLS (Row Level Security) ────────────────────────────────────────
ALTER TABLE "SurchargeConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SurchargeRecord" ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can only see their own config
CREATE POLICY "surcharge_config_tenant_isolation" ON "SurchargeConfig"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));

-- Policy: tenants can only see their own records
CREATE POLICY "surcharge_record_tenant_isolation" ON "SurchargeRecord"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));
