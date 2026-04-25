-- =============================================
-- ZBS Phase 12: Insurance Module Expansion
-- Class B+ Insurance Management System
-- =============================================

-- 1. ALTER existing Policy table (expand fields)
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "insuredId" TEXT;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "agentId" TEXT;
ALTER TABLE "Policy" ALTER COLUMN "type" SET DEFAULT 'property';
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "subType" TEXT;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "excessAmount" DECIMAL(14,2) DEFAULT 0;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "deductibleAmount" DECIMAL(14,2) DEFAULT 0;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "paymentFrequency" TEXT DEFAULT 'annual';
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "nextPremiumDue" TIMESTAMP(3);
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "sumInsured" DECIMAL(14,2) DEFAULT 0;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "renewalCount" INTEGER DEFAULT 0;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "parentPolicyId" TEXT;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "coInsurance" DOUBLE PRECISION DEFAULT 0;

-- 2. ALTER existing Claim table (expand fields)
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'medium';
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "reserveAmount" DECIMAL(14,2) DEFAULT 0;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "settlementAmount" DECIMAL(14,2) DEFAULT 0;
ALTER TABLE "Claim" ALTER COLUMN "type" SET DEFAULT 'property';
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "decision" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "denialReason" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "dateReported" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "dateAcknowledged" TIMESTAMP(3);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "dateAssessed" TIMESTAMP(3);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "dateSettled" TIMESTAMP(3);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "policeReportNumber" TEXT;

-- 3. CREATE Insured table
CREATE TABLE IF NOT EXISTS "Insured" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" TEXT,
    "gender" TEXT,
    "nationalId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "occupation" TEXT,
    "employer" TEXT,
    "idType" TEXT,
    "idExpiry" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "Insured_tenantId_idx" ON "Insured"("tenantId");
CREATE INDEX IF NOT EXISTS "Insured_tenantId_nationalId_idx" ON "Insured"("tenantId", "nationalId");

-- 4. CREATE InsuranceAgent table
CREATE TABLE IF NOT EXISTS "InsuranceAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "agentCode" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "commissionRate" DECIMAL(5,2) DEFAULT 0,
    "status" TEXT DEFAULT 'active',
    "joinDate" TIMESTAMP(3),
    "address" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "InsuranceAgent_tenantId_idx" ON "InsuranceAgent"("tenantId");
CREATE INDEX IF NOT EXISTS "InsuranceAgent_tenantId_agentCode_idx" ON "InsuranceAgent"("tenantId", "agentCode");

-- 5. CREATE InsuranceProduct table
CREATE TABLE IF NOT EXISTS "InsuranceProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT DEFAULT 'property',
    "description" TEXT,
    "basePremium" DECIMAL(14,2) DEFAULT 0,
    "minCoverage" DECIMAL(14,2) DEFAULT 0,
    "maxCoverage" DECIMAL(14,2) DEFAULT 0,
    "excessPercent" DECIMAL(5,2) DEFAULT 0,
    "deductible" DECIMAL(14,2) DEFAULT 0,
    "termsMonths" INTEGER DEFAULT 12,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" TEXT DEFAULT '{}',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "InsuranceProduct_tenantId_idx" ON "InsuranceProduct"("tenantId");

-- 6. CREATE Quote table
CREATE TABLE IF NOT EXISTS "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "quoteNumber" TEXT,
    "insuredName" TEXT,
    "insuredEmail" TEXT,
    "insuredPhone" TEXT,
    "productId" TEXT,
    "status" TEXT DEFAULT 'draft',
    "quotedPremium" DECIMAL(14,2) DEFAULT 0,
    "quotedCoverage" DECIMAL(14,2) DEFAULT 0,
    "excessAmount" DECIMAL(14,2) DEFAULT 0,
    "deductibleAmount" DECIMAL(14,2) DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "convertedToPolicyId" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "Quote_tenantId_idx" ON "Quote"("tenantId");
CREATE INDEX IF NOT EXISTS "Quote_tenantId_status_idx" ON "Quote"("tenantId", "status");

-- 7. CREATE QuoteLine table
CREATE TABLE IF NOT EXISTS "QuoteLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "description" TEXT,
    "coverageType" TEXT,
    "premium" DECIMAL(14,2) DEFAULT 0,
    "coverage" DECIMAL(14,2) DEFAULT 0,
    "excess" DECIMAL(14,2) DEFAULT 0,
    "deductible" DECIMAL(14,2) DEFAULT 0,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "QuoteLine_tenantId_idx" ON "QuoteLine"("tenantId");
CREATE INDEX IF NOT EXISTS "QuoteLine_tenantId_quoteId_idx" ON "QuoteLine"("tenantId", "quoteId");

-- 8. CREATE ClaimDocument table
CREATE TABLE IF NOT EXISTS "ClaimDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER DEFAULT 0,
    "fileUrl" TEXT,
    "category" TEXT DEFAULT 'other',
    "description" TEXT,
    "uploadedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClaimDocument_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ClaimDocument_tenantId_idx" ON "ClaimDocument"("tenantId");
CREATE INDEX IF NOT EXISTS "ClaimDocument_tenantId_claimId_idx" ON "ClaimDocument"("tenantId", "claimId");

-- 9. CREATE ClaimNote table
CREATE TABLE IF NOT EXISTS "ClaimNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "author" TEXT,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClaimNote_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ClaimNote_tenantId_idx" ON "ClaimNote"("tenantId");
CREATE INDEX IF NOT EXISTS "ClaimNote_tenantId_claimId_idx" ON "ClaimNote"("tenantId", "claimId");

-- 10. CREATE ClaimActivity table
CREATE TABLE IF NOT EXISTS "ClaimActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "description" TEXT,
    "metadata" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaimActivity_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ClaimActivity_tenantId_idx" ON "ClaimActivity"("tenantId");
CREATE INDEX IF NOT EXISTS "ClaimActivity_tenantId_claimId_idx" ON "ClaimActivity"("tenantId", "claimId");

-- 11. CREATE Endorsement table
CREATE TABLE IF NOT EXISTS "Endorsement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "endorsementNumber" TEXT,
    "type" TEXT,
    "description" TEXT,
    "premiumImpact" DECIMAL(14,2) DEFAULT 0,
    "effectiveDate" TIMESTAMP(3),
    "status" TEXT DEFAULT 'active',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Endorsement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Endorsement_tenantId_idx" ON "Endorsement"("tenantId");
CREATE INDEX IF NOT EXISTS "Endorsement_tenantId_policyId_idx" ON "Endorsement"("tenantId", "policyId");

-- 12. CREATE PremiumSchedule table
CREATE TABLE IF NOT EXISTS "PremiumSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(14,2) DEFAULT 0,
    "status" TEXT DEFAULT 'pending',
    "paidDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(14,2) DEFAULT 0,
    "reference" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PremiumSchedule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PremiumSchedule_tenantId_idx" ON "PremiumSchedule"("tenantId");
CREATE INDEX IF NOT EXISTS "PremiumSchedule_tenantId_policyId_idx" ON "PremiumSchedule"("tenantId", "policyId");

-- 13. CREATE RenewalTask table
CREATE TABLE IF NOT EXISTS "RenewalTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT DEFAULT 'pending',
    "assignedTo" TEXT,
    "notes" TEXT,
    "completedDate" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RenewalTask_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RenewalTask_tenantId_idx" ON "RenewalTask"("tenantId");
CREATE INDEX IF NOT EXISTS "RenewalTask_tenantId_status_idx" ON "RenewalTask"("tenantId", "status");

-- 14. Add foreign keys for new columns on Policy
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_insuredId_fkey" FOREIGN KEY ("insuredId") REFERENCES "Insured"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InsuranceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "InsuranceAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 15. Add foreign key for Quote productId
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InsuranceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 16. Add indexes for Policy new columns
CREATE INDEX IF NOT EXISTS "Policy_tenantId_policyNumber_idx" ON "Policy"("tenantId", "policyNumber");
CREATE INDEX IF NOT EXISTS "Policy_tenantId_status_idx" ON "Policy"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Claim_tenantId_status_idx" ON "Claim"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Claim_tenantId_claimNumber_idx" ON "Claim"("tenantId", "claimNumber");

-- Done
