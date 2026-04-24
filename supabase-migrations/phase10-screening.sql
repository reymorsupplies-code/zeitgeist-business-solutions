-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 10: Tenant Application Screening System
--
-- TenantApplication: Tracks rental applications submitted by prospective
-- tenants. Includes applicant info, employment & income data, rental history,
-- references, screening results (score/risk), and uploaded documents.
--
-- The screening score (0-100) is auto-calculated based on:
--   Income-to-rent ratio (30pts), Employment length (20pts),
--   References (15pts), ID doc (10pts), Income proof (10pts),
--   Employment letter (10pts), Previous rental history (5pts).
-- Risk level: 70+ = low, 40-69 = medium, <40 = high.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── TenantApplication ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TenantApplication" (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"            TEXT NOT NULL,

  -- Property / unit the applicant is applying for
  "propertyId"          TEXT,
  "unitId"              TEXT,

  -- Application status lifecycle:
  --   pending     → Application submitted, awaiting review
  --   reviewing   → Landlord is actively reviewing
  --   approved    → Application accepted
  --   rejected    → Application denied
  --   withdrawn   → Applicant withdrew their application
  --   waitlisted  → Placed on waiting list (unit not available)
  status                TEXT NOT NULL DEFAULT 'pending',

  -- ── Applicant personal info ──
  "firstName"           TEXT NOT NULL,
  "lastName"            TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT,
  "dateOfBirth"         TIMESTAMPTZ,
  "nationalId"          TEXT,           -- T&T national ID or passport number

  -- ── Employment & income ──
  employer              TEXT,
  "jobTitle"            TEXT,
  "monthlyIncome"       NUMERIC(14,2),
  "employmentLength"    TEXT,           -- e.g. "3yrs", "6mo", "<6mo"

  -- ── Rental history ──
  "previousAddress"     TEXT,
  "previousLandlordName" TEXT,
  "previousLandlordPhone" TEXT,
  "reasonForLeaving"    TEXT,

  -- ── References ──
  "reference1Name"      TEXT,
  "reference1Phone"     TEXT,
  "reference1Email"     TEXT,
  "reference2Name"      TEXT,
  "reference2Phone"     TEXT,
  "reference2Email"     TEXT,

  -- ── Screening results ──
  "screeningScore"      INTEGER,        -- 0-100 calculated score
  "riskLevel"           TEXT,           -- "low" (70+), "medium" (40-69), "high" (<40)
  "screeningNotes"      TEXT,           -- Internal notes from landlord
  "backgroundCheckStatus" TEXT NOT NULL DEFAULT 'not_started',
                                          -- not_started, in_progress, completed, failed

  -- ── Uploaded documents (URLs) ──
  "idDocumentUrl"       TEXT,           -- National ID / passport scan
  "incomeProofUrl"      TEXT,           -- Payslips, bank statements
  "employmentLetterUrl" TEXT,           -- Employment verification letter

  -- ── Preferences ──
  "desiredMoveInDate"   TIMESTAMPTZ,
  "leaseTermPreference" TEXT,           -- "6_months", "1_year", "2_years"
  "numberOfOccupants"   INTEGER,
  "hasPets"             BOOLEAN NOT NULL DEFAULT false,
  "petDescription"      TEXT,

  -- ── Review / decision ──
  "reviewedBy"          TEXT,           -- User ID of the landlord who reviewed
  "reviewedAt"          TIMESTAMPTZ,
  "rejectionReason"     TEXT,
  notes                 TEXT,           -- General notes

  -- ── Timestamps ──
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_tenantId"          ON "TenantApplication"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_tenantId_status"   ON "TenantApplication"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_email"             ON "TenantApplication"(email);
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_unitId"            ON "TenantApplication"("unitId");
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_propertyId"        ON "TenantApplication"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_status"            ON "TenantApplication"(status);
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_createdAt"         ON "TenantApplication"("tenantId", "createdAt" DESC);

-- ─── Enable RLS (Row Level Security) ────────────────────────────────────────
ALTER TABLE "TenantApplication" ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can only see their own applications
CREATE POLICY "tenant_application_tenant_isolation" ON "TenantApplication"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));

-- ─── Column comments for documentation ──────────────────────────────────────
COMMENT ON TABLE "TenantApplication" IS 'Phase 10: Rental applications with screening scores and risk assessment';
COMMENT ON COLUMN "TenantApplication"."screeningScore" IS 'Auto-calculated 0-100 score based on income, employment, references, and documents';
COMMENT ON COLUMN "TenantApplication"."riskLevel" IS 'low (70+), medium (40-69), high (<40)';
COMMENT ON COLUMN "TenantApplication"."employmentLength" IS 'Free text or coded: >3yrs, 1-3yrs, 6mo-1yr, <6mo';
COMMENT ON COLUMN "TenantApplication"."leaseTermPreference" IS 'Desired lease duration: 6_months, 1_year, 2_years';
