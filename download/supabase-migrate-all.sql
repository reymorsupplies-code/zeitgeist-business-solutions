-- Auto-generated PostgreSQL migration from Prisma schema
-- Idempotent: safe to run multiple times
-- Total models: 70

-- ============================================
-- Section 1: CREATE TABLE IF NOT EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'starter',
    "priceUSD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "priceTTD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "tagline" TEXT,
    "description" TEXT,
    "idealFor" TEXT,
    "maxUsers" INTEGER NOT NULL DEFAULT 3,
    "maxBranches" INTEGER NOT NULL DEFAULT 1,
    "features" TEXT NOT NULL DEFAULT '[]',
    "excludedFeatures" TEXT NOT NULL DEFAULT '[]',
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Industry" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PlatformUser" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'tenant_admin',
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3),
    "country" TEXT,
    "timezone" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "JournalEntryLine" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "journalEntryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PriceSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "planId" TEXT,
    "key" TEXT NOT NULL,
    "valueUSD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valueTTD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "industryId" TEXT,
    "planId" TEXT,
    "planName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'trial',
    "trialStartsAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialDurationDays" INTEGER NOT NULL DEFAULT 7,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paymentVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3),
    "registrationIp" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1D4ED8',
    "accentColor" TEXT NOT NULL DEFAULT '#2563EB',
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "timezone" TEXT NOT NULL DEFAULT 'America/Port_of_Spain',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.125,
    "country" TEXT NOT NULL DEFAULT 'TT',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TenantFeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "featureSlug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Venue" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "pricePerHour" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "HealthInspection" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectorName" TEXT,
    "inspectorAgency" TEXT NOT NULL DEFAULT 'Public Health Department',
    "type" TEXT NOT NULL DEFAULT 'routine',
    "overallScore" INTEGER,
    "scoreMax" INTEGER NOT NULL DEFAULT 100,
    "result" TEXT NOT NULL DEFAULT 'pass',
    "violations" TEXT NOT NULL DEFAULT '[]',
    "correctiveActions" TEXT NOT NULL DEFAULT '[]',
    "nextInspectionDate" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT,
    "costPerUnit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "policyNumber" TEXT,
    "clientName" TEXT,
    "type" TEXT,
    "premium" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "coverage" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "beneficiaries" TEXT NOT NULL DEFAULT '[]',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "date" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "vendor" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "VATReturn" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "quarter" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalSalesExVAT" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalVATCollected" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalVATPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatRefund" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "birNumber" TEXT,
    "tin" TEXT,
    "vatRegNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "filedDate" TIMESTAMP(3),
    "filedBy" TEXT,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "userId" TEXT,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Property" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'TT',
    "type" TEXT NOT NULL DEFAULT 'commercial',
    "totalArea" DOUBLE PRECISION,
    "units" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Event" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "clientName" TEXT,
    "venue" TEXT,
    "eventDate" TIMESTAMP(3),
    "setupDate" TIMESTAMP(3),
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "budget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "clientName" TEXT,
    "clientEmail" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "category" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "FoodHandlerRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeRole" TEXT,
    "registrationNumber" TEXT,
    "registeredDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "healthStatus" TEXT NOT NULL DEFAULT 'active',
    "trainingDate" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "publicHealthDept" TEXT NOT NULL DEFAULT 'County Medical Officer of Health',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "servings" INTEGER,
    "prepTime" INTEGER,
    "cookTime" INTEGER,
    "ingredients" TEXT NOT NULL DEFAULT '[]',
    "instructions" TEXT NOT NULL DEFAULT '[]',
    "costPerServing" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "DesignItem" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TenantMembership" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Layaway" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "layawayNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceRemaining" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payments" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "dueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "depositPercentage" DECIMAL(12,2) NOT NULL DEFAULT 20,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "bloodType" TEXT,
    "allergies" TEXT NOT NULL DEFAULT '[]',
    "medicalNotes" TEXT,
    "insuranceProvider" TEXT,
    "insuranceNumber" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "clientName" TEXT,
    "type" TEXT,
    "value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PlatformInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT,
    "invoiceNumber" TEXT,
    "amountUSD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountTTD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TenantSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT,
    "planName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "priceUSD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "priceTTD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "paymentBehavior" TEXT NOT NULL DEFAULT 'always_on_time',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "RetailProduct" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "barcode" TEXT,
    "imageUrl" TEXT,
    "taxCategory" TEXT NOT NULL DEFAULT 'standard',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "orderNumber" TEXT,
    "clientName" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "orderType" TEXT NOT NULL DEFAULT 'custom',
    "deliveryDate" TIMESTAMP(3),
    "deliveryAddress" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "HACCPPlan" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productCategory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "criticalLimits" TEXT NOT NULL DEFAULT '[]',
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "BookkeepingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "type" TEXT NOT NULL DEFAULT 'debit',
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "reference" TEXT,
    "accountId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "RegisterShift" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "shiftNumber" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "staffId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "closedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "startingCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closingCash" DECIMAL(12,2),
    "expectedCash" DECIMAL(12,2),
    "cashSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cardSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transferSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalRefunds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "giftCardSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "layawayDeposits" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "refundCount" INTEGER NOT NULL DEFAULT 0,
    "discrepancy" DECIMAL(12,2),
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "quoteNumber" TEXT,
    "clientName" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "GiftCard" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "cardCode" TEXT NOT NULL,
    "initialBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customerName" TEXT,
    "purchaserName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "transactions" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SystemEvent" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "tenantId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CleaningSanitationLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "cleaningProduct" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TemperatureLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "location" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'C',
    "isWithinRange" BOOLEAN NOT NULL DEFAULT true,
    "minSafe" DOUBLE PRECISION,
    "maxSafe" DOUBLE PRECISION,
    "loggedBy" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "correctiveNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TenantDocument" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "content" TEXT,
    "fileUrl" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SalonServiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Stylist" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "budget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "spent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "LegalCase" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "caseNumber" TEXT,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "caseType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "court" TEXT,
    "judge" TEXT,
    "openDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "description" TEXT,
    "billingRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "hoursBilled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "newStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "reference" TEXT,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT,
    "claimNumber" TEXT,
    "claimantName" TEXT,
    "type" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "incidentDate" TIMESTAMP(3),
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PropertyVendor" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT,
    "propertyId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "OwnerDisbursement" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT,
    "propertyId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossIncome" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalExpenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netIncome" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ownerShare" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "disbursementAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PropertyUnit" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "propertyId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "area" DOUBLE PRECISION,
    "baseRentTTD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "baseRentUSD" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'vacant',
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "method" TEXT NOT NULL DEFAULT 'cash',
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "items" TEXT NOT NULL DEFAULT '[]',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "expectedDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AllergenDeclaration" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "recipeId" TEXT,
    "ingredientId" TEXT,
    "productName" TEXT NOT NULL,
    "allergens" TEXT NOT NULL DEFAULT '[]',
    "lastReviewAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "reviewedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "MedicalAppointment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT,
    "doctorName" TEXT,
    "specialty" TEXT,
    "date" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "diagnosis" TEXT,
    "prescription" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "HACCPRiskLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "planId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ccpName" TEXT NOT NULL,
    "hazardType" TEXT,
    "monitoringValue" TEXT,
    "criticalLimit" TEXT,
    "isWithinLimit" BOOLEAN NOT NULL DEFAULT true,
    "correctiveAction" TEXT,
    "loggedBy" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "LoyaltyMember" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL DEFAULT '',
    "points" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "lastVisit" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "POSSale" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "items" TEXT NOT NULL DEFAULT '[]',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.125,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "giftCardId" TEXT,
    "splitDetails" TEXT DEFAULT '',
    "cashReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "customerName" TEXT NOT NULL DEFAULT '',
    "staffName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "clientName" TEXT,
    "stylistId" TEXT,
    "serviceId" TEXT,
    "date" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "description" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "billingRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "date" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Lease" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "rentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rentCurrency" TEXT NOT NULL DEFAULT 'TTD',
    "depositAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "terms" TEXT,
    "notes" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewalNoticeDays" INTEGER NOT NULL DEFAULT 30,
    "rentIncreasePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastRenewedAt" TIMESTAMP(3),
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "originalStartDate" TIMESTAMP(3),
    "originalEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "MaintenanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "resolvedAt" TIMESTAMP(3),
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendor" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "vendorId" TEXT
);

CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "memberId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ProductReturn" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "items" TEXT NOT NULL DEFAULT '[]',
    "totalRefund" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundMethod" TEXT NOT NULL DEFAULT 'cash',
    "reason" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedBy" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SecurityDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "leaseId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "status" TEXT NOT NULL DEFAULT 'held',
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "returnDeadline" TIMESTAMP(3) NOT NULL,
    "returnedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "returnedDate" TIMESTAMP(3),
    "deductions" TEXT NOT NULL DEFAULT '[]',
    "deductionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundMethod" TEXT,
    "refundReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "RentPayment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "leaseId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lateFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "LeaseRenewalLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT,
    "leaseId" TEXT NOT NULL,
    "previousEnd" TIMESTAMP(3) NOT NULL,
    "newStart" TIMESTAMP(3) NOT NULL,
    "newEnd" TIMESTAMP(3) NOT NULL,
    "oldRent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "newRent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "increasePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "renewedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "LegalNotice" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "leaseId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'TT',
    "templateSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3),
    "sentMethod" TEXT,
    "responseDate" TIMESTAMP(3),
    "responseNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "effectiveDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PropertyInspection" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "leaseId" TEXT,
    "tenantId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'move_in',
    "inspectorName" TEXT,
    "inspectorRole" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "overallCondition" TEXT NOT NULL DEFAULT 'good',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "scoreTotal" INTEGER NOT NULL DEFAULT 0,
    "scoreMax" INTEGER NOT NULL DEFAULT 100,
    "signedByTenant" BOOLEAN NOT NULL DEFAULT false,
    "signedByLandlord" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PropertyDocument" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "propertyId" TEXT,
    "unitId" TEXT,
    "leaseId" TEXT,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "category" TEXT,
    "fileUrl" TEXT,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- ============================================
-- Section 2: ALTER TABLE ADD COLUMN IF NOT EXISTS
-- ============================================

ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3) NOT NULL;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'posted';
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "priceUSD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "priceTTD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "billingCycle" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "tagline" TEXT;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "idealFor" TEXT;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxBranches" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "features" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "excludedFeatures" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "isPopular" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL;
ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Industry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "password" TEXT NOT NULL;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'tenant_admin';
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP(3);
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "journalEntryId" TEXT NOT NULL;
ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "accountCode" TEXT NOT NULL;
ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "accountName" TEXT NOT NULL;
ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "accountType" TEXT NOT NULL;
ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "debit" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "credit" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "key" TEXT NOT NULL;
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "valueUSD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "valueTTD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "industryId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "planName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialStartsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialDurationDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "registrationIp" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT NOT NULL DEFAULT '#1D4ED8';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "accentColor" TEXT NOT NULL DEFAULT '#2563EB';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Port_of_Spain';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.125;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'TT';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "settings" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "TenantFeatureFlag" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "TenantFeatureFlag" ADD COLUMN IF NOT EXISTS "featureSlug" TEXT NOT NULL;
ALTER TABLE "TenantFeatureFlag" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantFeatureFlag" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "TenantFeatureFlag" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "contact" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "amenities" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "pricePerHour" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "contact" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "inspectionDate" TIMESTAMP(3) NOT NULL;
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "inspectorName" TEXT;
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "inspectorAgency" TEXT NOT NULL DEFAULT 'Public Health Department';
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'routine';
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "overallScore" INTEGER;
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "scoreMax" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "result" TEXT NOT NULL DEFAULT 'pass';
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "violations" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "correctiveActions" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "nextInspectionDate" TIMESTAMP(3);
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "certificateUrl" TEXT;
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "HealthInspection" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "costPerUnit" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "supplier" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "policyNumber" TEXT;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "premium" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "coverage" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "beneficiaries" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Policy" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "vendor" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3) NOT NULL;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3) NOT NULL;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "quarter" TEXT NOT NULL;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "year" INTEGER NOT NULL;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "totalSalesExVAT" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "totalVATCollected" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "totalVATPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "vatDue" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "vatRefund" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "birNumber" TEXT;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "tin" TEXT;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "vatRegNumber" TEXT;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "filedDate" TIMESTAMP(3);
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "filedBy" TEXT;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "VATReturn" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "details" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'info';
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'TT';
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'commercial';
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "totalArea" DOUBLE PRECISION;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "units" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "venue" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "eventDate" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "setupDate" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "guestCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'planning';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "clientEmail" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "items" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "balanceDue" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "contact" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "employeeName" TEXT NOT NULL;
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "employeeRole" TEXT;
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "registeredDate" TIMESTAMP(3);
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3) NOT NULL;
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "healthStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "trainingDate" TIMESTAMP(3);
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "certificateUrl" TEXT;
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "publicHealthDept" TEXT NOT NULL DEFAULT 'County Medical Officer of Health';
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "FoodHandlerRegistration" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "servings" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "prepTime" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "cookTime" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "ingredients" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "instructions" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "costPerServing" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "sellingPrice" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "DesignItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL;
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "layawayNumber" TEXT NOT NULL;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "customerName" TEXT NOT NULL;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT NOT NULL;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "items" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "balanceRemaining" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "payments" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3) NOT NULL;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "depositPercentage" DECIMAL(12,2) NOT NULL DEFAULT 20;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Layaway" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "lastName" TEXT NOT NULL;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "bloodType" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "allergies" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "medicalNotes" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "insuranceProvider" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "insuranceNumber" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "value" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "amountUSD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "amountTTD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP(3);
ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "planName" TEXT;
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "billingCycle" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "priceUSD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "priceTTD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "paymentBehavior" TEXT NOT NULL DEFAULT 'always_on_time';
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "price" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "cost" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "minStock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "supplier" TEXT;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "taxCategory" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "settings" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "RetailProduct" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "items" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderType" TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryDate" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "productCategory" TEXT;
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "criticalLimits" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "lastReviewDate" TIMESTAMP(3);
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3);
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "HACCPPlan" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "price" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "cost" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3) NOT NULL;
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'debit';
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "BookkeepingEntry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "shiftNumber" TEXT NOT NULL;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "staffName" TEXT NOT NULL;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "startingCash" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "closingCash" DECIMAL(12,2);
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "expectedCash" DECIMAL(12,2);
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "cashSales" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "cardSales" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "transferSales" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "totalSales" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "totalRefunds" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "giftCardSales" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "layawayDeposits" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "transactionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "refundCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "discrepancy" DECIMAL(12,2);
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "RegisterShift" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "quoteNumber" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "clientEmail" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "clientPhone" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "items" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP(3);
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "cardNumber" TEXT NOT NULL;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "cardCode" TEXT NOT NULL;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "initialBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "purchaserName" TEXT NOT NULL;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "transactions" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL;
ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'info';
ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "metadata" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "area" TEXT NOT NULL;
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "task" TEXT NOT NULL;
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "cleaningProduct" TEXT;
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "frequency" TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "completedBy" TEXT;
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "CleaningSanitationLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "equipmentName" TEXT NOT NULL;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "equipmentType" TEXT NOT NULL;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "temperature" DOUBLE PRECISION NOT NULL;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'C';
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "isWithinRange" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "minSafe" DOUBLE PRECISION;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "maxSafe" DOUBLE PRECISION;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "loggedBy" TEXT;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "correctiveNote" TEXT;
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "TemperatureLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "price" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "SalonServiceItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "spent" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "caseNumber" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "caseType" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "court" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "judge" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "openDate" TIMESTAMP(3);
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "closeDate" TIMESTAMP(3);
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "billingRate" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "hoursBilled" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "ingredientId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "previousStock" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "newStock" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "batchNumber" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "method" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "policyId" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "claimNumber" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "claimantName" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "incidentDate" TIMESTAMP(3);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "contact" TEXT;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PropertyVendor" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3) NOT NULL;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3) NOT NULL;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "grossIncome" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "totalExpenses" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "netIncome" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "ownerShare" DOUBLE PRECISION NOT NULL DEFAULT 100;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "disbursementAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "OwnerDisbursement" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "propertyId" TEXT NOT NULL;
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "unitNumber" TEXT NOT NULL;
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "floor" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "area" DOUBLE PRECISION;
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "baseRentTTD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "baseRentUSD" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'vacant';
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "amenities" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "method" TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "poNumber" TEXT NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "supplierName" TEXT NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "items" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "receivedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "expectedDate" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "recipeId" TEXT;
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "ingredientId" TEXT;
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "productName" TEXT NOT NULL;
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "allergens" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "lastReviewAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "AllergenDeclaration" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "patientId" TEXT;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "doctorName" TEXT;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3);
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "diagnosis" TEXT;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "prescription" TEXT;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "MedicalAppointment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "planId" TEXT NOT NULL;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "ccpName" TEXT NOT NULL;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "hazardType" TEXT;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "monitoringValue" TEXT;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "criticalLimit" TEXT;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "isWithinLimit" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "correctiveAction" TEXT;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "loggedBy" TEXT;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "HACCPRiskLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "clientName" TEXT NOT NULL;
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "clientPhone" TEXT NOT NULL;
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "clientEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "totalOrders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'bronze';
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "joinDate" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "lastVisit" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "saleNumber" TEXT NOT NULL;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "items" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "discountPct" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.125;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "giftCardId" TEXT;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "splitDetails" TEXT DEFAULT '';
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "cashReceived" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "customerName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "staffName" TEXT;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "POSSale" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "stylistId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "caseId" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "billingRate" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "billable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3);
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3) NOT NULL;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3) NOT NULL;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "rentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "rentCurrency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "terms" TEXT;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "renewalNoticeDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "rentIncreasePercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "lastRenewedAt" TIMESTAMP(3);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "renewalCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "originalStartDate" TIMESTAMP(3);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "originalEndDate" TIMESTAMP(3);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "propertyId" TEXT NOT NULL;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "cost" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "vendor" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "memberId" TEXT NOT NULL;
ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL;
ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL;
ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "saleId" TEXT NOT NULL;
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "returnNumber" TEXT NOT NULL;
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "items" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "totalRefund" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "refundMethod" TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "reason" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "processedBy" TEXT;
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "ProductReturn" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "leaseId" TEXT NOT NULL;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "propertyId" TEXT NOT NULL;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'held';
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "returnDeadline" TIMESTAMP(3) NOT NULL;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "returnedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "returnedDate" TIMESTAMP(3);
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "deductions" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "deductionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "refundMethod" TEXT;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "refundReference" TEXT;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "SecurityDeposit" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "leaseId" TEXT NOT NULL;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "propertyId" TEXT NOT NULL;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3) NOT NULL;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3) NOT NULL;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "amountDue" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "lateFee" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TTD';
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "paymentRef" TEXT;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3) NOT NULL;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "RentPayment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "leaseId" TEXT NOT NULL;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "previousEnd" TIMESTAMP(3) NOT NULL;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "newStart" TIMESTAMP(3) NOT NULL;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "newEnd" TIMESTAMP(3) NOT NULL;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "oldRent" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "newRent" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "increasePct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "renewedBy" TEXT;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "LeaseRenewalLog" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "leaseId" TEXT NOT NULL;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "propertyId" TEXT NOT NULL;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT NOT NULL DEFAULT 'TT';
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "templateSlug" TEXT NOT NULL;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "content" TEXT NOT NULL;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "sentDate" TIMESTAMP(3);
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "sentMethod" TEXT;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "responseDate" TIMESTAMP(3);
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "responseNotes" TEXT;
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "LegalNotice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "propertyId" TEXT NOT NULL;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "leaseId" TEXT;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'move_in';
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "inspectorName" TEXT;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "inspectorRole" TEXT;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "overallCondition" TEXT NOT NULL DEFAULT 'good';
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "checklist" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "scoreTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "scoreMax" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "signedByTenant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "signedByLandlord" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PropertyInspection" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "leaseId" TEXT;
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "PropertyDocument" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- ============================================
-- Section 3: Foreign Key Constraints
-- ============================================

DO $$ BEGIN
    ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PriceSetting" ADD CONSTRAINT "PriceSetting_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantFeatureFlag" ADD CONSTRAINT "TenantFeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Venue" ADD CONSTRAINT "Venue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "HealthInspection" ADD CONSTRAINT "HealthInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Policy" ADD CONSTRAINT "Policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "VATReturn" ADD CONSTRAINT "VATReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "FoodHandlerRegistration" ADD CONSTRAINT "FoodHandlerRegistration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DesignItem" ADD CONSTRAINT "DesignItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Layaway" ADD CONSTRAINT "Layaway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RetailProduct" ADD CONSTRAINT "RetailProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "HACCPPlan" ADD CONSTRAINT "HACCPPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "BookkeepingEntry" ADD CONSTRAINT "BookkeepingEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SystemEvent" ADD CONSTRAINT "SystemEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CleaningSanitationLog" ADD CONSTRAINT "CleaningSanitationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SalonServiceItem" ADD CONSTRAINT "SalonServiceItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Stylist" ADD CONSTRAINT "Stylist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Claim" ADD CONSTRAINT "Claim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyVendor" ADD CONSTRAINT "PropertyVendor_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyVendor" ADD CONSTRAINT "PropertyVendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "OwnerDisbursement" ADD CONSTRAINT "OwnerDisbursement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "OwnerDisbursement" ADD CONSTRAINT "OwnerDisbursement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AllergenDeclaration" ADD CONSTRAINT "AllergenDeclaration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AllergenDeclaration" ADD CONSTRAINT "AllergenDeclaration_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AllergenDeclaration" ADD CONSTRAINT "AllergenDeclaration_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MedicalAppointment" ADD CONSTRAINT "MedicalAppointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MedicalAppointment" ADD CONSTRAINT "MedicalAppointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "HACCPRiskLog" ADD CONSTRAINT "HACCPRiskLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "HACCPPlan" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "HACCPRiskLog" ADD CONSTRAINT "HACCPRiskLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LoyaltyMember" ADD CONSTRAINT "LoyaltyMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LoyaltyMember" ADD CONSTRAINT "LoyaltyMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "POSSale" ADD CONSTRAINT "POSSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "POSSale" ADD CONSTRAINT "POSSale_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_stylistId_fkey" FOREIGN KEY ("stylistId") REFERENCES "Stylist" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SalonServiceItem" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "PropertyVendor" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LoyaltyMember" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProductReturn" ADD CONSTRAINT "ProductReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProductReturn" ADD CONSTRAINT "ProductReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "POSSale" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LeaseRenewalLog" ADD CONSTRAINT "LeaseRenewalLog_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LeaseRenewalLog" ADD CONSTRAINT "LeaseRenewalLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Section 4: UNIQUE Indexes (@@unique and @unique)
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "Plan_slug_key" ON "Plan" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "Industry_slug_key" ON "Industry" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformUser_email_key" ON "PlatformUser" ("email");

CREATE UNIQUE INDEX IF NOT EXISTS "PriceSetting_key_key" ON "PriceSetting" ("key");

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "TenantFeatureFlag_tenantId_featureSlug_key" ON "TenantFeatureFlag" ("tenantId", "featureSlug");

CREATE UNIQUE INDEX IF NOT EXISTS "TenantMembership_userId_tenantId_key" ON "TenantMembership" ("userId", "tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "Layaway_tenantId_layawayNumber_key" ON "Layaway" ("tenantId", "layawayNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "RegisterShift_tenantId_shiftNumber_key" ON "RegisterShift" ("tenantId", "shiftNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "GiftCard_tenantId_cardNumber_key" ON "GiftCard" ("tenantId", "cardNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "GiftCard_tenantId_cardCode_key" ON "GiftCard" ("tenantId", "cardCode");

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyUnit_propertyId_unitNumber_key" ON "PropertyUnit" ("propertyId", "unitNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_poNumber_key" ON "PurchaseOrder" ("tenantId", "poNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyMember_tenantId_clientPhone_key" ON "LoyaltyMember" ("tenantId", "clientPhone");

CREATE UNIQUE INDEX IF NOT EXISTS "POSSale_tenantId_saleNumber_key" ON "POSSale" ("tenantId", "saleNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductReturn_tenantId_returnNumber_key" ON "ProductReturn" ("tenantId", "returnNumber");

-- ============================================
-- Section 5: Indexes (@@index)
-- ============================================

CREATE INDEX IF NOT EXISTS "Venue_tenantId_idx" ON "Venue" ("tenantId");

CREATE INDEX IF NOT EXISTS "Vendor_tenantId_idx" ON "Vendor" ("tenantId");

CREATE INDEX IF NOT EXISTS "Ingredient_tenantId_idx" ON "Ingredient" ("tenantId");

CREATE INDEX IF NOT EXISTS "Policy_tenantId_idx" ON "Policy" ("tenantId");

CREATE INDEX IF NOT EXISTS "Expense_tenantId_idx" ON "Expense" ("tenantId");

CREATE INDEX IF NOT EXISTS "Property_tenantId_idx" ON "Property" ("tenantId");

CREATE INDEX IF NOT EXISTS "Event_tenantId_idx" ON "Event" ("tenantId");

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_idx" ON "Invoice" ("tenantId");

CREATE INDEX IF NOT EXISTS "Recipe_tenantId_idx" ON "Recipe" ("tenantId");

CREATE INDEX IF NOT EXISTS "DesignItem_tenantId_idx" ON "DesignItem" ("tenantId");

CREATE INDEX IF NOT EXISTS "Patient_tenantId_idx" ON "Patient" ("tenantId");

CREATE INDEX IF NOT EXISTS "Contract_tenantId_idx" ON "Contract" ("tenantId");

CREATE INDEX IF NOT EXISTS "RetailProduct_tenantId_isDeleted_idx" ON "RetailProduct" ("tenantId", "isDeleted");
CREATE INDEX IF NOT EXISTS "RetailProduct_tenantId_barcode_idx" ON "RetailProduct" ("tenantId", "barcode");

CREATE INDEX IF NOT EXISTS "Order_tenantId_status_idx" ON "Order" ("tenantId", "status");

CREATE INDEX IF NOT EXISTS "CatalogItem_tenantId_idx" ON "CatalogItem" ("tenantId");

CREATE INDEX IF NOT EXISTS "BookkeepingEntry_tenantId_idx" ON "BookkeepingEntry" ("tenantId");

CREATE INDEX IF NOT EXISTS "RegisterShift_tenantId_status_idx" ON "RegisterShift" ("tenantId", "status");

CREATE INDEX IF NOT EXISTS "Client_tenantId_idx" ON "Client" ("tenantId");

CREATE INDEX IF NOT EXISTS "Quotation_tenantId_idx" ON "Quotation" ("tenantId");

CREATE INDEX IF NOT EXISTS "TenantDocument_tenantId_idx" ON "TenantDocument" ("tenantId");

CREATE INDEX IF NOT EXISTS "SalonServiceItem_tenantId_idx" ON "SalonServiceItem" ("tenantId");

CREATE INDEX IF NOT EXISTS "Stylist_tenantId_idx" ON "Stylist" ("tenantId");

CREATE INDEX IF NOT EXISTS "Project_tenantId_idx" ON "Project" ("tenantId");

CREATE INDEX IF NOT EXISTS "LegalCase_tenantId_idx" ON "LegalCase" ("tenantId");

CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_type_idx" ON "StockMovement" ("tenantId", "type");

CREATE INDEX IF NOT EXISTS "Claim_tenantId_idx" ON "Claim" ("tenantId");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_idx" ON "Payment" ("tenantId");

CREATE INDEX IF NOT EXISTS "MedicalAppointment_tenantId_idx" ON "MedicalAppointment" ("tenantId");

CREATE INDEX IF NOT EXISTS "POSSale_tenantId_createdAt_idx" ON "POSSale" ("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "POSSale_tenantId_status_idx" ON "POSSale" ("tenantId", "status");

CREATE INDEX IF NOT EXISTS "Appointment_tenantId_idx" ON "Appointment" ("tenantId");

CREATE INDEX IF NOT EXISTS "TimeEntry_tenantId_idx" ON "TimeEntry" ("tenantId");

CREATE INDEX IF NOT EXISTS "Lease_tenantId_status_idx" ON "Lease" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Lease_unitId_status_idx" ON "Lease" ("unitId", "status");

CREATE INDEX IF NOT EXISTS "MaintenanceRequest_tenantId_status_idx" ON "MaintenanceRequest" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_tenantId_propertyId_idx" ON "MaintenanceRequest" ("tenantId", "propertyId");

CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_tenantId_idx" ON "LoyaltyTransaction" ("tenantId");

CREATE INDEX IF NOT EXISTS "RentPayment_tenantId_status_dueDate_idx" ON "RentPayment" ("tenantId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "RentPayment_tenantId_leaseId_idx" ON "RentPayment" ("tenantId", "leaseId");

CREATE INDEX IF NOT EXISTS "LeaseRenewalLog_leaseId_idx" ON "LeaseRenewalLog" ("leaseId");
