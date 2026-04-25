-- ============================================================================
-- Phase 4+5 Migration: Insurance Portal & Reports Tables
-- ============================================================================
-- Description:
--   Adds tables supporting client portal access tokens, configurable
--   underwriting rules, agent commission tracking, and regulatory
--   filing management for the insurance module (Phases 4 & 5).
--
-- Supabase Project: lvgmgdggaiwqjbctnqqm
-- ============================================================================

-- ============================================================================
-- 1. PortalToken – Client portal access tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PortalToken" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "insuredId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'portal',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "maxUses" INTEGER NOT NULL DEFAULT 0,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortalToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortalToken_token_key" ON "PortalToken"("token");
CREATE INDEX IF NOT EXISTS "PortalToken_tenantId_idx" ON "PortalToken"("tenantId");
CREATE INDEX IF NOT EXISTS "PortalToken_token_idx" ON "PortalToken"("token");
CREATE INDEX IF NOT EXISTS "PortalToken_insuredId_idx" ON "PortalToken"("insuredId");

ALTER TABLE "PortalToken" ADD CONSTRAINT "PortalToken_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortalToken" ADD CONSTRAINT "PortalToken_insuredId_fkey"
  FOREIGN KEY ("insuredId") REFERENCES "Insured"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 2. UnderwritingRule – Configurable underwriting rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS "UnderwritingRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "productCategory" TEXT NOT NULL DEFAULT 'all',
  "ruleType" TEXT NOT NULL DEFAULT 'threshold',
  "field" TEXT NOT NULL,
  "operator" TEXT NOT NULL DEFAULT 'gt',
  "value" TEXT NOT NULL,
  "valueTo" TEXT,
  "action" TEXT NOT NULL DEFAULT 'refer',
  "actionValue" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnderwritingRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UnderwritingRule_tenantId_idx" ON "UnderwritingRule"("tenantId");
CREATE INDEX IF NOT EXISTS "UnderwritingRule_tenantId_productCategory_idx" ON "UnderwritingRule"("tenantId", "productCategory");
CREATE INDEX IF NOT EXISTS "UnderwritingRule_tenantId_isActive_idx" ON "UnderwritingRule"("tenantId", "isActive");

ALTER TABLE "UnderwritingRule" ADD CONSTRAINT "UnderwritingRule_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 3. CommissionStatement – Agent commission tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS "CommissionStatement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "statementNumber" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "totalPremium" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalCommission" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "policiesCount" INTEGER NOT NULL DEFAULT 0,
  "newBusiness" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "renewals" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionStatement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommissionStatement_tenantId_idx" ON "CommissionStatement"("tenantId");
CREATE INDEX IF NOT EXISTS "CommissionStatement_tenantId_agentId_idx" ON "CommissionStatement"("tenantId", "agentId");
CREATE INDEX IF NOT EXISTS "CommissionStatement_tenantId_status_idx" ON "CommissionStatement"("tenantId", "status");

ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "InsuranceAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 4. RegulatoryReport – Regulatory filing tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS "RegulatoryReport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "data" TEXT NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "submittedTo" TEXT,
  "submittedAt" TIMESTAMP(3),
  "submittedBy" TEXT,
  "notes" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegulatoryReport_tenantId_idx" ON "RegulatoryReport"("tenantId");
CREATE INDEX IF NOT EXISTS "RegulatoryReport_tenantId_reportType_idx" ON "RegulatoryReport"("tenantId", "reportType");
CREATE INDEX IF NOT EXISTS "RegulatoryReport_tenantId_status_idx" ON "RegulatoryReport"("tenantId", "status");

ALTER TABLE "RegulatoryReport" ADD CONSTRAINT "RegulatoryReport_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
