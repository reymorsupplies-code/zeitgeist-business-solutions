-- ═══════════════════════════════════════════════════════════════════════════════
-- ZBS — MIGRACIONES COMBINADAS Phases 4, 7, 9, 10  (CORREGIDA)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Pegar → Run
-- Crea: 7 tablas, 30+ índices, 7 políticas RLS
-- ═══════════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 4: Landlord ↔ Tenant Chat / Messaging System
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS "ChatConversation" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "renterId"      TEXT NOT NULL,
  "propertyId"    TEXT,
  "unitId"        TEXT,
  "leaseId"       TEXT,
  subject         TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  "lastMessageAt" TIMESTAMPTZ,
  "lastMessagePreview" TEXT,
  "lastMessageFrom" TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatConversation_tenant_renter_active_key"
  ON "ChatConversation"("tenantId", "renterId", "propertyId") WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS "idx_ChatConversation_tenantId" ON "ChatConversation"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_ChatConversation_renterId" ON "ChatConversation"("renterId");
CREATE INDEX IF NOT EXISTS "idx_ChatConversation_propertyId" ON "ChatConversation"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_ChatConversation_status" ON "ChatConversation"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_ChatConversation_lastMessageAt" ON "ChatConversation"("tenantId", "lastMessageAt" DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conversationId" TEXT NOT NULL REFERENCES "ChatConversation"(id) ON DELETE CASCADE,
  "tenantId"      TEXT NOT NULL,
  "senderType"    TEXT NOT NULL,
  "senderId"      TEXT,
  content         TEXT NOT NULL,
  "messageType"   TEXT NOT NULL DEFAULT 'text',
  "fileUrl"       TEXT,
  "fileName"      TEXT,
  "landlordReadAt" TIMESTAMPTZ,
  "renterReadAt"  TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ChatMessage_conversationId" ON "ChatMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_tenantId" ON "ChatMessage"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_createdAt" ON "ChatMessage"("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_senderType" ON "ChatMessage"("conversationId", "senderType");
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_unread_landlord" ON "ChatMessage"("conversationId", "createdAt" DESC)
  WHERE "landlordReadAt" IS NULL AND "senderType" = 'renter';
CREATE INDEX IF NOT EXISTS "idx_ChatMessage_unread_renter" ON "ChatMessage"("conversationId", "createdAt" DESC)
  WHERE "renterReadAt" IS NULL AND "senderType" = 'landlord';

ALTER TABLE "ChatConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_conversation_tenant_isolation" ON "ChatConversation"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));
CREATE POLICY "chat_message_tenant_isolation" ON "ChatMessage"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 7: Landlord Surcharge Compliance T&T (effective January 2026)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS "SurchargeConfig" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "surchargeRate" NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  "effectiveDate" TIMESTAMPTZ NOT NULL DEFAULT '2026-01-01 00:00:00+00',
  "isApplicable"  BOOLEAN NOT NULL DEFAULT false,
  currency        TEXT NOT NULL DEFAULT 'TTD',
  exemptions      TEXT NOT NULL DEFAULT '[]',
  "capAmount"     NUMERIC(14,2),
  "floorAmount"   NUMERIC(14,2),
  notes           TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "SurchargeConfig_tenantId_key" ON "SurchargeConfig"("tenantId");

CREATE INDEX IF NOT EXISTS "idx_SurchargeConfig_tenantId" ON "SurchargeConfig"("tenantId");

CREATE TABLE IF NOT EXISTS "SurchargeRecord" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "configId"      TEXT NOT NULL REFERENCES "SurchargeConfig"(id) ON DELETE RESTRICT,
  "leaseId"       TEXT NOT NULL,
  "propertyId"    TEXT NOT NULL,
  "unitId"        TEXT NOT NULL,
  "periodStart"   TIMESTAMPTZ NOT NULL,
  "periodEnd"     TIMESTAMPTZ NOT NULL,
  "periodLabel"   TEXT,
  "baseRent"      NUMERIC(14,2) NOT NULL DEFAULT 0,
  "surchargeRate" NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  "surchargeAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "capAmount"     NUMERIC(14,2),
  "floorAmount"   NUMERIC(14,2),
  status          TEXT NOT NULL DEFAULT 'pending',
  "collectedAt"   TIMESTAMPTZ,
  "remittedAt"    TIMESTAMPTZ,
  "remittanceRef" TEXT,
  currency        TEXT NOT NULL DEFAULT 'TTD',
  notes           TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "SurchargeRecord_lease_period_key" ON "SurchargeRecord"("leaseId", "periodStart", "periodEnd");

CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_tenantId" ON "SurchargeRecord"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_configId" ON "SurchargeRecord"("configId");
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_leaseId" ON "SurchargeRecord"("leaseId");
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_propertyId" ON "SurchargeRecord"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_status" ON "SurchargeRecord"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_period" ON "SurchargeRecord"("tenantId", "periodStart", "periodEnd");

ALTER TABLE "SurchargeConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SurchargeRecord" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surcharge_config_tenant_isolation" ON "SurchargeConfig"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));
CREATE POLICY "surcharge_record_tenant_isolation" ON "SurchargeRecord"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 9: WiPay Payment Gateway Integration + Cash Payments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
);

CREATE UNIQUE INDEX IF NOT EXISTS "WiPayTransaction_wipayTransactionId_key" ON "WiPayTransaction"("wipayTransactionId") WHERE "wipayTransactionId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_tenantId" ON "WiPayTransaction"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_rentPaymentId" ON "WiPayTransaction"("rentPaymentId");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_renterId" ON "WiPayTransaction"("renterId");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_status" ON "WiPayTransaction"("status");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_tenant_status" ON "WiPayTransaction"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_paymentMethod" ON "WiPayTransaction"("tenantId", "paymentMethod");
CREATE INDEX IF NOT EXISTS "idx_WiPayTransaction_createdAt" ON "WiPayTransaction"("tenantId", "createdAt");

ALTER TABLE "WiPayTransaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wipay_transaction_tenant_isolation" ON "WiPayTransaction"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));

COMMENT ON TABLE "WiPayTransaction" IS 'Phase 9: WiPay payment transactions and cash payment records for rent payments';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 10: Tenant Application Screening System
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS "TenantApplication" (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"            TEXT NOT NULL,
  "propertyId"          TEXT,
  "unitId"              TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  "firstName"           TEXT NOT NULL,
  "lastName"            TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT,
  "dateOfBirth"         TIMESTAMPTZ,
  "nationalId"          TEXT,
  employer              TEXT,
  "jobTitle"            TEXT,
  "monthlyIncome"       NUMERIC(14,2),
  "employmentLength"    TEXT,
  "previousAddress"     TEXT,
  "previousLandlordName" TEXT,
  "previousLandlordPhone" TEXT,
  "reasonForLeaving"    TEXT,
  "reference1Name"      TEXT,
  "reference1Phone"     TEXT,
  "reference1Email"     TEXT,
  "reference2Name"      TEXT,
  "reference2Phone"     TEXT,
  "reference2Email"     TEXT,
  "screeningScore"      INTEGER,
  "riskLevel"           TEXT,
  "screeningNotes"      TEXT,
  "backgroundCheckStatus" TEXT NOT NULL DEFAULT 'not_started',
  "idDocumentUrl"       TEXT,
  "incomeProofUrl"      TEXT,
  "employmentLetterUrl" TEXT,
  "desiredMoveInDate"   TIMESTAMPTZ,
  "leaseTermPreference" TEXT,
  "numberOfOccupants"   INTEGER,
  "hasPets"             BOOLEAN NOT NULL DEFAULT false,
  "petDescription"      TEXT,
  "reviewedBy"          TEXT,
  "reviewedAt"          TIMESTAMPTZ,
  "rejectionReason"     TEXT,
  notes                 TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_TenantApplication_tenantId"          ON "TenantApplication"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_tenantId_status"   ON "TenantApplication"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_email"             ON "TenantApplication"(email);
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_unitId"            ON "TenantApplication"("unitId");
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_propertyId"        ON "TenantApplication"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_status"            ON "TenantApplication"(status);
CREATE INDEX IF NOT EXISTS "idx_TenantApplication_createdAt"         ON "TenantApplication"("tenantId", "createdAt" DESC);

ALTER TABLE "TenantApplication" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_application_tenant_isolation" ON "TenantApplication"
  FOR ALL USING ("tenantId" = current_setting('request.jwt.claims.tenantId', true));

COMMENT ON TABLE "TenantApplication" IS 'Phase 10: Rental applications with screening scores and risk assessment';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as columns,
  (SELECT count(*) FROM pg_indexes i WHERE i.tablename = t.table_name) as indexes
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('ChatConversation','ChatMessage','SurchargeConfig','SurchargeRecord','WiPayTransaction','TenantApplication')
ORDER BY table_name;
