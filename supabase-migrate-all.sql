-- ============================================================================
-- ZBS Multi-Tenant SaaS — UNIFIED Migration Script
-- ============================================================================
-- Idempotent: safe to run multiple times in Supabase SQL Editor.
-- Combines: CREATE TABLEs + ADD COLUMNs + FK constraints + INDEXES
-- Order matters: tables first, then columns, then FKs, then indexes.
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE ALL 70 TABLES (idempotent via IF NOT EXISTS)
-- NOTE: No BEGIN/COMMIT — each statement runs independently so errors don't
--       roll back successful work. Safe to re-run multiple times.
-- ============================================================================

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
-- SECTION 2: ADD MISSING COLUMNS (for pre-existing tables)
-- ============================================================================

-- ============================================================
-- SECTION 1: ADD MISSING COLUMNS
-- ============================================================

-- PlatformUser -> PlatformUser
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'email') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'password') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN password TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'fullName') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "fullName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'role') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN role TEXT DEFAULT "tenant_admin";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'avatarUrl') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "avatarUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'isActive') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'hasUsedTrial') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "hasUsedTrial" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'lastActiveAt') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "lastActiveAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'country') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN country TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'timezone') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN timezone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'lastLogin') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "lastLogin" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'createdAt') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'tenantMemberships') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "tenantMemberships" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformUser' AND column_name = 'auditLogs') THEN
    ALTER TABLE "PlatformUser" ADD COLUMN "auditLogs" TEXT;
  END IF;
END $$;

-- Industry -> Industry
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'name') THEN
    ALTER TABLE "Industry" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'slug') THEN
    ALTER TABLE "Industry" ADD COLUMN slug TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'description') THEN
    ALTER TABLE "Industry" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'icon') THEN
    ALTER TABLE "Industry" ADD COLUMN icon TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'color') THEN
    ALTER TABLE "Industry" ADD COLUMN color TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'status') THEN
    ALTER TABLE "Industry" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'sortOrder') THEN
    ALTER TABLE "Industry" ADD COLUMN "sortOrder" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'createdAt') THEN
    ALTER TABLE "Industry" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Industry" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Industry' AND column_name = 'tenants') THEN
    ALTER TABLE "Industry" ADD COLUMN tenants TEXT;
  END IF;
END $$;

-- Plan -> Plan
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'name') THEN
    ALTER TABLE "Plan" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'slug') THEN
    ALTER TABLE "Plan" ADD COLUMN slug TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'tier') THEN
    ALTER TABLE "Plan" ADD COLUMN tier TEXT DEFAULT "starter";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'priceUSD') THEN
    ALTER TABLE "Plan" ADD COLUMN "priceUSD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'priceTTD') THEN
    ALTER TABLE "Plan" ADD COLUMN "priceTTD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'currency') THEN
    ALTER TABLE "Plan" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'billingCycle') THEN
    ALTER TABLE "Plan" ADD COLUMN "billingCycle" TEXT DEFAULT "monthly";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'tagline') THEN
    ALTER TABLE "Plan" ADD COLUMN tagline TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'description') THEN
    ALTER TABLE "Plan" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'idealFor') THEN
    ALTER TABLE "Plan" ADD COLUMN "idealFor" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'maxUsers') THEN
    ALTER TABLE "Plan" ADD COLUMN "maxUsers" INTEGER DEFAULT 3;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'maxBranches') THEN
    ALTER TABLE "Plan" ADD COLUMN "maxBranches" INTEGER DEFAULT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'features') THEN
    ALTER TABLE "Plan" ADD COLUMN features TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'excludedFeatures') THEN
    ALTER TABLE "Plan" ADD COLUMN "excludedFeatures" TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'isPopular') THEN
    ALTER TABLE "Plan" ADD COLUMN "isPopular" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'status') THEN
    ALTER TABLE "Plan" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'sortOrder') THEN
    ALTER TABLE "Plan" ADD COLUMN "sortOrder" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'createdAt') THEN
    ALTER TABLE "Plan" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Plan" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'tenants') THEN
    ALTER TABLE "Plan" ADD COLUMN tenants TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'subscriptions') THEN
    ALTER TABLE "Plan" ADD COLUMN subscriptions TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'priceSettings') THEN
    ALTER TABLE "Plan" ADD COLUMN "priceSettings" TEXT;
  END IF;
END $$;

-- Tenant -> Tenant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'name') THEN
    ALTER TABLE "Tenant" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'slug') THEN
    ALTER TABLE "Tenant" ADD COLUMN slug TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'logoUrl') THEN
    ALTER TABLE "Tenant" ADD COLUMN "logoUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'industryId') THEN
    ALTER TABLE "Tenant" ADD COLUMN "industryId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'planId') THEN
    ALTER TABLE "Tenant" ADD COLUMN "planId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'planName') THEN
    ALTER TABLE "Tenant" ADD COLUMN "planName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'status') THEN
    ALTER TABLE "Tenant" ADD COLUMN status TEXT DEFAULT "trial";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'trialStartsAt') THEN
    ALTER TABLE "Tenant" ADD COLUMN "trialStartsAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'trialEndsAt') THEN
    ALTER TABLE "Tenant" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'hasUsedTrial') THEN
    ALTER TABLE "Tenant" ADD COLUMN "hasUsedTrial" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'trialDurationDays') THEN
    ALTER TABLE "Tenant" ADD COLUMN "trialDurationDays" INTEGER DEFAULT 7;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'approvedBy') THEN
    ALTER TABLE "Tenant" ADD COLUMN "approvedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'approvedAt') THEN
    ALTER TABLE "Tenant" ADD COLUMN "approvedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'paymentVerified') THEN
    ALTER TABLE "Tenant" ADD COLUMN "paymentVerified" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'lastActivityAt') THEN
    ALTER TABLE "Tenant" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'registrationIp') THEN
    ALTER TABLE "Tenant" ADD COLUMN "registrationIp" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'primaryColor') THEN
    ALTER TABLE "Tenant" ADD COLUMN "primaryColor" TEXT DEFAULT "#1D4ED8";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'accentColor') THEN
    ALTER TABLE "Tenant" ADD COLUMN "accentColor" TEXT DEFAULT "#2563EB";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'currency') THEN
    ALTER TABLE "Tenant" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'timezone') THEN
    ALTER TABLE "Tenant" ADD COLUMN timezone TEXT DEFAULT "America/Port_of_Spain";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'locale') THEN
    ALTER TABLE "Tenant" ADD COLUMN locale TEXT DEFAULT "en";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'taxRate') THEN
    ALTER TABLE "Tenant" ADD COLUMN "taxRate" DOUBLE PRECISION DEFAULT 0.125;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'country') THEN
    ALTER TABLE "Tenant" ADD COLUMN country TEXT DEFAULT "TT";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'address') THEN
    ALTER TABLE "Tenant" ADD COLUMN address TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'phone') THEN
    ALTER TABLE "Tenant" ADD COLUMN phone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'email') THEN
    ALTER TABLE "Tenant" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'website') THEN
    ALTER TABLE "Tenant" ADD COLUMN website TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'settings') THEN
    ALTER TABLE "Tenant" ADD COLUMN settings TEXT DEFAULT "{}";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'createdAt') THEN
    ALTER TABLE "Tenant" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Tenant" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'memberships') THEN
    ALTER TABLE "Tenant" ADD COLUMN memberships TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'orders') THEN
    ALTER TABLE "Tenant" ADD COLUMN orders TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'catalogItems') THEN
    ALTER TABLE "Tenant" ADD COLUMN "catalogItems" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'clients') THEN
    ALTER TABLE "Tenant" ADD COLUMN clients TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'invoices') THEN
    ALTER TABLE "Tenant" ADD COLUMN invoices TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'quotations') THEN
    ALTER TABLE "Tenant" ADD COLUMN quotations TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'payments') THEN
    ALTER TABLE "Tenant" ADD COLUMN payments TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'expenses') THEN
    ALTER TABLE "Tenant" ADD COLUMN expenses TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'recipes') THEN
    ALTER TABLE "Tenant" ADD COLUMN recipes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'ingredients') THEN
    ALTER TABLE "Tenant" ADD COLUMN ingredients TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'designGallery') THEN
    ALTER TABLE "Tenant" ADD COLUMN "designGallery" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'appointments') THEN
    ALTER TABLE "Tenant" ADD COLUMN appointments TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'stylists') THEN
    ALTER TABLE "Tenant" ADD COLUMN stylists TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'salonServices') THEN
    ALTER TABLE "Tenant" ADD COLUMN "salonServices" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'subscriptions') THEN
    ALTER TABLE "Tenant" ADD COLUMN subscriptions TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'featureFlags') THEN
    ALTER TABLE "Tenant" ADD COLUMN "featureFlags" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'documents') THEN
    ALTER TABLE "Tenant" ADD COLUMN documents TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'bookkeepingEntries') THEN
    ALTER TABLE "Tenant" ADD COLUMN "bookkeepingEntries" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'auditLogs') THEN
    ALTER TABLE "Tenant" ADD COLUMN "auditLogs" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'patients') THEN
    ALTER TABLE "Tenant" ADD COLUMN patients TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'medicalAppointments') THEN
    ALTER TABLE "Tenant" ADD COLUMN "medicalAppointments" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'legalCases') THEN
    ALTER TABLE "Tenant" ADD COLUMN "legalCases" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'timeEntries') THEN
    ALTER TABLE "Tenant" ADD COLUMN "timeEntries" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'policies') THEN
    ALTER TABLE "Tenant" ADD COLUMN policies TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'claims') THEN
    ALTER TABLE "Tenant" ADD COLUMN claims TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'retailProducts') THEN
    ALTER TABLE "Tenant" ADD COLUMN "retailProducts" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'purchaseOrders') THEN
    ALTER TABLE "Tenant" ADD COLUMN "purchaseOrders" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'posSales') THEN
    ALTER TABLE "Tenant" ADD COLUMN "posSales" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'suppliers') THEN
    ALTER TABLE "Tenant" ADD COLUMN suppliers TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'stockMovements') THEN
    ALTER TABLE "Tenant" ADD COLUMN "stockMovements" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'layaways') THEN
    ALTER TABLE "Tenant" ADD COLUMN layaways TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'events') THEN
    ALTER TABLE "Tenant" ADD COLUMN events TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'venues') THEN
    ALTER TABLE "Tenant" ADD COLUMN venues TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'vendors') THEN
    ALTER TABLE "Tenant" ADD COLUMN vendors TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'projects') THEN
    ALTER TABLE "Tenant" ADD COLUMN projects TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'contracts') THEN
    ALTER TABLE "Tenant" ADD COLUMN contracts TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'propertyUnits') THEN
    ALTER TABLE "Tenant" ADD COLUMN "propertyUnits" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'leases') THEN
    ALTER TABLE "Tenant" ADD COLUMN leases TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'maintenanceRequests') THEN
    ALTER TABLE "Tenant" ADD COLUMN "maintenanceRequests" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'rentPayments') THEN
    ALTER TABLE "Tenant" ADD COLUMN "rentPayments" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'propertyDocuments') THEN
    ALTER TABLE "Tenant" ADD COLUMN "propertyDocuments" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'loyaltyMembers') THEN
    ALTER TABLE "Tenant" ADD COLUMN "loyaltyMembers" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'giftCards') THEN
    ALTER TABLE "Tenant" ADD COLUMN "giftCards" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'productReturns') THEN
    ALTER TABLE "Tenant" ADD COLUMN "productReturns" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'registerShifts') THEN
    ALTER TABLE "Tenant" ADD COLUMN "registerShifts" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'securityDeposits') THEN
    ALTER TABLE "Tenant" ADD COLUMN "securityDeposits" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'propertyInspections') THEN
    ALTER TABLE "Tenant" ADD COLUMN "propertyInspections" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'legalNotices') THEN
    ALTER TABLE "Tenant" ADD COLUMN "legalNotices" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'vatReturns') THEN
    ALTER TABLE "Tenant" ADD COLUMN "vatReturns" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'haccpPlans') THEN
    ALTER TABLE "Tenant" ADD COLUMN "haccpPlans" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'haccpRiskLogs') THEN
    ALTER TABLE "Tenant" ADD COLUMN "haccpRiskLogs" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'allergenDeclarations') THEN
    ALTER TABLE "Tenant" ADD COLUMN "allergenDeclarations" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'foodHandlerRegistrations') THEN
    ALTER TABLE "Tenant" ADD COLUMN "foodHandlerRegistrations" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'healthInspections') THEN
    ALTER TABLE "Tenant" ADD COLUMN "healthInspections" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'temperatureLogs') THEN
    ALTER TABLE "Tenant" ADD COLUMN "temperatureLogs" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'cleaningLogs') THEN
    ALTER TABLE "Tenant" ADD COLUMN "cleaningLogs" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'properties') THEN
    ALTER TABLE "Tenant" ADD COLUMN properties TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'ownerDisbursements') THEN
    ALTER TABLE "Tenant" ADD COLUMN "ownerDisbursements" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'leaseRenewalLogs') THEN
    ALTER TABLE "Tenant" ADD COLUMN "leaseRenewalLogs" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'propertyVendors') THEN
    ALTER TABLE "Tenant" ADD COLUMN "propertyVendors" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'systemEvents') THEN
    ALTER TABLE "Tenant" ADD COLUMN "systemEvents" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tenant' AND column_name = 'platformInvoices') THEN
    ALTER TABLE "Tenant" ADD COLUMN "platformInvoices" TEXT;
  END IF;
END $$;

-- TenantMembership -> TenantMembership
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantMembership' AND column_name = 'userId') THEN
    ALTER TABLE "TenantMembership" ADD COLUMN "userId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantMembership' AND column_name = 'tenantId') THEN
    ALTER TABLE "TenantMembership" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantMembership' AND column_name = 'role') THEN
    ALTER TABLE "TenantMembership" ADD COLUMN role TEXT DEFAULT "admin";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantMembership' AND column_name = 'status') THEN
    ALTER TABLE "TenantMembership" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantMembership' AND column_name = 'createdAt') THEN
    ALTER TABLE "TenantMembership" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantMembership' AND column_name = 'updatedAt') THEN
    ALTER TABLE "TenantMembership" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- TenantFeatureFlag -> TenantFeatureFlag
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantFeatureFlag' AND column_name = 'tenantId') THEN
    ALTER TABLE "TenantFeatureFlag" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantFeatureFlag' AND column_name = 'featureSlug') THEN
    ALTER TABLE "TenantFeatureFlag" ADD COLUMN "featureSlug" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantFeatureFlag' AND column_name = 'enabled') THEN
    ALTER TABLE "TenantFeatureFlag" ADD COLUMN enabled BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantFeatureFlag' AND column_name = 'createdAt') THEN
    ALTER TABLE "TenantFeatureFlag" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantFeatureFlag' AND column_name = 'updatedAt') THEN
    ALTER TABLE "TenantFeatureFlag" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- TenantSubscription -> TenantSubscription
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'tenantId') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'planId') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "planId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'planName') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "planName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'status') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'billingCycle') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "billingCycle" TEXT DEFAULT "monthly";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'priceUSD') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "priceUSD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'priceTTD') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "priceTTD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'currentPeriodStart') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "currentPeriodStart" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'currentPeriodEnd') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'paymentBehavior') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "paymentBehavior" TEXT DEFAULT "always_on_time";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'createdAt') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantSubscription' AND column_name = 'updatedAt') THEN
    ALTER TABLE "TenantSubscription" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Order -> Order
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'tenantId') THEN
    ALTER TABLE "Order" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'orderNumber') THEN
    ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'clientName') THEN
    ALTER TABLE "Order" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'clientEmail') THEN
    ALTER TABLE "Order" ADD COLUMN "clientEmail" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'clientPhone') THEN
    ALTER TABLE "Order" ADD COLUMN "clientPhone" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'items') THEN
    ALTER TABLE "Order" ADD COLUMN items TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'subtotal') THEN
    ALTER TABLE "Order" ADD COLUMN subtotal NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'taxAmount') THEN
    ALTER TABLE "Order" ADD COLUMN "taxAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'totalAmount') THEN
    ALTER TABLE "Order" ADD COLUMN "totalAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'status') THEN
    ALTER TABLE "Order" ADD COLUMN status TEXT DEFAULT "pending";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'orderType') THEN
    ALTER TABLE "Order" ADD COLUMN "orderType" TEXT DEFAULT "custom";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'deliveryDate') THEN
    ALTER TABLE "Order" ADD COLUMN "deliveryDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'deliveryAddress') THEN
    ALTER TABLE "Order" ADD COLUMN "deliveryAddress" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'notes') THEN
    ALTER TABLE "Order" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Order" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'createdAt') THEN
    ALTER TABLE "Order" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Order" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- CatalogItem -> CatalogItem
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'tenantId') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'name') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'description') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'category') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'price') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN price NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'cost') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN cost NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'unit') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN unit TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'imageUrl') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN "imageUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'isAvailable') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN "isAvailable" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'isDeleted') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'createdAt') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CatalogItem' AND column_name = 'updatedAt') THEN
    ALTER TABLE "CatalogItem" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Client -> Client
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'tenantId') THEN
    ALTER TABLE "Client" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'name') THEN
    ALTER TABLE "Client" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'email') THEN
    ALTER TABLE "Client" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'phone') THEN
    ALTER TABLE "Client" ADD COLUMN phone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'address') THEN
    ALTER TABLE "Client" ADD COLUMN address TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'notes') THEN
    ALTER TABLE "Client" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'tags') THEN
    ALTER TABLE "Client" ADD COLUMN tags TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Client" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'createdAt') THEN
    ALTER TABLE "Client" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Client" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Client' AND column_name = 'loyaltyMembers') THEN
    ALTER TABLE "Client" ADD COLUMN "loyaltyMembers" TEXT;
  END IF;
END $$;

-- Invoice -> Invoice
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'tenantId') THEN
    ALTER TABLE "Invoice" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'invoiceNumber') THEN
    ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'clientName') THEN
    ALTER TABLE "Invoice" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'clientEmail') THEN
    ALTER TABLE "Invoice" ADD COLUMN "clientEmail" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'items') THEN
    ALTER TABLE "Invoice" ADD COLUMN items TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'subtotal') THEN
    ALTER TABLE "Invoice" ADD COLUMN subtotal NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'taxRate') THEN
    ALTER TABLE "Invoice" ADD COLUMN "taxRate" DOUBLE PRECISION DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'taxAmount') THEN
    ALTER TABLE "Invoice" ADD COLUMN "taxAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'totalAmount') THEN
    ALTER TABLE "Invoice" ADD COLUMN "totalAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'balanceDue') THEN
    ALTER TABLE "Invoice" ADD COLUMN "balanceDue" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'status') THEN
    ALTER TABLE "Invoice" ADD COLUMN status TEXT DEFAULT "draft";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'issueDate') THEN
    ALTER TABLE "Invoice" ADD COLUMN "issueDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'dueDate') THEN
    ALTER TABLE "Invoice" ADD COLUMN "dueDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'notes') THEN
    ALTER TABLE "Invoice" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Invoice" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'createdAt') THEN
    ALTER TABLE "Invoice" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Invoice" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Invoice' AND column_name = 'payments') THEN
    ALTER TABLE "Invoice" ADD COLUMN payments TEXT;
  END IF;
END $$;

-- Quotation -> Quotation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'tenantId') THEN
    ALTER TABLE "Quotation" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'quoteNumber') THEN
    ALTER TABLE "Quotation" ADD COLUMN "quoteNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'clientName') THEN
    ALTER TABLE "Quotation" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'clientEmail') THEN
    ALTER TABLE "Quotation" ADD COLUMN "clientEmail" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'clientPhone') THEN
    ALTER TABLE "Quotation" ADD COLUMN "clientPhone" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'items') THEN
    ALTER TABLE "Quotation" ADD COLUMN items TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'subtotal') THEN
    ALTER TABLE "Quotation" ADD COLUMN subtotal NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'discount') THEN
    ALTER TABLE "Quotation" ADD COLUMN discount NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'taxRate') THEN
    ALTER TABLE "Quotation" ADD COLUMN "taxRate" DOUBLE PRECISION DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'taxAmount') THEN
    ALTER TABLE "Quotation" ADD COLUMN "taxAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'totalAmount') THEN
    ALTER TABLE "Quotation" ADD COLUMN "totalAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'status') THEN
    ALTER TABLE "Quotation" ADD COLUMN status TEXT DEFAULT "draft";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'validUntil') THEN
    ALTER TABLE "Quotation" ADD COLUMN "validUntil" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'notes') THEN
    ALTER TABLE "Quotation" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Quotation" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'createdAt') THEN
    ALTER TABLE "Quotation" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Quotation' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Quotation" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Payment -> Payment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'tenantId') THEN
    ALTER TABLE "Payment" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'invoiceId') THEN
    ALTER TABLE "Payment" ADD COLUMN "invoiceId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'amount') THEN
    ALTER TABLE "Payment" ADD COLUMN amount NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'currency') THEN
    ALTER TABLE "Payment" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'method') THEN
    ALTER TABLE "Payment" ADD COLUMN method TEXT DEFAULT "cash";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'reference') THEN
    ALTER TABLE "Payment" ADD COLUMN reference TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'status') THEN
    ALTER TABLE "Payment" ADD COLUMN status TEXT DEFAULT "completed";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'notes') THEN
    ALTER TABLE "Payment" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Payment" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'createdAt') THEN
    ALTER TABLE "Payment" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Payment" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Expense -> Expense
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'tenantId') THEN
    ALTER TABLE "Expense" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'category') THEN
    ALTER TABLE "Expense" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'description') THEN
    ALTER TABLE "Expense" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'amount') THEN
    ALTER TABLE "Expense" ADD COLUMN amount NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'currency') THEN
    ALTER TABLE "Expense" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'date') THEN
    ALTER TABLE "Expense" ADD COLUMN date TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'receiptUrl') THEN
    ALTER TABLE "Expense" ADD COLUMN "receiptUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'vendor') THEN
    ALTER TABLE "Expense" ADD COLUMN vendor TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Expense" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'createdAt') THEN
    ALTER TABLE "Expense" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Expense' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Expense" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Recipe -> Recipe
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'tenantId') THEN
    ALTER TABLE "Recipe" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'name') THEN
    ALTER TABLE "Recipe" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'description') THEN
    ALTER TABLE "Recipe" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'category') THEN
    ALTER TABLE "Recipe" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'servings') THEN
    ALTER TABLE "Recipe" ADD COLUMN servings INTEGER;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'prepTime') THEN
    ALTER TABLE "Recipe" ADD COLUMN "prepTime" INTEGER;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'cookTime') THEN
    ALTER TABLE "Recipe" ADD COLUMN "cookTime" INTEGER;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'ingredients') THEN
    ALTER TABLE "Recipe" ADD COLUMN ingredients TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'instructions') THEN
    ALTER TABLE "Recipe" ADD COLUMN instructions TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'costPerServing') THEN
    ALTER TABLE "Recipe" ADD COLUMN "costPerServing" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'sellingPrice') THEN
    ALTER TABLE "Recipe" ADD COLUMN "sellingPrice" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'imageUrl') THEN
    ALTER TABLE "Recipe" ADD COLUMN "imageUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'isPublic') THEN
    ALTER TABLE "Recipe" ADD COLUMN "isPublic" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Recipe" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'createdAt') THEN
    ALTER TABLE "Recipe" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Recipe" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'allergenDeclarations') THEN
    ALTER TABLE "Recipe" ADD COLUMN "allergenDeclarations" TEXT;
  END IF;
END $$;

-- Ingredient -> Ingredient
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'tenantId') THEN
    ALTER TABLE "Ingredient" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'name') THEN
    ALTER TABLE "Ingredient" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'category') THEN
    ALTER TABLE "Ingredient" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'unit') THEN
    ALTER TABLE "Ingredient" ADD COLUMN unit TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'costPerUnit') THEN
    ALTER TABLE "Ingredient" ADD COLUMN "costPerUnit" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'quantity') THEN
    ALTER TABLE "Ingredient" ADD COLUMN quantity DOUBLE PRECISION DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'minStock') THEN
    ALTER TABLE "Ingredient" ADD COLUMN "minStock" DOUBLE PRECISION DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'supplier') THEN
    ALTER TABLE "Ingredient" ADD COLUMN supplier TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Ingredient" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'createdAt') THEN
    ALTER TABLE "Ingredient" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Ingredient" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'allergenDeclarations') THEN
    ALTER TABLE "Ingredient" ADD COLUMN "allergenDeclarations" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Ingredient' AND column_name = 'stockMovements') THEN
    ALTER TABLE "Ingredient" ADD COLUMN "stockMovements" TEXT;
  END IF;
END $$;

-- DesignItem -> DesignItem
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'tenantId') THEN
    ALTER TABLE "DesignItem" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'title') THEN
    ALTER TABLE "DesignItem" ADD COLUMN title TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'description') THEN
    ALTER TABLE "DesignItem" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'category') THEN
    ALTER TABLE "DesignItem" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'imageUrl') THEN
    ALTER TABLE "DesignItem" ADD COLUMN "imageUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'tags') THEN
    ALTER TABLE "DesignItem" ADD COLUMN tags TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'isDeleted') THEN
    ALTER TABLE "DesignItem" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'createdAt') THEN
    ALTER TABLE "DesignItem" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DesignItem' AND column_name = 'updatedAt') THEN
    ALTER TABLE "DesignItem" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- TenantDocument -> TenantDocument
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantDocument' AND column_name = 'tenantId') THEN
    ALTER TABLE "TenantDocument" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantDocument' AND column_name = 'name') THEN
    ALTER TABLE "TenantDocument" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantDocument' AND column_name = 'type') THEN
    ALTER TABLE "TenantDocument" ADD COLUMN type TEXT DEFAULT "general";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantDocument' AND column_name = 'content') THEN
    ALTER TABLE "TenantDocument" ADD COLUMN content TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantDocument' AND column_name = 'fileUrl') THEN
    ALTER TABLE "TenantDocument" ADD COLUMN "fileUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantDocument' AND column_name = 'isDeleted') THEN
    ALTER TABLE "TenantDocument" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantDocument' AND column_name = 'createdAt') THEN
    ALTER TABLE "TenantDocument" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TenantDocument' AND column_name = 'updatedAt') THEN
    ALTER TABLE "TenantDocument" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Appointment -> Appointment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'tenantId') THEN
    ALTER TABLE "Appointment" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'clientName') THEN
    ALTER TABLE "Appointment" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'stylistId') THEN
    ALTER TABLE "Appointment" ADD COLUMN "stylistId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'serviceId') THEN
    ALTER TABLE "Appointment" ADD COLUMN "serviceId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'date') THEN
    ALTER TABLE "Appointment" ADD COLUMN date TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'duration') THEN
    ALTER TABLE "Appointment" ADD COLUMN duration INTEGER DEFAULT 60;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'status') THEN
    ALTER TABLE "Appointment" ADD COLUMN status TEXT DEFAULT "scheduled";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'notes') THEN
    ALTER TABLE "Appointment" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Appointment" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'createdAt') THEN
    ALTER TABLE "Appointment" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Appointment" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Stylist -> Stylist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'tenantId') THEN
    ALTER TABLE "Stylist" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'name') THEN
    ALTER TABLE "Stylist" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'specialty') THEN
    ALTER TABLE "Stylist" ADD COLUMN specialty TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'phone') THEN
    ALTER TABLE "Stylist" ADD COLUMN phone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'email') THEN
    ALTER TABLE "Stylist" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'imageUrl') THEN
    ALTER TABLE "Stylist" ADD COLUMN "imageUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'isActive') THEN
    ALTER TABLE "Stylist" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Stylist" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'createdAt') THEN
    ALTER TABLE "Stylist" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Stylist" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Stylist' AND column_name = 'appointments') THEN
    ALTER TABLE "Stylist" ADD COLUMN appointments TEXT;
  END IF;
END $$;

-- SalonServiceItem -> SalonServiceItem
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'tenantId') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'name') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'description') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'duration') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN duration INTEGER DEFAULT 60;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'price') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN price NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'category') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'isActive') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'isDeleted') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'createdAt') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'updatedAt') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonServiceItem' AND column_name = 'appointments') THEN
    ALTER TABLE "SalonServiceItem" ADD COLUMN appointments TEXT;
  END IF;
END $$;

-- Patient -> Patient
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'tenantId') THEN
    ALTER TABLE "Patient" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'firstName') THEN
    ALTER TABLE "Patient" ADD COLUMN "firstName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'lastName') THEN
    ALTER TABLE "Patient" ADD COLUMN "lastName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'dateOfBirth') THEN
    ALTER TABLE "Patient" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'gender') THEN
    ALTER TABLE "Patient" ADD COLUMN gender TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'email') THEN
    ALTER TABLE "Patient" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'phone') THEN
    ALTER TABLE "Patient" ADD COLUMN phone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'address') THEN
    ALTER TABLE "Patient" ADD COLUMN address TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'bloodType') THEN
    ALTER TABLE "Patient" ADD COLUMN "bloodType" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'allergies') THEN
    ALTER TABLE "Patient" ADD COLUMN allergies TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'medicalNotes') THEN
    ALTER TABLE "Patient" ADD COLUMN "medicalNotes" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'insuranceProvider') THEN
    ALTER TABLE "Patient" ADD COLUMN "insuranceProvider" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'insuranceNumber') THEN
    ALTER TABLE "Patient" ADD COLUMN "insuranceNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'emergencyContact') THEN
    ALTER TABLE "Patient" ADD COLUMN "emergencyContact" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'emergencyPhone') THEN
    ALTER TABLE "Patient" ADD COLUMN "emergencyPhone" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Patient" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'createdAt') THEN
    ALTER TABLE "Patient" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Patient" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Patient' AND column_name = 'medicalAppointments') THEN
    ALTER TABLE "Patient" ADD COLUMN "medicalAppointments" TEXT;
  END IF;
END $$;

-- MedicalAppointment -> MedicalAppointment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'tenantId') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'patientId') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN "patientId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'doctorName') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN "doctorName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'specialty') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN specialty TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'date') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN date TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'duration') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN duration INTEGER DEFAULT 30;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'status') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN status TEXT DEFAULT "scheduled";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'notes') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'diagnosis') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN diagnosis TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'prescription') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN prescription TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'isDeleted') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'createdAt') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MedicalAppointment' AND column_name = 'updatedAt') THEN
    ALTER TABLE "MedicalAppointment" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- LegalCase -> LegalCase
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'tenantId') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'caseNumber') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "caseNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'title') THEN
    ALTER TABLE "LegalCase" ADD COLUMN title TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'clientName') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'caseType') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "caseType" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'status') THEN
    ALTER TABLE "LegalCase" ADD COLUMN status TEXT DEFAULT "open";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'court') THEN
    ALTER TABLE "LegalCase" ADD COLUMN court TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'judge') THEN
    ALTER TABLE "LegalCase" ADD COLUMN judge TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'openDate') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "openDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'closeDate') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "closeDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'description') THEN
    ALTER TABLE "LegalCase" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'billingRate') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "billingRate" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'hoursBilled') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "hoursBilled" DOUBLE PRECISION DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'isDeleted') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'createdAt') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'updatedAt') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalCase' AND column_name = 'timeEntries') THEN
    ALTER TABLE "LegalCase" ADD COLUMN "timeEntries" TEXT;
  END IF;
END $$;

-- TimeEntry -> TimeEntry
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'tenantId') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'caseId') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN "caseId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'description') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'duration') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN duration INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'billingRate') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN "billingRate" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'billable') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN billable BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'date') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN date TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'isDeleted') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'createdAt') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TimeEntry' AND column_name = 'updatedAt') THEN
    ALTER TABLE "TimeEntry" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Policy -> Policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'tenantId') THEN
    ALTER TABLE "Policy" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'policyNumber') THEN
    ALTER TABLE "Policy" ADD COLUMN "policyNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'clientName') THEN
    ALTER TABLE "Policy" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'type') THEN
    ALTER TABLE "Policy" ADD COLUMN type TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'premium') THEN
    ALTER TABLE "Policy" ADD COLUMN premium NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'coverage') THEN
    ALTER TABLE "Policy" ADD COLUMN coverage NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'startDate') THEN
    ALTER TABLE "Policy" ADD COLUMN "startDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'endDate') THEN
    ALTER TABLE "Policy" ADD COLUMN "endDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'status') THEN
    ALTER TABLE "Policy" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'beneficiaries') THEN
    ALTER TABLE "Policy" ADD COLUMN beneficiaries TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Policy" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'createdAt') THEN
    ALTER TABLE "Policy" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Policy" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Policy' AND column_name = 'claims') THEN
    ALTER TABLE "Policy" ADD COLUMN claims TEXT;
  END IF;
END $$;

-- Claim -> Claim
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'tenantId') THEN
    ALTER TABLE "Claim" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'policyId') THEN
    ALTER TABLE "Claim" ADD COLUMN "policyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'claimNumber') THEN
    ALTER TABLE "Claim" ADD COLUMN "claimNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'claimantName') THEN
    ALTER TABLE "Claim" ADD COLUMN "claimantName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'type') THEN
    ALTER TABLE "Claim" ADD COLUMN type TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'amount') THEN
    ALTER TABLE "Claim" ADD COLUMN amount NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'status') THEN
    ALTER TABLE "Claim" ADD COLUMN status TEXT DEFAULT "submitted";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'incidentDate') THEN
    ALTER TABLE "Claim" ADD COLUMN "incidentDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'description') THEN
    ALTER TABLE "Claim" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Claim" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'createdAt') THEN
    ALTER TABLE "Claim" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Claim' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Claim" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- RetailProduct -> RetailProduct
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'tenantId') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'name') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'sku') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN sku TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'category') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'price') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN price NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'cost') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN cost NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'quantity') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN quantity INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'minStock') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "minStock" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'supplier') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN supplier TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'barcode') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN barcode TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'imageUrl') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "imageUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'taxCategory') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "taxCategory" TEXT DEFAULT "standard";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'settings') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN settings TEXT DEFAULT "{}";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'isActive') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'isDeleted') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'createdAt') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RetailProduct' AND column_name = 'updatedAt') THEN
    ALTER TABLE "RetailProduct" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Layaway -> Layaway
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'tenantId') THEN
    ALTER TABLE "Layaway" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'layawayNumber') THEN
    ALTER TABLE "Layaway" ADD COLUMN "layawayNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'customerName') THEN
    ALTER TABLE "Layaway" ADD COLUMN "customerName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'customerPhone') THEN
    ALTER TABLE "Layaway" ADD COLUMN "customerPhone" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'customerEmail') THEN
    ALTER TABLE "Layaway" ADD COLUMN "customerEmail" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'items') THEN
    ALTER TABLE "Layaway" ADD COLUMN items TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'totalAmount') THEN
    ALTER TABLE "Layaway" ADD COLUMN "totalAmount" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'depositAmount') THEN
    ALTER TABLE "Layaway" ADD COLUMN "depositAmount" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'balanceRemaining') THEN
    ALTER TABLE "Layaway" ADD COLUMN "balanceRemaining" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'payments') THEN
    ALTER TABLE "Layaway" ADD COLUMN payments TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'status') THEN
    ALTER TABLE "Layaway" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'dueDate') THEN
    ALTER TABLE "Layaway" ADD COLUMN "dueDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'expiryDate') THEN
    ALTER TABLE "Layaway" ADD COLUMN "expiryDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'depositPercentage') THEN
    ALTER TABLE "Layaway" ADD COLUMN "depositPercentage" NUMERIC(12,2) DEFAULT 20;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'notes') THEN
    ALTER TABLE "Layaway" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Layaway" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'createdAt') THEN
    ALTER TABLE "Layaway" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Layaway' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Layaway" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- StockMovement -> StockMovement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'tenantId') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'ingredientId') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "ingredientId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'type') THEN
    ALTER TABLE "StockMovement" ADD COLUMN type TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'quantity') THEN
    ALTER TABLE "StockMovement" ADD COLUMN quantity NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'previousStock') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "previousStock" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'newStock') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "newStock" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'unitCost') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "unitCost" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'reason') THEN
    ALTER TABLE "StockMovement" ADD COLUMN reason TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'reference') THEN
    ALTER TABLE "StockMovement" ADD COLUMN reference TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'batchNumber') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "batchNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'expiryDate') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "expiryDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'method') THEN
    ALTER TABLE "StockMovement" ADD COLUMN method TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'createdAt') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'updatedAt') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- PurchaseOrder -> PurchaseOrder
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'tenantId') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'poNumber') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "poNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'supplierId') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "supplierId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'supplierName') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "supplierName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'status') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN status TEXT DEFAULT "draft";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'items') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN items TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'totalAmount') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "totalAmount" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'receivedAmount') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "receivedAmount" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'notes') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'expectedDate') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "expectedDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'receivedAt') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "receivedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'isDeleted') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'createdAt') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- POSSale -> POSSale
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'tenantId') THEN
    ALTER TABLE "POSSale" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'saleNumber') THEN
    ALTER TABLE "POSSale" ADD COLUMN "saleNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'items') THEN
    ALTER TABLE "POSSale" ADD COLUMN items TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'subtotal') THEN
    ALTER TABLE "POSSale" ADD COLUMN subtotal NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'discountPct') THEN
    ALTER TABLE "POSSale" ADD COLUMN "discountPct" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'discountAmount') THEN
    ALTER TABLE "POSSale" ADD COLUMN "discountAmount" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'taxAmount') THEN
    ALTER TABLE "POSSale" ADD COLUMN "taxAmount" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'taxRate') THEN
    ALTER TABLE "POSSale" ADD COLUMN "taxRate" NUMERIC(5,4) DEFAULT 0.125;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'totalAmount') THEN
    ALTER TABLE "POSSale" ADD COLUMN "totalAmount" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'paymentMethod') THEN
    ALTER TABLE "POSSale" ADD COLUMN "paymentMethod" TEXT DEFAULT "cash";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'giftCardId') THEN
    ALTER TABLE "POSSale" ADD COLUMN "giftCardId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'splitDetails') THEN
    ALTER TABLE "POSSale" ADD COLUMN "splitDetails" TEXT DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'cashReceived') THEN
    ALTER TABLE "POSSale" ADD COLUMN "cashReceived" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'changeAmount') THEN
    ALTER TABLE "POSSale" ADD COLUMN "changeAmount" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'currency') THEN
    ALTER TABLE "POSSale" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'customerName') THEN
    ALTER TABLE "POSSale" ADD COLUMN "customerName" TEXT DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'staffName') THEN
    ALTER TABLE "POSSale" ADD COLUMN "staffName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'status') THEN
    ALTER TABLE "POSSale" ADD COLUMN status TEXT DEFAULT "completed";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'isDeleted') THEN
    ALTER TABLE "POSSale" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'createdAt') THEN
    ALTER TABLE "POSSale" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'updatedAt') THEN
    ALTER TABLE "POSSale" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'POSSale' AND column_name = 'productReturns') THEN
    ALTER TABLE "POSSale" ADD COLUMN "productReturns" TEXT;
  END IF;
END $$;

-- GiftCard -> GiftCard
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'tenantId') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'cardNumber') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "cardNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'cardCode') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "cardCode" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'initialBalance') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "initialBalance" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'currentBalance') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "currentBalance" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'customerName') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "customerName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'purchaserName') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "purchaserName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'status') THEN
    ALTER TABLE "GiftCard" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'issuedAt') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "issuedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'expiresAt') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "expiresAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'lastUsedAt') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'transactions') THEN
    ALTER TABLE "GiftCard" ADD COLUMN transactions TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'notes') THEN
    ALTER TABLE "GiftCard" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'isDeleted') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'createdAt') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'updatedAt') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'GiftCard' AND column_name = 'posSales') THEN
    ALTER TABLE "GiftCard" ADD COLUMN "posSales" TEXT;
  END IF;
END $$;

-- ProductReturn -> ProductReturn
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'tenantId') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'saleId') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "saleId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'returnNumber') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "returnNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'items') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN items TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'totalRefund') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "totalRefund" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'refundMethod') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "refundMethod" TEXT DEFAULT "cash";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'reason') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN reason TEXT DEFAULT "other";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'status') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN status TEXT DEFAULT "pending";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'processedBy') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "processedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'notes') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'isDeleted') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'createdAt') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductReturn' AND column_name = 'updatedAt') THEN
    ALTER TABLE "ProductReturn" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- RegisterShift -> RegisterShift
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'tenantId') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'shiftNumber') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "shiftNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'staffName') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "staffName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'staffId') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "staffId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'openedAt') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "openedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'closedAt') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "closedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'status') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN status TEXT DEFAULT "open";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'startingCash') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "startingCash" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'closingCash') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "closingCash" NUMERIC(12,2);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'expectedCash') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "expectedCash" NUMERIC(12,2);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'cashSales') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "cashSales" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'cardSales') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "cardSales" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'transferSales') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "transferSales" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'totalSales') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "totalSales" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'totalRefunds') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "totalRefunds" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'giftCardSales') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "giftCardSales" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'layawayDeposits') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "layawayDeposits" NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'transactionCount') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "transactionCount" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'refundCount') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "refundCount" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'discrepancy') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN discrepancy NUMERIC(12,2);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'notes') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'isDeleted') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'createdAt') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegisterShift' AND column_name = 'updatedAt') THEN
    ALTER TABLE "RegisterShift" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Event -> Event
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'tenantId') THEN
    ALTER TABLE "Event" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'name') THEN
    ALTER TABLE "Event" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'type') THEN
    ALTER TABLE "Event" ADD COLUMN type TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'clientName') THEN
    ALTER TABLE "Event" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'venue') THEN
    ALTER TABLE "Event" ADD COLUMN venue TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'eventDate') THEN
    ALTER TABLE "Event" ADD COLUMN "eventDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'setupDate') THEN
    ALTER TABLE "Event" ADD COLUMN "setupDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'guestCount') THEN
    ALTER TABLE "Event" ADD COLUMN "guestCount" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'budget') THEN
    ALTER TABLE "Event" ADD COLUMN budget NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'status') THEN
    ALTER TABLE "Event" ADD COLUMN status TEXT DEFAULT "planning";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'notes') THEN
    ALTER TABLE "Event" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Event" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'createdAt') THEN
    ALTER TABLE "Event" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Event" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Supplier -> Supplier
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'tenantId') THEN
    ALTER TABLE "Supplier" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'name') THEN
    ALTER TABLE "Supplier" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'contact') THEN
    ALTER TABLE "Supplier" ADD COLUMN contact TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'email') THEN
    ALTER TABLE "Supplier" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'phone') THEN
    ALTER TABLE "Supplier" ADD COLUMN phone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'address') THEN
    ALTER TABLE "Supplier" ADD COLUMN address TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'category') THEN
    ALTER TABLE "Supplier" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'rating') THEN
    ALTER TABLE "Supplier" ADD COLUMN rating INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'notes') THEN
    ALTER TABLE "Supplier" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Supplier" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'createdAt') THEN
    ALTER TABLE "Supplier" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Supplier" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'purchaseOrders') THEN
    ALTER TABLE "Supplier" ADD COLUMN "purchaseOrders" TEXT;
  END IF;
END $$;

-- Venue -> Venue
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'tenantId') THEN
    ALTER TABLE "Venue" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'name') THEN
    ALTER TABLE "Venue" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'location') THEN
    ALTER TABLE "Venue" ADD COLUMN location TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'capacity') THEN
    ALTER TABLE "Venue" ADD COLUMN capacity INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'contact') THEN
    ALTER TABLE "Venue" ADD COLUMN contact TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'email') THEN
    ALTER TABLE "Venue" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'phone') THEN
    ALTER TABLE "Venue" ADD COLUMN phone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'amenities') THEN
    ALTER TABLE "Venue" ADD COLUMN amenities TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'pricePerHour') THEN
    ALTER TABLE "Venue" ADD COLUMN "pricePerHour" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'isActive') THEN
    ALTER TABLE "Venue" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Venue" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'createdAt') THEN
    ALTER TABLE "Venue" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Venue' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Venue" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Vendor -> Vendor
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'tenantId') THEN
    ALTER TABLE "Vendor" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'name') THEN
    ALTER TABLE "Vendor" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'category') THEN
    ALTER TABLE "Vendor" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'contact') THEN
    ALTER TABLE "Vendor" ADD COLUMN contact TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'email') THEN
    ALTER TABLE "Vendor" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'phone') THEN
    ALTER TABLE "Vendor" ADD COLUMN phone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'rating') THEN
    ALTER TABLE "Vendor" ADD COLUMN rating INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'notes') THEN
    ALTER TABLE "Vendor" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Vendor" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'createdAt') THEN
    ALTER TABLE "Vendor" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Vendor' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Vendor" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Contract -> Contract
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'tenantId') THEN
    ALTER TABLE "Contract" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'clientName') THEN
    ALTER TABLE "Contract" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'type') THEN
    ALTER TABLE "Contract" ADD COLUMN type TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'value') THEN
    ALTER TABLE "Contract" ADD COLUMN value NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'startDate') THEN
    ALTER TABLE "Contract" ADD COLUMN "startDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'endDate') THEN
    ALTER TABLE "Contract" ADD COLUMN "endDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'status') THEN
    ALTER TABLE "Contract" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'description') THEN
    ALTER TABLE "Contract" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'notes') THEN
    ALTER TABLE "Contract" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Contract" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'createdAt') THEN
    ALTER TABLE "Contract" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Contract" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Project -> Project
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'tenantId') THEN
    ALTER TABLE "Project" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'name') THEN
    ALTER TABLE "Project" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'clientName') THEN
    ALTER TABLE "Project" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'status') THEN
    ALTER TABLE "Project" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'startDate') THEN
    ALTER TABLE "Project" ADD COLUMN "startDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'deadline') THEN
    ALTER TABLE "Project" ADD COLUMN deadline TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'budget') THEN
    ALTER TABLE "Project" ADD COLUMN budget NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'spent') THEN
    ALTER TABLE "Project" ADD COLUMN spent NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'progress') THEN
    ALTER TABLE "Project" ADD COLUMN progress INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'description') THEN
    ALTER TABLE "Project" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'isDeleted') THEN
    ALTER TABLE "Project" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'createdAt') THEN
    ALTER TABLE "Project" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Project" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- LoyaltyMember -> LoyaltyMember
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'tenantId') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'clientId') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "clientId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'clientName') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "clientName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'clientPhone') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "clientPhone" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'clientEmail') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "clientEmail" TEXT DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'points') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN points INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'totalSpent') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "totalSpent" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'totalOrders') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "totalOrders" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'tier') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN tier TEXT DEFAULT "bronze";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'joinDate') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "joinDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'lastVisit') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "lastVisit" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'createdAt') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyMember' AND column_name = 'transactions') THEN
    ALTER TABLE "LoyaltyMember" ADD COLUMN transactions TEXT;
  END IF;
END $$;

-- LoyaltyTransaction -> LoyaltyTransaction
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyTransaction' AND column_name = 'memberId') THEN
    ALTER TABLE "LoyaltyTransaction" ADD COLUMN "memberId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyTransaction' AND column_name = 'tenantId') THEN
    ALTER TABLE "LoyaltyTransaction" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyTransaction' AND column_name = 'type') THEN
    ALTER TABLE "LoyaltyTransaction" ADD COLUMN type TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyTransaction' AND column_name = 'points') THEN
    ALTER TABLE "LoyaltyTransaction" ADD COLUMN points INTEGER;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyTransaction' AND column_name = 'description') THEN
    ALTER TABLE "LoyaltyTransaction" ADD COLUMN description TEXT DEFAULT '';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoyaltyTransaction' AND column_name = 'createdAt') THEN
    ALTER TABLE "LoyaltyTransaction" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- BookkeepingEntry -> BookkeepingEntry
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'tenantId') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'date') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN date TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'description') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'category') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'type') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN type TEXT DEFAULT "debit";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'amount') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN amount NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'currency') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'reference') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN reference TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'accountId') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN "accountId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'isDeleted') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN "isDeleted" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'createdAt') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BookkeepingEntry' AND column_name = 'updatedAt') THEN
    ALTER TABLE "BookkeepingEntry" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- AuditLog -> AuditLog
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'userId') THEN
    ALTER TABLE "AuditLog" ADD COLUMN "userId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'tenantId') THEN
    ALTER TABLE "AuditLog" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'action') THEN
    ALTER TABLE "AuditLog" ADD COLUMN action TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'details') THEN
    ALTER TABLE "AuditLog" ADD COLUMN details TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'severity') THEN
    ALTER TABLE "AuditLog" ADD COLUMN severity TEXT DEFAULT "info";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'ipAddress') THEN
    ALTER TABLE "AuditLog" ADD COLUMN "ipAddress" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'createdAt') THEN
    ALTER TABLE "AuditLog" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- SystemEvent -> SystemEvent
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemEvent' AND column_name = 'type') THEN
    ALTER TABLE "SystemEvent" ADD COLUMN type TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemEvent' AND column_name = 'title') THEN
    ALTER TABLE "SystemEvent" ADD COLUMN title TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemEvent' AND column_name = 'description') THEN
    ALTER TABLE "SystemEvent" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemEvent' AND column_name = 'severity') THEN
    ALTER TABLE "SystemEvent" ADD COLUMN severity TEXT DEFAULT "info";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemEvent' AND column_name = 'tenantId') THEN
    ALTER TABLE "SystemEvent" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemEvent' AND column_name = 'metadata') THEN
    ALTER TABLE "SystemEvent" ADD COLUMN metadata TEXT DEFAULT "{}";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemEvent' AND column_name = 'createdAt') THEN
    ALTER TABLE "SystemEvent" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- PlatformInvoice -> PlatformInvoice
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'tenantId') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'invoiceNumber') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN "invoiceNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'amountUSD') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN "amountUSD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'amountTTD') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN "amountTTD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'status') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN status TEXT DEFAULT "draft";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'issueDate') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN "issueDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'dueDate') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN "dueDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'createdAt') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformInvoice' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PlatformInvoice" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- PriceSetting -> PriceSetting
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PriceSetting' AND column_name = 'planId') THEN
    ALTER TABLE "PriceSetting" ADD COLUMN "planId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PriceSetting' AND column_name = 'key') THEN
    ALTER TABLE "PriceSetting" ADD COLUMN key TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PriceSetting' AND column_name = 'valueUSD') THEN
    ALTER TABLE "PriceSetting" ADD COLUMN "valueUSD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PriceSetting' AND column_name = 'valueTTD') THEN
    ALTER TABLE "PriceSetting" ADD COLUMN "valueTTD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PriceSetting' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PriceSetting" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Property -> Property
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'tenantId') THEN
    ALTER TABLE "Property" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'name') THEN
    ALTER TABLE "Property" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'address') THEN
    ALTER TABLE "Property" ADD COLUMN address TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'city') THEN
    ALTER TABLE "Property" ADD COLUMN city TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'country') THEN
    ALTER TABLE "Property" ADD COLUMN country TEXT DEFAULT "TT";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'type') THEN
    ALTER TABLE "Property" ADD COLUMN type TEXT DEFAULT "commercial";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'totalArea') THEN
    ALTER TABLE "Property" ADD COLUMN "totalArea" DOUBLE PRECISION;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'units') THEN
    ALTER TABLE "Property" ADD COLUMN units INTEGER DEFAULT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'description') THEN
    ALTER TABLE "Property" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'imageUrl') THEN
    ALTER TABLE "Property" ADD COLUMN "imageUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'status') THEN
    ALTER TABLE "Property" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'createdAt') THEN
    ALTER TABLE "Property" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Property" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'propertyUnits') THEN
    ALTER TABLE "Property" ADD COLUMN "propertyUnits" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'maintenanceRequests') THEN
    ALTER TABLE "Property" ADD COLUMN "maintenanceRequests" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'rentPayments') THEN
    ALTER TABLE "Property" ADD COLUMN "rentPayments" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'vendors') THEN
    ALTER TABLE "Property" ADD COLUMN vendors TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'documents') THEN
    ALTER TABLE "Property" ADD COLUMN documents TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'deposits') THEN
    ALTER TABLE "Property" ADD COLUMN deposits TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'inspections') THEN
    ALTER TABLE "Property" ADD COLUMN inspections TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'legalNotices') THEN
    ALTER TABLE "Property" ADD COLUMN "legalNotices" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'ownerDisbursements') THEN
    ALTER TABLE "Property" ADD COLUMN "ownerDisbursements" TEXT;
  END IF;
END $$;

-- PropertyUnit -> PropertyUnit
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'propertyId') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'unitNumber') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "unitNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'floor') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN floor INTEGER DEFAULT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'area') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN area DOUBLE PRECISION;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'baseRentTTD') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "baseRentTTD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'baseRentUSD') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "baseRentUSD" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'tenantId') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'status') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN status TEXT DEFAULT "vacant";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'amenities') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN amenities TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'notes') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'createdAt') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'leases') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN leases TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'maintenanceRequests') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "maintenanceRequests" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'rentPayments') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "rentPayments" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'documents') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN documents TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'deposits') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN deposits TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'inspections') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN inspections TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyUnit' AND column_name = 'legalNotices') THEN
    ALTER TABLE "PropertyUnit" ADD COLUMN "legalNotices" TEXT;
  END IF;
END $$;

-- Lease -> Lease
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'unitId') THEN
    ALTER TABLE "Lease" ADD COLUMN "unitId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'tenantId') THEN
    ALTER TABLE "Lease" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'startDate') THEN
    ALTER TABLE "Lease" ADD COLUMN "startDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'endDate') THEN
    ALTER TABLE "Lease" ADD COLUMN "endDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'rentAmount') THEN
    ALTER TABLE "Lease" ADD COLUMN "rentAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'rentCurrency') THEN
    ALTER TABLE "Lease" ADD COLUMN "rentCurrency" TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'depositAmount') THEN
    ALTER TABLE "Lease" ADD COLUMN "depositAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'status') THEN
    ALTER TABLE "Lease" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'terms') THEN
    ALTER TABLE "Lease" ADD COLUMN terms TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'notes') THEN
    ALTER TABLE "Lease" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'autoRenew') THEN
    ALTER TABLE "Lease" ADD COLUMN "autoRenew" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'renewalNoticeDays') THEN
    ALTER TABLE "Lease" ADD COLUMN "renewalNoticeDays" INTEGER DEFAULT 30;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'rentIncreasePercent') THEN
    ALTER TABLE "Lease" ADD COLUMN "rentIncreasePercent" DOUBLE PRECISION DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'lastRenewedAt') THEN
    ALTER TABLE "Lease" ADD COLUMN "lastRenewedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'renewalCount') THEN
    ALTER TABLE "Lease" ADD COLUMN "renewalCount" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'originalStartDate') THEN
    ALTER TABLE "Lease" ADD COLUMN "originalStartDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'originalEndDate') THEN
    ALTER TABLE "Lease" ADD COLUMN "originalEndDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'createdAt') THEN
    ALTER TABLE "Lease" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Lease" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'rentPayments') THEN
    ALTER TABLE "Lease" ADD COLUMN "rentPayments" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'documents') THEN
    ALTER TABLE "Lease" ADD COLUMN documents TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'deposits') THEN
    ALTER TABLE "Lease" ADD COLUMN deposits TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'inspections') THEN
    ALTER TABLE "Lease" ADD COLUMN inspections TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'legalNotices') THEN
    ALTER TABLE "Lease" ADD COLUMN "legalNotices" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lease' AND column_name = 'renewalLogs') THEN
    ALTER TABLE "Lease" ADD COLUMN "renewalLogs" TEXT;
  END IF;
END $$;

-- MaintenanceRequest -> MaintenanceRequest
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'propertyId') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'unitId') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN "unitId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'tenantId') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'title') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN title TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'description') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'category') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'priority') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN priority TEXT DEFAULT "medium";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'status') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN status TEXT DEFAULT "open";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'requestedAt') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'resolvedAt') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN "resolvedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'cost') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN cost NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'vendor') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN vendor TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'notes') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'createdAt') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'updatedAt') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MaintenanceRequest' AND column_name = 'vendorId') THEN
    ALTER TABLE "MaintenanceRequest" ADD COLUMN "vendorId" TEXT;
  END IF;
END $$;

-- RentPayment -> RentPayment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'leaseId') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "leaseId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'propertyId') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'unitId') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "unitId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'tenantId') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'periodStart') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "periodStart" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'periodEnd') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "periodEnd" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'amountDue') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "amountDue" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'amountPaid') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "amountPaid" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'lateFee') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "lateFee" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'currency') THEN
    ALTER TABLE "RentPayment" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'paymentMethod') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "paymentMethod" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'paymentRef') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "paymentRef" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'status') THEN
    ALTER TABLE "RentPayment" ADD COLUMN status TEXT DEFAULT "pending";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'paidAt') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "paidAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'dueDate') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "dueDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'notes') THEN
    ALTER TABLE "RentPayment" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'createdAt') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RentPayment' AND column_name = 'updatedAt') THEN
    ALTER TABLE "RentPayment" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- PropertyVendor -> PropertyVendor
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'tenantId') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'propertyId') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'name') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'category') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'contact') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN contact TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'email') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN email TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'phone') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN phone TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'address') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN address TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'rating') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN rating INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'isActive') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'notes') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'createdAt') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyVendor' AND column_name = 'maintenanceRequests') THEN
    ALTER TABLE "PropertyVendor" ADD COLUMN "maintenanceRequests" TEXT;
  END IF;
END $$;

-- PropertyDocument -> PropertyDocument
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'propertyId') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'unitId') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN "unitId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'leaseId') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN "leaseId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'tenantId') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'name') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'type') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN type TEXT DEFAULT "other";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'category') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN category TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'fileUrl') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN "fileUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'description') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'expiresAt') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN "expiresAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'status') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN status TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'createdAt') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PropertyDocument" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- JournalEntry -> JournalEntry
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntry' AND column_name = 'date') THEN
    ALTER TABLE "JournalEntry" ADD COLUMN date TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntry' AND column_name = 'description') THEN
    ALTER TABLE "JournalEntry" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntry' AND column_name = 'reference') THEN
    ALTER TABLE "JournalEntry" ADD COLUMN reference TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntry' AND column_name = 'status') THEN
    ALTER TABLE "JournalEntry" ADD COLUMN status TEXT DEFAULT "posted";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntry' AND column_name = 'createdAt') THEN
    ALTER TABLE "JournalEntry" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntry' AND column_name = 'updatedAt') THEN
    ALTER TABLE "JournalEntry" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntry' AND column_name = 'lines') THEN
    ALTER TABLE "JournalEntry" ADD COLUMN lines TEXT;
  END IF;
END $$;

-- JournalEntryLine -> JournalEntryLine
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntryLine' AND column_name = 'journalEntryId') THEN
    ALTER TABLE "JournalEntryLine" ADD COLUMN "journalEntryId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntryLine' AND column_name = 'accountCode') THEN
    ALTER TABLE "JournalEntryLine" ADD COLUMN "accountCode" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntryLine' AND column_name = 'accountName') THEN
    ALTER TABLE "JournalEntryLine" ADD COLUMN "accountName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntryLine' AND column_name = 'accountType') THEN
    ALTER TABLE "JournalEntryLine" ADD COLUMN "accountType" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntryLine' AND column_name = 'debit') THEN
    ALTER TABLE "JournalEntryLine" ADD COLUMN debit NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntryLine' AND column_name = 'credit') THEN
    ALTER TABLE "JournalEntryLine" ADD COLUMN credit NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JournalEntryLine' AND column_name = 'createdAt') THEN
    ALTER TABLE "JournalEntryLine" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- OwnerDisbursement -> OwnerDisbursement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'tenantId') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'propertyId') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'periodStart') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "periodStart" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'periodEnd') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "periodEnd" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'grossIncome') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "grossIncome" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'totalExpenses') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "totalExpenses" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'netIncome') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "netIncome" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'ownerShare') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "ownerShare" DOUBLE PRECISION DEFAULT 100;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'disbursementAmount') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "disbursementAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'currency') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'status') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN status TEXT DEFAULT "pending";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'paidAt') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "paidAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'notes') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'createdAt') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OwnerDisbursement' AND column_name = 'updatedAt') THEN
    ALTER TABLE "OwnerDisbursement" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- LeaseRenewalLog -> LeaseRenewalLog
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'tenantId') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'leaseId') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "leaseId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'previousEnd') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "previousEnd" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'newStart') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "newStart" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'newEnd') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "newEnd" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'oldRent') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "oldRent" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'newRent') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "newRent" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'increasePct') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "increasePct" DOUBLE PRECISION DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'renewedBy') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "renewedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'notes') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LeaseRenewalLog' AND column_name = 'createdAt') THEN
    ALTER TABLE "LeaseRenewalLog" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- SecurityDeposit -> SecurityDeposit
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'leaseId') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "leaseId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'propertyId') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'unitId') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "unitId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'tenantId') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'amount') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN amount NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'currency') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN currency TEXT DEFAULT "TTD";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'status') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN status TEXT DEFAULT "held";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'receivedDate') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "receivedDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'returnDeadline') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "returnDeadline" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'returnedAmount') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "returnedAmount" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'returnedDate') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "returnedDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'deductions') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN deductions TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'deductionTotal') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "deductionTotal" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'refundMethod') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "refundMethod" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'refundReference') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "refundReference" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'notes') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'createdAt') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SecurityDeposit' AND column_name = 'updatedAt') THEN
    ALTER TABLE "SecurityDeposit" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- PropertyInspection -> PropertyInspection
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'propertyId') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'unitId') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "unitId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'leaseId') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "leaseId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'tenantId') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'type') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN type TEXT DEFAULT "move_in";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'inspectorName') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "inspectorName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'inspectorRole') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "inspectorRole" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'inspectedAt') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "inspectedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'overallCondition') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "overallCondition" TEXT DEFAULT "good";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'checklist') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN checklist TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'notes') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'scoreTotal') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "scoreTotal" INTEGER DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'scoreMax') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "scoreMax" INTEGER DEFAULT 100;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'signedByTenant') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "signedByTenant" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'signedByLandlord') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "signedByLandlord" BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'createdAt') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PropertyInspection' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PropertyInspection" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- LegalNotice -> LegalNotice
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'leaseId') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "leaseId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'propertyId') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "propertyId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'unitId') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "unitId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'tenantId') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'type') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN type TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'jurisdiction') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN jurisdiction TEXT DEFAULT "TT";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'templateSlug') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "templateSlug" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'title') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN title TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'content') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN content TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'sentDate') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "sentDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'sentMethod') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "sentMethod" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'responseDate') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "responseDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'responseNotes') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "responseNotes" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'status') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN status TEXT DEFAULT "draft";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'effectiveDate') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "effectiveDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'expiresAt') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "expiresAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'createdAt') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LegalNotice' AND column_name = 'updatedAt') THEN
    ALTER TABLE "LegalNotice" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- VATReturn -> VATReturn
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'tenantId') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'periodStart') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "periodStart" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'periodEnd') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "periodEnd" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'quarter') THEN
    ALTER TABLE "VATReturn" ADD COLUMN quarter TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'year') THEN
    ALTER TABLE "VATReturn" ADD COLUMN year INTEGER;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'totalSalesExVAT') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "totalSalesExVAT" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'totalVATCollected') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "totalVATCollected" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'totalVATPaid') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "totalVATPaid" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'vatDue') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "vatDue" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'vatRefund') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "vatRefund" NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'birNumber') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "birNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'tin') THEN
    ALTER TABLE "VATReturn" ADD COLUMN tin TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'vatRegNumber') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "vatRegNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'status') THEN
    ALTER TABLE "VATReturn" ADD COLUMN status TEXT DEFAULT "draft";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'filedDate') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "filedDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'filedBy') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "filedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'receiptNumber') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "receiptNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'notes') THEN
    ALTER TABLE "VATReturn" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'createdAt') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VATReturn' AND column_name = 'updatedAt') THEN
    ALTER TABLE "VATReturn" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- HACCPPlan -> HACCPPlan
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'tenantId') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'name') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN name TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'description') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN description TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'productCategory') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "productCategory" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'status') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN status TEXT DEFAULT "draft";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'approvedBy') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "approvedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'approvedAt') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "approvedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'criticalLimits') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "criticalLimits" TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'lastReviewDate') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "lastReviewDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'nextReviewDate') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "nextReviewDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'notes') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'createdAt') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'updatedAt') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPPlan' AND column_name = 'logs') THEN
    ALTER TABLE "HACCPPlan" ADD COLUMN logs TEXT;
  END IF;
END $$;

-- HACCPRiskLog -> HACCPRiskLog
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'planId') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "planId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'tenantId') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'ccpName') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "ccpName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'hazardType') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "hazardType" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'monitoringValue') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "monitoringValue" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'criticalLimit') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "criticalLimit" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'isWithinLimit') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "isWithinLimit" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'correctiveAction') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "correctiveAction" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'loggedBy') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "loggedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'loggedAt') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "loggedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'verifiedBy') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "verifiedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'verifiedAt') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "verifiedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'notes') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'createdAt') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HACCPRiskLog' AND column_name = 'updatedAt') THEN
    ALTER TABLE "HACCPRiskLog" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- AllergenDeclaration -> AllergenDeclaration
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'tenantId') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'recipeId') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN "recipeId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'ingredientId') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN "ingredientId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'productName') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN "productName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'allergens') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN allergens TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'lastReviewAt') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN "lastReviewAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'reviewedBy') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN "reviewedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'notes') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'createdAt') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AllergenDeclaration' AND column_name = 'updatedAt') THEN
    ALTER TABLE "AllergenDeclaration" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- FoodHandlerRegistration -> FoodHandlerRegistration
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'tenantId') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'employeeName') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "employeeName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'employeeRole') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "employeeRole" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'registrationNumber') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "registrationNumber" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'registeredDate') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "registeredDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'expiryDate') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "expiryDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'healthStatus') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "healthStatus" TEXT DEFAULT "active";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'trainingDate') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "trainingDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'certificateUrl') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "certificateUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'publicHealthDept') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "publicHealthDept" TEXT DEFAULT "County Medical Officer of Health";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'notes') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'createdAt') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FoodHandlerRegistration' AND column_name = 'updatedAt') THEN
    ALTER TABLE "FoodHandlerRegistration" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- HealthInspection -> HealthInspection
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'tenantId') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'inspectionDate') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "inspectionDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'inspectorName') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "inspectorName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'inspectorAgency') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "inspectorAgency" TEXT DEFAULT "Public Health Department";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'type') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN type TEXT DEFAULT "routine";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'overallScore') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "overallScore" INTEGER;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'scoreMax') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "scoreMax" INTEGER DEFAULT 100;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'result') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN result TEXT DEFAULT "pass";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'violations') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN violations TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'correctiveActions') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "correctiveActions" TEXT DEFAULT "[]";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'nextInspectionDate') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "nextInspectionDate" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'certificateUrl') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "certificateUrl" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'notes') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'createdAt') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HealthInspection' AND column_name = 'updatedAt') THEN
    ALTER TABLE "HealthInspection" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- TemperatureLog -> TemperatureLog
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'tenantId') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'equipmentName') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "equipmentName" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'equipmentType') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "equipmentType" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'location') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN location TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'temperature') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN temperature DOUBLE PRECISION;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'unit') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN unit TEXT DEFAULT "C";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'isWithinRange') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "isWithinRange" BOOLEAN DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'minSafe') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "minSafe" DOUBLE PRECISION;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'maxSafe') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "maxSafe" DOUBLE PRECISION;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'loggedBy') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "loggedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'loggedAt') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "loggedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'correctiveNote') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "correctiveNote" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'createdAt') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'TemperatureLog' AND column_name = 'updatedAt') THEN
    ALTER TABLE "TemperatureLog" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- CleaningSanitationLog -> CleaningSanitationLog
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'tenantId') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'area') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN area TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'task') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN task TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'cleaningProduct') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN "cleaningProduct" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'frequency') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN frequency TEXT DEFAULT "daily";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'completedBy') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN "completedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'completedAt') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN "completedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'verifiedBy') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN "verifiedBy" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'verifiedAt') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN "verifiedAt" TIMESTAMP(3);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'status') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN status TEXT DEFAULT "completed";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'notes') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN notes TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'createdAt') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CleaningSanitationLog' AND column_name = 'updatedAt') THEN
    ALTER TABLE "CleaningSanitationLog" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;


-- ============================================================================
-- SECTION 3: ADD FOREIGN KEY CONSTRAINTS
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
-- SECTION 4: CREATE INDEXES (idempotent via IF NOT EXISTS)
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


-- DONE — All 70 tables, columns, FKs, and indexes applied.

