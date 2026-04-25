-- ─── ZBS Migration: PortalSetting Table ───
-- Run this in Supabase SQL Editor to create the PortalSetting table

-- Create PortalSetting table
CREATE TABLE IF NOT EXISTS "PortalSetting" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "portalName" TEXT NOT NULL DEFAULT 'Tenant Portal',
  "welcomeMsg" TEXT NOT NULL DEFAULT 'Welcome to your portal',
  "logoUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#1e40af',
  "accentColor" TEXT NOT NULL DEFAULT '#6366f1',
  "bgColor" TEXT NOT NULL DEFAULT '#f8fafc',
  "fontFamily" TEXT NOT NULL DEFAULT 'inter',
  "showPayments" BOOLEAN NOT NULL DEFAULT true,
  "showMaintenance" BOOLEAN NOT NULL DEFAULT true,
  "showDocuments" BOOLEAN NOT NULL DEFAULT true,
  "allowChat" BOOLEAN NOT NULL DEFAULT true,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "customDomain" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PortalSetting_tenantId_key" UNIQUE ("tenantId")
);

-- Add foreign key constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortalSetting_tenantId_fkey') THEN
    ALTER TABLE "PortalSetting" ADD CONSTRAINT "PortalSetting_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS "PortalSetting_tenantId_idx" ON "PortalSetting"("tenantId");
