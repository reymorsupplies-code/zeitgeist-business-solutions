-- ============================================================================
-- ZBS Multi-Tenant SaaS Application — Full PostgreSQL Schema
-- ============================================================================
-- Idempotent: safe to run multiple times in Supabase SQL Editor.
-- Uses CREATE TABLE IF NOT EXISTS, DO $$ for columns/FKs, CREATE INDEX IF NOT EXISTS.
-- Generated from Prisma schema — 70 tables total.
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE 1: PlatformUser
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PlatformUser" (
  id           TEXT NOT NULL PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,
  "fullName"   TEXT,
  role         TEXT DEFAULT 'tenant_admin',
  "avatarUrl"  TEXT,
  "isActive"   BOOLEAN DEFAULT true,
  "hasUsedTrial" BOOLEAN DEFAULT false,
  "lastActiveAt" TIMESTAMP(3),
  country      TEXT,
  timezone     TEXT,
  "lastLogin"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 2: Industry
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Industry" (
  id          TEXT NOT NULL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  status      TEXT DEFAULT 'active',
  "sortOrder" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 3: Plan
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Plan" (
  id               TEXT NOT NULL PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  tier             TEXT DEFAULT 'starter',
  "priceUSD"       NUMERIC(14,2) DEFAULT 0,
  "priceTTD"       NUMERIC(14,2) DEFAULT 0,
  currency         TEXT DEFAULT 'TTD',
  "billingCycle"   TEXT DEFAULT 'monthly',
  tagline          TEXT,
  description      TEXT,
  "idealFor"       TEXT,
  "maxUsers"       INTEGER DEFAULT 3,
  "maxBranches"    INTEGER DEFAULT 1,
  features         TEXT DEFAULT '[]',
  "excludedFeatures" TEXT DEFAULT '[]',
  "isPopular"      BOOLEAN DEFAULT false,
  status           TEXT DEFAULT 'active',
  "sortOrder"      INTEGER DEFAULT 0,
  "createdAt"      TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 4: Tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Tenant" (
  id                TEXT NOT NULL PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  "logoUrl"         TEXT,
  "industryId"      TEXT,
  "planId"          TEXT,
  "planName"        TEXT,
  status            TEXT DEFAULT 'trial',
  "trialStartsAt"   TIMESTAMP(3),
  "trialEndsAt"     TIMESTAMP(3),
  "hasUsedTrial"    BOOLEAN DEFAULT false,
  "trialDurationDays" INTEGER DEFAULT 7,
  "approvedBy"      TEXT,
  "approvedAt"      TIMESTAMP(3),
  "paymentVerified" BOOLEAN DEFAULT false,
  "lastActivityAt"  TIMESTAMP(3),
  "registrationIp"  TEXT,
  "primaryColor"    TEXT DEFAULT '#1D4ED8',
  "accentColor"     TEXT DEFAULT '#2563EB',
  currency          TEXT DEFAULT 'TTD',
  timezone          TEXT DEFAULT 'America/Port_of_Spain',
  locale            TEXT DEFAULT 'en',
  "taxRate"         DOUBLE PRECISION DEFAULT 0.125,
  country           TEXT DEFAULT 'TT',
  address           TEXT,
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  settings          TEXT DEFAULT '{}',
  "createdAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 5: TenantMembership
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TenantMembership" (
  id        TEXT NOT NULL PRIMARY KEY,
  "userId"  TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  role      TEXT DEFAULT 'admin',
  status    TEXT DEFAULT 'active',
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "TenantMembership_userId_tenantId_key" UNIQUE ("userId", "tenantId")
);

-- ============================================================================
-- TABLE 6: TenantFeatureFlag
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TenantFeatureFlag" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  "featureSlug" TEXT NOT NULL,
  enabled     BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "TenantFeatureFlag_tenantId_featureSlug_key" UNIQUE ("tenantId", "featureSlug")
);

-- ============================================================================
-- TABLE 7: TenantSubscription
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TenantSubscription" (
  id                 TEXT NOT NULL PRIMARY KEY,
  "tenantId"         TEXT NOT NULL,
  "planId"           TEXT,
  "planName"         TEXT,
  status             TEXT DEFAULT 'active',
  "billingCycle"     TEXT DEFAULT 'monthly',
  "priceUSD"         NUMERIC(14,2) DEFAULT 0,
  "priceTTD"         NUMERIC(14,2) DEFAULT 0,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd"   TIMESTAMP(3),
  "paymentBehavior"  TEXT DEFAULT 'always_on_time',
  "createdAt"        TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 8: Order
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Order" (
  id              TEXT NOT NULL PRIMARY KEY,
  "tenantId"      TEXT NOT NULL,
  "orderNumber"   TEXT,
  "clientName"    TEXT,
  "clientEmail"   TEXT,
  "clientPhone"   TEXT,
  items           TEXT DEFAULT '[]',
  subtotal        NUMERIC(14,2) DEFAULT 0,
  "taxAmount"     NUMERIC(14,2) DEFAULT 0,
  "totalAmount"   NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'pending',
  "orderType"     TEXT DEFAULT 'custom',
  "deliveryDate"  TIMESTAMP(3),
  "deliveryAddress" TEXT,
  notes           TEXT,
  "isDeleted"     BOOLEAN DEFAULT false,
  "createdAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 9: CatalogItem
-- ============================================================================
CREATE TABLE IF NOT EXISTS "CatalogItem" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  price       NUMERIC(14,2) DEFAULT 0,
  cost        NUMERIC(14,2) DEFAULT 0,
  unit        TEXT,
  "imageUrl"  TEXT,
  "isAvailable" BOOLEAN DEFAULT true,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 10: Client
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Client" (
  id        TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  name      TEXT NOT NULL,
  email     TEXT,
  phone     TEXT,
  address   TEXT,
  notes     TEXT,
  tags      TEXT DEFAULT '[]',
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 11: Invoice
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Invoice" (
  id              TEXT NOT NULL PRIMARY KEY,
  "tenantId"      TEXT NOT NULL,
  "invoiceNumber" TEXT,
  "clientName"    TEXT,
  "clientEmail"   TEXT,
  items           TEXT DEFAULT '[]',
  subtotal        NUMERIC(14,2) DEFAULT 0,
  "taxRate"       DOUBLE PRECISION DEFAULT 0,
  "taxAmount"     NUMERIC(14,2) DEFAULT 0,
  "totalAmount"   NUMERIC(14,2) DEFAULT 0,
  "balanceDue"    NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'draft',
  "issueDate"     TIMESTAMP(3),
  "dueDate"       TIMESTAMP(3),
  notes           TEXT,
  "isDeleted"     BOOLEAN DEFAULT false,
  "createdAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 12: Quotation
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Quotation" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  "quoteNumber" TEXT,
  "clientName"  TEXT,
  "clientEmail" TEXT,
  "clientPhone" TEXT,
  items         TEXT DEFAULT '[]',
  subtotal      NUMERIC(14,2) DEFAULT 0,
  discount      NUMERIC(14,2) DEFAULT 0,
  "taxRate"     DOUBLE PRECISION DEFAULT 0,
  "taxAmount"   NUMERIC(14,2) DEFAULT 0,
  "totalAmount" NUMERIC(14,2) DEFAULT 0,
  status        TEXT DEFAULT 'draft',
  "validUntil"  TIMESTAMP(3),
  notes         TEXT,
  "isDeleted"   BOOLEAN DEFAULT false,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 13: Payment
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Payment" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  "invoiceId" TEXT,
  amount      NUMERIC(14,2) DEFAULT 0,
  currency    TEXT DEFAULT 'TTD',
  method      TEXT DEFAULT 'cash',
  reference   TEXT,
  status      TEXT DEFAULT 'completed',
  notes       TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 14: Expense
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Expense" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  category    TEXT,
  description TEXT,
  amount      NUMERIC(14,2) DEFAULT 0,
  currency    TEXT DEFAULT 'TTD',
  date        TIMESTAMP(3),
  "receiptUrl" TEXT,
  vendor      TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 15: Recipe
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Recipe" (
  id             TEXT NOT NULL PRIMARY KEY,
  "tenantId"     TEXT NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT,
  servings       INTEGER,
  "prepTime"     INTEGER,
  "cookTime"     INTEGER,
  ingredients    TEXT DEFAULT '[]',
  instructions   TEXT DEFAULT '[]',
  "costPerServing" NUMERIC(14,2) DEFAULT 0,
  "sellingPrice" NUMERIC(14,2) DEFAULT 0,
  "imageUrl"     TEXT,
  "isPublic"     BOOLEAN DEFAULT false,
  "isDeleted"    BOOLEAN DEFAULT false,
  "createdAt"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 16: Ingredient
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Ingredient" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT,
  unit          TEXT,
  "costPerUnit" NUMERIC(14,2) DEFAULT 0,
  quantity      DOUBLE PRECISION DEFAULT 0,
  "minStock"    DOUBLE PRECISION DEFAULT 0,
  supplier      TEXT,
  "isDeleted"   BOOLEAN DEFAULT false,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 17: DesignItem
-- ============================================================================
CREATE TABLE IF NOT EXISTS "DesignItem" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  "imageUrl"  TEXT,
  tags        TEXT DEFAULT '[]',
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 18: TenantDocument
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TenantDocument" (
  id        TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  name      TEXT NOT NULL,
  type      TEXT DEFAULT 'general',
  content   TEXT,
  "fileUrl" TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 19: Appointment
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Appointment" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  "clientName" TEXT,
  "stylistId" TEXT,
  "serviceId" TEXT,
  date        TIMESTAMP(3),
  duration    INTEGER DEFAULT 60,
  status      TEXT DEFAULT 'scheduled',
  notes       TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 20: Stylist
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Stylist" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  name        TEXT NOT NULL,
  specialty   TEXT,
  phone       TEXT,
  email       TEXT,
  "imageUrl"  TEXT,
  "isActive"  BOOLEAN DEFAULT true,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 21: SalonServiceItem
-- ============================================================================
CREATE TABLE IF NOT EXISTS "SalonServiceItem" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  duration    INTEGER DEFAULT 60,
  price       NUMERIC(14,2) DEFAULT 0,
  category    TEXT,
  "isActive"  BOOLEAN DEFAULT true,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 22: Patient
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Patient" (
  id                TEXT NOT NULL PRIMARY KEY,
  "tenantId"        TEXT NOT NULL,
  "firstName"       TEXT NOT NULL,
  "lastName"        TEXT NOT NULL,
  "dateOfBirth"     TIMESTAMP(3),
  gender            TEXT,
  email             TEXT,
  phone             TEXT,
  address           TEXT,
  "bloodType"       TEXT,
  allergies         TEXT DEFAULT '[]',
  "medicalNotes"    TEXT,
  "insuranceProvider" TEXT,
  "insuranceNumber" TEXT,
  "emergencyContact" TEXT,
  "emergencyPhone"  TEXT,
  "isDeleted"       BOOLEAN DEFAULT false,
  "createdAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 23: MedicalAppointment
-- ============================================================================
CREATE TABLE IF NOT EXISTS "MedicalAppointment" (
  id           TEXT NOT NULL PRIMARY KEY,
  "tenantId"   TEXT NOT NULL,
  "patientId"  TEXT,
  "doctorName" TEXT,
  specialty    TEXT,
  date         TIMESTAMP(3),
  duration     INTEGER DEFAULT 30,
  status       TEXT DEFAULT 'scheduled',
  notes        TEXT,
  diagnosis    TEXT,
  prescription TEXT,
  "isDeleted"  BOOLEAN DEFAULT false,
  "createdAt"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 24: LegalCase
-- ============================================================================
CREATE TABLE IF NOT EXISTS "LegalCase" (
  id           TEXT NOT NULL PRIMARY KEY,
  "tenantId"   TEXT NOT NULL,
  "caseNumber" TEXT,
  title        TEXT NOT NULL,
  "clientName" TEXT,
  "caseType"   TEXT,
  status       TEXT DEFAULT 'open',
  court        TEXT,
  judge        TEXT,
  "openDate"   TIMESTAMP(3),
  "closeDate"  TIMESTAMP(3),
  description  TEXT,
  "billingRate" NUMERIC(14,2) DEFAULT 0,
  "hoursBilled" DOUBLE PRECISION DEFAULT 0,
  "isDeleted"  BOOLEAN DEFAULT false,
  "createdAt"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 25: TimeEntry
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TimeEntry" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  "caseId"      TEXT,
  description   TEXT NOT NULL,
  duration      INTEGER DEFAULT 0,
  "billingRate" NUMERIC(14,2) DEFAULT 0,
  billable      BOOLEAN DEFAULT true,
  date          TIMESTAMP(3),
  "isDeleted"   BOOLEAN DEFAULT false,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 26: Policy
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Policy" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  "policyNumber" TEXT,
  "clientName"  TEXT,
  type          TEXT,
  premium       NUMERIC(14,2) DEFAULT 0,
  coverage      NUMERIC(14,2) DEFAULT 0,
  "startDate"   TIMESTAMP(3),
  "endDate"     TIMESTAMP(3),
  status        TEXT DEFAULT 'active',
  beneficiaries TEXT DEFAULT '[]',
  "isDeleted"   BOOLEAN DEFAULT false,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 27: Claim
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Claim" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  "policyId"    TEXT,
  "claimNumber" TEXT,
  "claimantName" TEXT,
  type          TEXT,
  amount        NUMERIC(14,2) DEFAULT 0,
  status        TEXT DEFAULT 'submitted',
  "incidentDate" TIMESTAMP(3),
  description   TEXT,
  "isDeleted"   BOOLEAN DEFAULT false,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 28: RetailProduct
-- ============================================================================
CREATE TABLE IF NOT EXISTS "RetailProduct" (
  id           TEXT NOT NULL PRIMARY KEY,
  "tenantId"   TEXT NOT NULL,
  name         TEXT NOT NULL,
  sku          TEXT,
  category     TEXT,
  price        NUMERIC(12,2) DEFAULT 0,
  cost         NUMERIC(12,2) DEFAULT 0,
  quantity     INTEGER DEFAULT 0,
  "minStock"   INTEGER DEFAULT 0,
  supplier     TEXT,
  barcode      TEXT,
  "imageUrl"   TEXT,
  "taxCategory" TEXT DEFAULT 'standard',
  settings     TEXT DEFAULT '{}',
  "isActive"   BOOLEAN DEFAULT true,
  "isDeleted"  BOOLEAN DEFAULT false,
  "createdAt"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 29: Layaway
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Layaway" (
  id                TEXT NOT NULL PRIMARY KEY,
  "tenantId"        TEXT NOT NULL,
  "layawayNumber"   TEXT NOT NULL,
  "customerName"    TEXT NOT NULL,
  "customerPhone"   TEXT NOT NULL,
  "customerEmail"   TEXT,
  items             TEXT DEFAULT '[]',
  "totalAmount"     NUMERIC(12,2) DEFAULT 0,
  "depositAmount"   NUMERIC(12,2) DEFAULT 0,
  "balanceRemaining" NUMERIC(12,2) DEFAULT 0,
  payments          TEXT DEFAULT '[]',
  status            TEXT DEFAULT 'active',
  "dueDate"         TIMESTAMP(3),
  "expiryDate"      TIMESTAMP(3),
  "depositPercentage" NUMERIC(12,2) DEFAULT 20,
  notes             TEXT,
  "isDeleted"       BOOLEAN DEFAULT false,
  "createdAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3),
  CONSTRAINT "Layaway_tenantId_layawayNumber_key" UNIQUE ("tenantId", "layawayNumber")
);

-- ============================================================================
-- TABLE 30: StockMovement
-- ============================================================================
CREATE TABLE IF NOT EXISTS "StockMovement" (
  id             TEXT NOT NULL PRIMARY KEY,
  "tenantId"     TEXT NOT NULL,
  "ingredientId" TEXT,
  type           TEXT NOT NULL,
  quantity       NUMERIC(12,2) DEFAULT 0,
  "previousStock" NUMERIC(12,2) DEFAULT 0,
  "newStock"     NUMERIC(12,2) DEFAULT 0,
  "unitCost"     NUMERIC(12,2) DEFAULT 0,
  reason         TEXT,
  reference      TEXT,
  "batchNumber"  TEXT,
  "expiryDate"   TIMESTAMP(3),
  method         TEXT,
  "createdAt"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 31: PurchaseOrder
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  id             TEXT NOT NULL PRIMARY KEY,
  "tenantId"     TEXT NOT NULL,
  "poNumber"     TEXT NOT NULL,
  "supplierId"   TEXT,
  "supplierName" TEXT NOT NULL,
  status         TEXT DEFAULT 'draft',
  items          TEXT DEFAULT '[]',
  "totalAmount"  NUMERIC(12,2) DEFAULT 0,
  "receivedAmount" NUMERIC(12,2) DEFAULT 0,
  notes          TEXT,
  "expectedDate" TIMESTAMP(3),
  "receivedAt"   TIMESTAMP(3),
  "isDeleted"    BOOLEAN DEFAULT false,
  "createdAt"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3),
  CONSTRAINT "PurchaseOrder_tenantId_poNumber_key" UNIQUE ("tenantId", "poNumber")
);

-- ============================================================================
-- TABLE 32: POSSale
-- ============================================================================
CREATE TABLE IF NOT EXISTS "POSSale" (
  id             TEXT NOT NULL PRIMARY KEY,
  "tenantId"     TEXT NOT NULL,
  "saleNumber"   TEXT NOT NULL,
  items          TEXT DEFAULT '[]',
  subtotal       NUMERIC(12,2) DEFAULT 0,
  "discountPct"  NUMERIC(12,2) DEFAULT 0,
  "discountAmount" NUMERIC(12,2) DEFAULT 0,
  "taxAmount"    NUMERIC(12,2) DEFAULT 0,
  "taxRate"      NUMERIC(5,4) DEFAULT 0.1250,
  "totalAmount"  NUMERIC(12,2) DEFAULT 0,
  "paymentMethod" TEXT DEFAULT 'cash',
  "giftCardId"   TEXT,
  "splitDetails" TEXT DEFAULT '',
  "cashReceived" NUMERIC(12,2) DEFAULT 0,
  "changeAmount" NUMERIC(12,2) DEFAULT 0,
  currency       TEXT DEFAULT 'TTD',
  "customerName" TEXT DEFAULT '',
  "staffName"    TEXT,
  status         TEXT DEFAULT 'completed',
  "isDeleted"    BOOLEAN DEFAULT false,
  "createdAt"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3),
  CONSTRAINT "POSSale_tenantId_saleNumber_key" UNIQUE ("tenantId", "saleNumber")
);

-- ============================================================================
-- TABLE 33: GiftCard
-- ============================================================================
CREATE TABLE IF NOT EXISTS "GiftCard" (
  id              TEXT NOT NULL PRIMARY KEY,
  "tenantId"      TEXT NOT NULL,
  "cardNumber"    TEXT NOT NULL,
  "cardCode"      TEXT NOT NULL,
  "initialBalance" NUMERIC(12,2) DEFAULT 0,
  "currentBalance" NUMERIC(12,2) DEFAULT 0,
  "customerName"  TEXT,
  "purchaserName" TEXT NOT NULL,
  status          TEXT DEFAULT 'active',
  "issuedAt"      TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3),
  "lastUsedAt"    TIMESTAMP(3),
  transactions    TEXT DEFAULT '[]',
  notes           TEXT,
  "isDeleted"     BOOLEAN DEFAULT false,
  "createdAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3),
  CONSTRAINT "GiftCard_tenantId_cardNumber_key" UNIQUE ("tenantId", "cardNumber"),
  CONSTRAINT "GiftCard_tenantId_cardCode_key" UNIQUE ("tenantId", "cardCode")
);

-- ============================================================================
-- TABLE 34: ProductReturn
-- ============================================================================
CREATE TABLE IF NOT EXISTS "ProductReturn" (
  id             TEXT NOT NULL PRIMARY KEY,
  "tenantId"     TEXT NOT NULL,
  "saleId"       TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  items          TEXT DEFAULT '[]',
  "totalRefund"  NUMERIC(12,2) DEFAULT 0,
  "refundMethod" TEXT DEFAULT 'cash',
  reason         TEXT DEFAULT 'other',
  status         TEXT DEFAULT 'pending',
  "processedBy"  TEXT,
  notes          TEXT,
  "isDeleted"    BOOLEAN DEFAULT false,
  "createdAt"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3),
  CONSTRAINT "ProductReturn_tenantId_returnNumber_key" UNIQUE ("tenantId", "returnNumber")
);

-- ============================================================================
-- TABLE 35: RegisterShift
-- ============================================================================
CREATE TABLE IF NOT EXISTS "RegisterShift" (
  id                TEXT NOT NULL PRIMARY KEY,
  "tenantId"        TEXT NOT NULL,
  "shiftNumber"     TEXT NOT NULL,
  "staffName"       TEXT NOT NULL,
  "staffId"         TEXT,
  "openedAt"        TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "closedAt"        TIMESTAMP(3),
  status            TEXT DEFAULT 'open',
  "startingCash"    NUMERIC(12,2) DEFAULT 0,
  "closingCash"     NUMERIC(12,2),
  "expectedCash"    NUMERIC(12,2),
  "cashSales"       NUMERIC(12,2) DEFAULT 0,
  "cardSales"       NUMERIC(12,2) DEFAULT 0,
  "transferSales"   NUMERIC(12,2) DEFAULT 0,
  "totalSales"      NUMERIC(12,2) DEFAULT 0,
  "totalRefunds"    NUMERIC(12,2) DEFAULT 0,
  "giftCardSales"   NUMERIC(12,2) DEFAULT 0,
  "layawayDeposits" NUMERIC(12,2) DEFAULT 0,
  "transactionCount" INTEGER DEFAULT 0,
  "refundCount"     INTEGER DEFAULT 0,
  discrepancy       NUMERIC(12,2),
  notes             TEXT,
  "isDeleted"       BOOLEAN DEFAULT false,
  "createdAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3),
  CONSTRAINT "RegisterShift_tenantId_shiftNumber_key" UNIQUE ("tenantId", "shiftNumber")
);

-- ============================================================================
-- TABLE 36: Event
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Event" (
  id           TEXT NOT NULL PRIMARY KEY,
  "tenantId"   TEXT NOT NULL,
  name         TEXT NOT NULL,
  type         TEXT,
  "clientName" TEXT,
  venue        TEXT,
  "eventDate"  TIMESTAMP(3),
  "setupDate"  TIMESTAMP(3),
  "guestCount" INTEGER DEFAULT 0,
  budget       NUMERIC(14,2) DEFAULT 0,
  status       TEXT DEFAULT 'planning',
  notes        TEXT,
  "isDeleted"  BOOLEAN DEFAULT false,
  "createdAt"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 37: Supplier
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Supplier" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  name        TEXT NOT NULL,
  contact     TEXT,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  category    TEXT,
  rating      INTEGER DEFAULT 0,
  notes       TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 38: Venue
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Venue" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  name          TEXT NOT NULL,
  location      TEXT,
  capacity      INTEGER DEFAULT 0,
  contact       TEXT,
  email         TEXT,
  phone         TEXT,
  amenities     TEXT DEFAULT '[]',
  "pricePerHour" NUMERIC(14,2) DEFAULT 0,
  "isActive"    BOOLEAN DEFAULT true,
  "isDeleted"   BOOLEAN DEFAULT false,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 39: Vendor
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Vendor" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT,
  contact     TEXT,
  email       TEXT,
  phone       TEXT,
  rating      INTEGER DEFAULT 0,
  notes       TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 40: Contract
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Contract" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  "clientName" TEXT,
  type        TEXT,
  value       NUMERIC(14,2) DEFAULT 0,
  "startDate" TIMESTAMP(3),
  "endDate"   TIMESTAMP(3),
  status      TEXT DEFAULT 'active',
  description TEXT,
  notes       TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 41: Project
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Project" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  name        TEXT NOT NULL,
  "clientName" TEXT,
  status      TEXT DEFAULT 'active',
  "startDate" TIMESTAMP(3),
  deadline    TIMESTAMP(3),
  budget      NUMERIC(14,2) DEFAULT 0,
  spent       NUMERIC(14,2) DEFAULT 0,
  progress    INTEGER DEFAULT 0,
  description TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 42: LoyaltyMember
-- ============================================================================
CREATE TABLE IF NOT EXISTS "LoyaltyMember" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  "clientId"    TEXT,
  "clientName"  TEXT NOT NULL,
  "clientPhone" TEXT NOT NULL,
  "clientEmail" TEXT DEFAULT '',
  points        INTEGER DEFAULT 0,
  "totalSpent"  NUMERIC(14,2) DEFAULT 0,
  "totalOrders" INTEGER DEFAULT 0,
  tier          TEXT DEFAULT 'bronze',
  "joinDate"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "lastVisit"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyMember_tenantId_clientPhone_key" UNIQUE ("tenantId", "clientPhone")
);

-- ============================================================================
-- TABLE 43: LoyaltyTransaction
-- ============================================================================
CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
  id          TEXT NOT NULL PRIMARY KEY,
  "memberId"  TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  type        TEXT NOT NULL,
  points      INTEGER NOT NULL,
  description TEXT DEFAULT '',
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 44: BookkeepingEntry
-- ============================================================================
CREATE TABLE IF NOT EXISTS "BookkeepingEntry" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  date        TIMESTAMP(3),
  description TEXT NOT NULL,
  category    TEXT,
  type        TEXT DEFAULT 'debit',
  amount      NUMERIC(14,2) DEFAULT 0,
  currency    TEXT DEFAULT 'TTD',
  reference   TEXT,
  "accountId" TEXT,
  "isDeleted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 45: AuditLog
-- ============================================================================
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id        TEXT NOT NULL PRIMARY KEY,
  "userId"  TEXT,
  "tenantId" TEXT,
  action    TEXT NOT NULL,
  details   TEXT,
  severity  TEXT DEFAULT 'info',
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 46: SystemEvent
-- ============================================================================
CREATE TABLE IF NOT EXISTS "SystemEvent" (
  id          TEXT NOT NULL PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  severity    TEXT DEFAULT 'info',
  "tenantId"  TEXT,
  metadata    TEXT DEFAULT '{}',
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 47: PlatformInvoice
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PlatformInvoice" (
  id              TEXT NOT NULL PRIMARY KEY,
  "tenantId"      TEXT,
  "invoiceNumber" TEXT,
  "amountUSD"     NUMERIC(14,2) DEFAULT 0,
  "amountTTD"     NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'draft',
  "issueDate"     TIMESTAMP(3),
  "dueDate"       TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 48: PriceSetting
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PriceSetting" (
  id         TEXT NOT NULL PRIMARY KEY,
  "planId"   TEXT,
  key        TEXT NOT NULL UNIQUE,
  "valueUSD" NUMERIC(14,2) DEFAULT 0,
  "valueTTD" NUMERIC(14,2) DEFAULT 0,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 49: Property
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Property" (
  id          TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  country     TEXT DEFAULT 'TT',
  type        TEXT DEFAULT 'commercial',
  "totalArea" DOUBLE PRECISION,
  units       INTEGER DEFAULT 1,
  description TEXT,
  "imageUrl"  TEXT,
  status      TEXT DEFAULT 'active',
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 50: PropertyUnit
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PropertyUnit" (
  id           TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "unitNumber" TEXT NOT NULL,
  floor        INTEGER DEFAULT 1,
  area         DOUBLE PRECISION,
  "baseRentTTD" NUMERIC(14,2) DEFAULT 0,
  "baseRentUSD" NUMERIC(14,2) DEFAULT 0,
  "tenantId"   TEXT,
  status       TEXT DEFAULT 'vacant',
  amenities    TEXT DEFAULT '[]',
  notes        TEXT,
  "createdAt"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3),
  CONSTRAINT "PropertyUnit_propertyId_unitNumber_key" UNIQUE ("propertyId", "unitNumber")
);

-- ============================================================================
-- TABLE 51: Lease
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Lease" (
  id                  TEXT NOT NULL PRIMARY KEY,
  "unitId"            TEXT NOT NULL,
  "tenantId"          TEXT,
  "startDate"         TIMESTAMP(3),
  "endDate"           TIMESTAMP(3),
  "rentAmount"        NUMERIC(14,2) DEFAULT 0,
  "rentCurrency"      TEXT DEFAULT 'TTD',
  "depositAmount"     NUMERIC(14,2) DEFAULT 0,
  status              TEXT DEFAULT 'active',
  terms               TEXT,
  notes               TEXT,
  "autoRenew"         BOOLEAN DEFAULT false,
  "renewalNoticeDays" INTEGER DEFAULT 30,
  "rentIncreasePercent" DOUBLE PRECISION DEFAULT 0,
  "lastRenewedAt"     TIMESTAMP(3),
  "renewalCount"      INTEGER DEFAULT 0,
  "originalStartDate" TIMESTAMP(3),
  "originalEndDate"   TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 52: MaintenanceRequest
-- ============================================================================
CREATE TABLE IF NOT EXISTS "MaintenanceRequest" (
  id          TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "unitId"     TEXT,
  "tenantId"   TEXT,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  priority    TEXT DEFAULT 'medium',
  status      TEXT DEFAULT 'open',
  "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  cost        NUMERIC(14,2) DEFAULT 0,
  vendor      TEXT,
  notes       TEXT,
  "vendorId"  TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 53: RentPayment
-- ============================================================================
CREATE TABLE IF NOT EXISTS "RentPayment" (
  id            TEXT NOT NULL PRIMARY KEY,
  "leaseId"     TEXT NOT NULL,
  "propertyId"  TEXT NOT NULL,
  "unitId"      TEXT NOT NULL,
  "tenantId"    TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd"   TIMESTAMP(3),
  "amountDue"   NUMERIC(14,2) DEFAULT 0,
  "amountPaid"  NUMERIC(14,2) DEFAULT 0,
  "lateFee"     NUMERIC(14,2) DEFAULT 0,
  currency      TEXT DEFAULT 'TTD',
  "paymentMethod" TEXT,
  "paymentRef"  TEXT,
  status        TEXT DEFAULT 'pending',
  "paidAt"      TIMESTAMP(3),
  "dueDate"     TIMESTAMP(3),
  notes         TEXT,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 54: PropertyVendor
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PropertyVendor" (
  id           TEXT NOT NULL PRIMARY KEY,
  "tenantId"   TEXT,
  "propertyId" TEXT,
  name         TEXT NOT NULL,
  category     TEXT,
  contact      TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  rating       INTEGER DEFAULT 0,
  "isActive"   BOOLEAN DEFAULT true,
  notes        TEXT,
  "createdAt"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 55: PropertyDocument
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PropertyDocument" (
  id           TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT,
  "unitId"     TEXT,
  "leaseId"    TEXT,
  "tenantId"   TEXT,
  name         TEXT NOT NULL,
  type         TEXT DEFAULT 'other',
  category     TEXT,
  "fileUrl"    TEXT,
  description  TEXT,
  "expiresAt"  TIMESTAMP(3),
  status       TEXT DEFAULT 'active',
  "createdAt"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 56: JournalEntry
-- ============================================================================
CREATE TABLE IF NOT EXISTS "JournalEntry" (
  id          TEXT NOT NULL PRIMARY KEY,
  date        TIMESTAMP(3),
  description TEXT NOT NULL,
  reference   TEXT,
  status      TEXT DEFAULT 'posted',
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 57: JournalEntryLine
-- ============================================================================
CREATE TABLE IF NOT EXISTS "JournalEntryLine" (
  id              TEXT NOT NULL PRIMARY KEY,
  "journalEntryId" TEXT NOT NULL,
  "accountCode"   TEXT NOT NULL,
  "accountName"   TEXT NOT NULL,
  "accountType"   TEXT NOT NULL,
  debit           NUMERIC(14,2) DEFAULT 0,
  credit          NUMERIC(14,2) DEFAULT 0,
  "createdAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 58: OwnerDisbursement
-- ============================================================================
CREATE TABLE IF NOT EXISTS "OwnerDisbursement" (
  id                 TEXT NOT NULL PRIMARY KEY,
  "tenantId"         TEXT,
  "propertyId"       TEXT,
  "periodStart"      TIMESTAMP(3),
  "periodEnd"        TIMESTAMP(3),
  "grossIncome"      NUMERIC(14,2) DEFAULT 0,
  "totalExpenses"    NUMERIC(14,2) DEFAULT 0,
  "netIncome"        NUMERIC(14,2) DEFAULT 0,
  "ownerShare"       DOUBLE PRECISION DEFAULT 100,
  "disbursementAmount" NUMERIC(14,2) DEFAULT 0,
  currency           TEXT DEFAULT 'TTD',
  status             TEXT DEFAULT 'pending',
  "paidAt"           TIMESTAMP(3),
  notes              TEXT,
  "createdAt"        TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 59: LeaseRenewalLog
-- ============================================================================
CREATE TABLE IF NOT EXISTS "LeaseRenewalLog" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT,
  "leaseId"     TEXT NOT NULL,
  "previousEnd" TIMESTAMP(3),
  "newStart"    TIMESTAMP(3),
  "newEnd"      TIMESTAMP(3),
  "oldRent"     NUMERIC(14,2) DEFAULT 0,
  "newRent"     NUMERIC(14,2) DEFAULT 0,
  "increasePct" DOUBLE PRECISION DEFAULT 0,
  "renewedBy"   TEXT,
  notes         TEXT,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 60: SecurityDeposit
-- ============================================================================
CREATE TABLE IF NOT EXISTS "SecurityDeposit" (
  id               TEXT NOT NULL PRIMARY KEY,
  "leaseId"        TEXT NOT NULL,
  "propertyId"     TEXT NOT NULL,
  "unitId"         TEXT NOT NULL,
  "tenantId"       TEXT,
  amount           NUMERIC(14,2) DEFAULT 0,
  currency         TEXT DEFAULT 'TTD',
  status           TEXT DEFAULT 'held',
  "receivedDate"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "returnDeadline" TIMESTAMP(3),
  "returnedAmount" NUMERIC(14,2) DEFAULT 0,
  "returnedDate"   TIMESTAMP(3),
  deductions       TEXT DEFAULT '[]',
  "deductionTotal" NUMERIC(14,2) DEFAULT 0,
  "refundMethod"   TEXT,
  "refundReference" TEXT,
  notes            TEXT,
  "createdAt"      TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 61: PropertyInspection
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PropertyInspection" (
  id                TEXT NOT NULL PRIMARY KEY,
  "propertyId"      TEXT NOT NULL,
  "unitId"          TEXT,
  "leaseId"         TEXT,
  "tenantId"        TEXT,
  type              TEXT DEFAULT 'move_in',
  "inspectorName"   TEXT,
  "inspectorRole"   TEXT,
  "inspectedAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "overallCondition" TEXT DEFAULT 'good',
  checklist         TEXT DEFAULT '[]',
  notes             TEXT,
  "scoreTotal"      INTEGER DEFAULT 0,
  "scoreMax"        INTEGER DEFAULT 100,
  "signedByTenant"  BOOLEAN DEFAULT false,
  "signedByLandlord" BOOLEAN DEFAULT false,
  "createdAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 62: LegalNotice
-- ============================================================================
CREATE TABLE IF NOT EXISTS "LegalNotice" (
  id             TEXT NOT NULL PRIMARY KEY,
  "leaseId"      TEXT NOT NULL,
  "propertyId"   TEXT NOT NULL,
  "unitId"       TEXT NOT NULL,
  "tenantId"     TEXT,
  type           TEXT NOT NULL,
  jurisdiction   TEXT DEFAULT 'TT',
  "templateSlug" TEXT NOT NULL,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  "sentDate"     TIMESTAMP(3),
  "sentMethod"   TEXT,
  "responseDate" TIMESTAMP(3),
  "responseNotes" TEXT,
  status         TEXT DEFAULT 'draft',
  "effectiveDate" TIMESTAMP(3),
  "expiresAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 63: VATReturn
-- ============================================================================
CREATE TABLE IF NOT EXISTS "VATReturn" (
  id                TEXT NOT NULL PRIMARY KEY,
  "tenantId"        TEXT NOT NULL,
  "periodStart"     TIMESTAMP(3),
  "periodEnd"       TIMESTAMP(3),
  quarter           TEXT NOT NULL,
  year              INTEGER,
  "totalSalesExVAT" NUMERIC(14,2) DEFAULT 0,
  "totalVATCollected" NUMERIC(14,2) DEFAULT 0,
  "totalVATPaid"    NUMERIC(14,2) DEFAULT 0,
  "vatDue"          NUMERIC(14,2) DEFAULT 0,
  "vatRefund"       NUMERIC(14,2) DEFAULT 0,
  "birNumber"       TEXT,
  "tin"             TEXT,
  "vatRegNumber"    TEXT,
  status            TEXT DEFAULT 'draft',
  "filedDate"       TIMESTAMP(3),
  "filedBy"         TEXT,
  "receiptNumber"   TEXT,
  notes             TEXT,
  "createdAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 64: HACCPPlan
-- ============================================================================
CREATE TABLE IF NOT EXISTS "HACCPPlan" (
  id              TEXT NOT NULL PRIMARY KEY,
  "tenantId"      TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  "productCategory" TEXT,
  status          TEXT DEFAULT 'draft',
  "approvedBy"    TEXT,
  "approvedAt"    TIMESTAMP(3),
  "criticalLimits" TEXT DEFAULT '[]',
  "lastReviewDate" TIMESTAMP(3),
  "nextReviewDate" TIMESTAMP(3),
  notes           TEXT,
  "createdAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 65: HACCPRiskLog
-- ============================================================================
CREATE TABLE IF NOT EXISTS "HACCPRiskLog" (
  id               TEXT NOT NULL PRIMARY KEY,
  "planId"         TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "ccpName"        TEXT NOT NULL,
  "hazardType"     TEXT,
  "monitoringValue" TEXT,
  "criticalLimit"  TEXT,
  "isWithinLimit"  BOOLEAN DEFAULT true,
  "correctiveAction" TEXT,
  "loggedBy"       TEXT,
  "loggedAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy"     TEXT,
  "verifiedAt"     TIMESTAMP(3),
  notes            TEXT,
  "createdAt"      TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 66: AllergenDeclaration
-- ============================================================================
CREATE TABLE IF NOT EXISTS "AllergenDeclaration" (
  id            TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  "recipeId"    TEXT,
  "ingredientId" TEXT,
  "productName" TEXT NOT NULL,
  allergens     TEXT DEFAULT '[]',
  "lastReviewAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy"  TEXT,
  notes         TEXT,
  "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 67: FoodHandlerRegistration
-- ============================================================================
CREATE TABLE IF NOT EXISTS "FoodHandlerRegistration" (
  id                  TEXT NOT NULL PRIMARY KEY,
  "tenantId"          TEXT NOT NULL,
  "employeeName"      TEXT NOT NULL,
  "employeeRole"      TEXT,
  "registrationNumber" TEXT,
  "registeredDate"    TIMESTAMP(3),
  "expiryDate"        TIMESTAMP(3),
  "healthStatus"      TEXT DEFAULT 'active',
  "trainingDate"      TIMESTAMP(3),
  "certificateUrl"    TEXT,
  "publicHealthDept"  TEXT DEFAULT 'County Medical Officer of Health',
  notes               TEXT,
  "createdAt"         TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 68: HealthInspection
-- ============================================================================
CREATE TABLE IF NOT EXISTS "HealthInspection" (
  id                 TEXT NOT NULL PRIMARY KEY,
  "tenantId"         TEXT NOT NULL,
  "inspectionDate"   TIMESTAMP(3),
  "inspectorName"    TEXT,
  "inspectorAgency"  TEXT DEFAULT 'Public Health Department',
  type               TEXT DEFAULT 'routine',
  "overallScore"     INTEGER,
  "scoreMax"         INTEGER DEFAULT 100,
  result             TEXT DEFAULT 'pass',
  violations         TEXT DEFAULT '[]',
  "correctiveActions" TEXT DEFAULT '[]',
  "nextInspectionDate" TIMESTAMP(3),
  "certificateUrl"   TEXT,
  notes              TEXT,
  "createdAt"        TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 69: TemperatureLog
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TemperatureLog" (
  id              TEXT NOT NULL PRIMARY KEY,
  "tenantId"      TEXT NOT NULL,
  "equipmentName" TEXT NOT NULL,
  "equipmentType" TEXT NOT NULL,
  location        TEXT,
  temperature     DOUBLE PRECISION,
  unit            TEXT DEFAULT 'C',
  "isWithinRange" BOOLEAN DEFAULT true,
  "minSafe"       DOUBLE PRECISION,
  "maxSafe"       DOUBLE PRECISION,
  "loggedBy"      TEXT,
  "loggedAt"      TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "correctiveNote" TEXT,
  "createdAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)
);

-- ============================================================================
-- TABLE 70: CleaningSanitationLog
-- ============================================================================
CREATE TABLE IF NOT EXISTS "CleaningSanitationLog" (
  id              TEXT NOT NULL PRIMARY KEY,
  "tenantId"      TEXT NOT NULL,
  area            TEXT NOT NULL,
  task            TEXT NOT NULL,
  "cleaningProduct" TEXT,
  frequency       TEXT DEFAULT 'daily',
  "completedBy"   TEXT,
  "completedAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy"    TEXT,
  "verifiedAt"    TIMESTAMP(3),
  status          TEXT DEFAULT 'completed',
  notes           TEXT,
  "createdAt"     TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)
);


-- ============================================================================
-- FOREIGN KEY CONSTRAINTS (idempotent via DO $$ blocks)
-- ============================================================================

-- TenantMembership FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantMembership_userId_fkey') THEN
    ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantMembership_tenantId_fkey') THEN
    ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- TenantFeatureFlag FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantFeatureFlag_tenantId_fkey') THEN
    ALTER TABLE "TenantFeatureFlag" ADD CONSTRAINT "TenantFeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- TenantSubscription FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantSubscription_tenantId_fkey') THEN
    ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantSubscription_planId_fkey') THEN
    ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Tenant FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_industryId_fkey') THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_planId_fkey') THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Order FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_tenantId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CatalogItem FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogItem_tenantId_fkey') THEN
    ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Client FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Client_tenantId_fkey') THEN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Invoice FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_tenantId_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Payment FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_tenantId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_invoiceId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Expense FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_tenantId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Recipe FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Recipe_tenantId_fkey') THEN
    ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Ingredient FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ingredient_tenantId_fkey') THEN
    ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- DesignItem FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DesignItem_tenantId_fkey') THEN
    ALTER TABLE "DesignItem" ADD CONSTRAINT "DesignItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- TenantDocument FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantDocument_tenantId_fkey') THEN
    ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Appointment FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_tenantId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_stylistId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_stylistId_fkey" FOREIGN KEY ("stylistId") REFERENCES "Stylist"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_serviceId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SalonServiceItem"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Stylist FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Stylist_tenantId_fkey') THEN
    ALTER TABLE "Stylist" ADD CONSTRAINT "Stylist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- SalonServiceItem FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalonServiceItem_tenantId_fkey') THEN
    ALTER TABLE "SalonServiceItem" ADD CONSTRAINT "SalonServiceItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Patient FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Patient_tenantId_fkey') THEN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- MedicalAppointment FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalAppointment_tenantId_fkey') THEN
    ALTER TABLE "MedicalAppointment" ADD CONSTRAINT "MedicalAppointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalAppointment_patientId_fkey') THEN
    ALTER TABLE "MedicalAppointment" ADD CONSTRAINT "MedicalAppointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- LegalCase FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalCase_tenantId_fkey') THEN
    ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- TimeEntry FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_tenantId_fkey') THEN
    ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_caseId_fkey') THEN
    ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Policy FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Policy_tenantId_fkey') THEN
    ALTER TABLE "Policy" ADD CONSTRAINT "Policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Claim FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Claim_tenantId_fkey') THEN
    ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Claim_policyId_fkey') THEN
    ALTER TABLE "Claim" ADD CONSTRAINT "Claim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- RetailProduct FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RetailProduct_tenantId_fkey') THEN
    ALTER TABLE "RetailProduct" ADD CONSTRAINT "RetailProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Layaway FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Layaway_tenantId_fkey') THEN
    ALTER TABLE "Layaway" ADD CONSTRAINT "Layaway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- StockMovement FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_tenantId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_ingredientId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PurchaseOrder FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_tenantId_fkey') THEN
    ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_supplierId_fkey') THEN
    ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- POSSale FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'POSSale_tenantId_fkey') THEN
    ALTER TABLE "POSSale" ADD CONSTRAINT "POSSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'POSSale_giftCardId_fkey') THEN
    ALTER TABLE "POSSale" ADD CONSTRAINT "POSSale_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- GiftCard FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiftCard_tenantId_fkey') THEN
    ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ProductReturn FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductReturn_tenantId_fkey') THEN
    ALTER TABLE "ProductReturn" ADD CONSTRAINT "ProductReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductReturn_saleId_fkey') THEN
    ALTER TABLE "ProductReturn" ADD CONSTRAINT "ProductReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "POSSale"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RegisterShift FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RegisterShift_tenantId_fkey') THEN
    ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Event FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_tenantId_fkey') THEN
    ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Supplier FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Supplier_tenantId_fkey') THEN
    ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Venue FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Venue_tenantId_fkey') THEN
    ALTER TABLE "Venue" ADD CONSTRAINT "Venue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Vendor FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vendor_tenantId_fkey') THEN
    ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Contract FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Contract_tenantId_fkey') THEN
    ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Project FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_tenantId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- LoyaltyMember FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyMember_tenantId_fkey') THEN
    ALTER TABLE "LoyaltyMember" ADD CONSTRAINT "LoyaltyMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyMember_clientId_fkey') THEN
    ALTER TABLE "LoyaltyMember" ADD CONSTRAINT "LoyaltyMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- LoyaltyTransaction FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyTransaction_memberId_fkey') THEN
    ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LoyaltyMember"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyTransaction_tenantId_fkey') THEN
    ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- BookkeepingEntry FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookkeepingEntry_tenantId_fkey') THEN
    ALTER TABLE "BookkeepingEntry" ADD CONSTRAINT "BookkeepingEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AuditLog FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_tenantId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- SystemEvent FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemEvent_tenantId_fkey') THEN
    ALTER TABLE "SystemEvent" ADD CONSTRAINT "SystemEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PlatformInvoice FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformInvoice_tenantId_fkey') THEN
    ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PriceSetting FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PriceSetting_planId_fkey') THEN
    ALTER TABLE "PriceSetting" ADD CONSTRAINT "PriceSetting_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Property FK (ON DELETE SET NULL)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Property_tenantId_fkey') THEN
    ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PropertyUnit FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyUnit_propertyId_fkey') THEN
    ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyUnit_tenantId_fkey') THEN
    ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Lease FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lease_unitId_fkey') THEN
    ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lease_tenantId_fkey') THEN
    ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- MaintenanceRequest FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_propertyId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_unitId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_tenantId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_vendorId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "PropertyVendor"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- RentPayment FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentPayment_leaseId_fkey') THEN
    ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentPayment_propertyId_fkey') THEN
    ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentPayment_unitId_fkey') THEN
    ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentPayment_tenantId_fkey') THEN
    ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PropertyVendor FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyVendor_propertyId_fkey') THEN
    ALTER TABLE "PropertyVendor" ADD CONSTRAINT "PropertyVendor_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyVendor_tenantId_fkey') THEN
    ALTER TABLE "PropertyVendor" ADD CONSTRAINT "PropertyVendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PropertyDocument FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyDocument_propertyId_fkey') THEN
    ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyDocument_unitId_fkey') THEN
    ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyDocument_leaseId_fkey') THEN
    ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyDocument_tenantId_fkey') THEN
    ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- JournalEntryLine FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JournalEntryLine_journalEntryId_fkey') THEN
    ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- OwnerDisbursement FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OwnerDisbursement_propertyId_fkey') THEN
    ALTER TABLE "OwnerDisbursement" ADD CONSTRAINT "OwnerDisbursement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OwnerDisbursement_tenantId_fkey') THEN
    ALTER TABLE "OwnerDisbursement" ADD CONSTRAINT "OwnerDisbursement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- LeaseRenewalLog FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaseRenewalLog_leaseId_fkey') THEN
    ALTER TABLE "LeaseRenewalLog" ADD CONSTRAINT "LeaseRenewalLog_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaseRenewalLog_tenantId_fkey') THEN
    ALTER TABLE "LeaseRenewalLog" ADD CONSTRAINT "LeaseRenewalLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- SecurityDeposit FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDeposit_leaseId_fkey') THEN
    ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDeposit_propertyId_fkey') THEN
    ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDeposit_unitId_fkey') THEN
    ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDeposit_tenantId_fkey') THEN
    ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PropertyInspection FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyInspection_propertyId_fkey') THEN
    ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyInspection_unitId_fkey') THEN
    ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyInspection_leaseId_fkey') THEN
    ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyInspection_tenantId_fkey') THEN
    ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- LegalNotice FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalNotice_leaseId_fkey') THEN
    ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalNotice_propertyId_fkey') THEN
    ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalNotice_unitId_fkey') THEN
    ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalNotice_tenantId_fkey') THEN
    ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- VATReturn FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VATReturn_tenantId_fkey') THEN
    ALTER TABLE "VATReturn" ADD CONSTRAINT "VATReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- HACCPPlan FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HACCPPlan_tenantId_fkey') THEN
    ALTER TABLE "HACCPPlan" ADD CONSTRAINT "HACCPPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- HACCPRiskLog FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HACCPRiskLog_planId_fkey') THEN
    ALTER TABLE "HACCPRiskLog" ADD CONSTRAINT "HACCPRiskLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "HACCPPlan"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HACCPRiskLog_tenantId_fkey') THEN
    ALTER TABLE "HACCPRiskLog" ADD CONSTRAINT "HACCPRiskLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AllergenDeclaration FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AllergenDeclaration_tenantId_fkey') THEN
    ALTER TABLE "AllergenDeclaration" ADD CONSTRAINT "AllergenDeclaration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AllergenDeclaration_recipeId_fkey') THEN
    ALTER TABLE "AllergenDeclaration" ADD CONSTRAINT "AllergenDeclaration_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AllergenDeclaration_ingredientId_fkey') THEN
    ALTER TABLE "AllergenDeclaration" ADD CONSTRAINT "AllergenDeclaration_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- FoodHandlerRegistration FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FoodHandlerRegistration_tenantId_fkey') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD CONSTRAINT "FoodHandlerRegistration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- HealthInspection FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HealthInspection_tenantId_fkey') THEN
    ALTER TABLE "HealthInspection" ADD CONSTRAINT "HealthInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- TemperatureLog FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TemperatureLog_tenantId_fkey') THEN
    ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CleaningSanitationLog FK (ON DELETE CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CleaningSanitationLog_tenantId_fkey') THEN
    ALTER TABLE "CleaningSanitationLog" ADD CONSTRAINT "CleaningSanitationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


-- ============================================================================
-- INDEXES (idempotent via CREATE INDEX IF NOT EXISTS)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_Order_tenantId_status ON "Order"("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_CatalogItem_tenantId ON "CatalogItem"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Client_tenantId ON "Client"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Invoice_tenantId ON "Invoice"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Quotation_tenantId ON "Quotation"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Payment_tenantId ON "Payment"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Expense_tenantId ON "Expense"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Recipe_tenantId ON "Recipe"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Ingredient_tenantId ON "Ingredient"("tenantId");
CREATE INDEX IF NOT EXISTS idx_DesignItem_tenantId ON "DesignItem"("tenantId");
CREATE INDEX IF NOT EXISTS idx_TenantDocument_tenantId ON "TenantDocument"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Appointment_tenantId ON "Appointment"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Stylist_tenantId ON "Stylist"("tenantId");
CREATE INDEX IF NOT EXISTS idx_SalonServiceItem_tenantId ON "SalonServiceItem"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Patient_tenantId ON "Patient"("tenantId");
CREATE INDEX IF NOT EXISTS idx_MedicalAppointment_tenantId ON "MedicalAppointment"("tenantId");
CREATE INDEX IF NOT EXISTS idx_LegalCase_tenantId ON "LegalCase"("tenantId");
CREATE INDEX IF NOT EXISTS idx_TimeEntry_tenantId ON "TimeEntry"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Policy_tenantId ON "Policy"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Claim_tenantId ON "Claim"("tenantId");
CREATE INDEX IF NOT EXISTS idx_RetailProduct_tenantId_isDeleted ON "RetailProduct"("tenantId", "isDeleted");
CREATE INDEX IF NOT EXISTS idx_RetailProduct_tenantId_barcode ON "RetailProduct"("tenantId", barcode);
CREATE INDEX IF NOT EXISTS idx_StockMovement_tenantId_type ON "StockMovement"("tenantId", type);
CREATE INDEX IF NOT EXISTS idx_POSSale_tenantId_createdAt ON "POSSale"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_POSSale_tenantId_status ON "POSSale"("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_RegisterShift_tenantId_status ON "RegisterShift"("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_Event_tenantId ON "Event"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Venue_tenantId ON "Venue"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Vendor_tenantId ON "Vendor"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Contract_tenantId ON "Contract"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Project_tenantId ON "Project"("tenantId");
CREATE INDEX IF NOT EXISTS idx_LoyaltyTransaction_tenantId ON "LoyaltyTransaction"("tenantId");
CREATE INDEX IF NOT EXISTS idx_BookkeepingEntry_tenantId ON "BookkeepingEntry"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Property_tenantId ON "Property"("tenantId");
CREATE INDEX IF NOT EXISTS idx_Lease_tenantId_status ON "Lease"("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_Lease_unitId_status ON "Lease"("unitId", status);
CREATE INDEX IF NOT EXISTS idx_MaintenanceRequest_tenantId_status ON "MaintenanceRequest"("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_MaintenanceRequest_tenantId_propertyId ON "MaintenanceRequest"("tenantId", "propertyId");
CREATE INDEX IF NOT EXISTS idx_RentPayment_tenantId_status_dueDate ON "RentPayment"("tenantId", status, "dueDate");
CREATE INDEX IF NOT EXISTS idx_RentPayment_tenantId_leaseId ON "RentPayment"("tenantId", "leaseId");
CREATE INDEX IF NOT EXISTS idx_LeaseRenewalLog_leaseId ON "LeaseRenewalLog"("leaseId");


-- ============================================================================
-- DONE — All 70 tables, foreign keys, and indexes created.
-- ============================================================================
COMMIT;
