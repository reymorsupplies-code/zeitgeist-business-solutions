-- ============================================================================
-- supabase-add-columns.sql
-- Patch script: adds columns that exist in the current Prisma schema but are
-- missing from the older Supabase init migration.
--
-- Tables compared:
--   - OLD schema: supabase-init.sql (35 tables, original init)
--   - NEW schema: prisma/schema.prisma (~70 models, current)
--
-- Safe to run multiple times — every ALTER uses IF NOT EXISTS guards.
-- Wrapped in BEGIN / COMMIT for atomicity.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Columns missing from tables that exist in BOTH old & new schemas
-- ============================================================================

-- --------------------------------------------------
-- 1a. "Quotation" — missing clientPhone and discount
-- --------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Quotation' AND column_name = 'clientPhone') THEN
    ALTER TABLE "Quotation" ADD COLUMN "clientPhone" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Quotation' AND column_name = 'discount') THEN
    ALTER TABLE "Quotation" ADD COLUMN "discount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;

-- --------------------------------------------------
-- 1b. "RetailProduct" — missing taxCategory and settings
-- --------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RetailProduct' AND column_name = 'taxCategory') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "taxCategory" TEXT DEFAULT 'standard';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RetailProduct' AND column_name = 'settings') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "settings" TEXT DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: Columns missing from NEW tables (not in old init SQL,
--             confirmed existing in DB with 70 tables)
-- ============================================================================

-- --------------------------------------------------
-- 2a. "POSSale" — missing giftCardId, taxRate, splitDetails
-- --------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'POSSale' AND column_name = 'giftCardId') THEN
    ALTER TABLE "POSSale" ADD COLUMN "giftCardId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'POSSale' AND column_name = 'taxRate') THEN
    ALTER TABLE "POSSale" ADD COLUMN "taxRate" NUMERIC(5,4) DEFAULT 0.1250;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'POSSale' AND column_name = 'splitDetails') THEN
    ALTER TABLE "POSSale" ADD COLUMN "splitDetails" TEXT DEFAULT '';
  END IF;
END $$;

-- --------------------------------------------------
-- 2b. "Property" — missing tenantId (added for multi-tenant scoping)
-- --------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'tenantId') THEN
    ALTER TABLE "Property" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: Foreign-key constraints that may have failed or are missing
-- ============================================================================

-- --------------------------------------------------
-- 3a. POSSale.giftCardId → GiftCard(id)
-- --------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'POSSale_giftCardId_fkey'
  ) THEN
    ALTER TABLE "POSSale"
      ADD CONSTRAINT "POSSale_giftCardId_fkey"
      FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- --------------------------------------------------
-- 3b. Property.tenantId → Tenant(id)
-- --------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Property_tenantId_fkey'
  ) THEN
    ALTER TABLE "Property"
      ADD CONSTRAINT "Property_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- Password reset columns for PlatformUser
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP;
