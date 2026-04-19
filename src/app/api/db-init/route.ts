import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import bcrypt from 'bcryptjs';

/**
 * Database initialization endpoint.
 * Uses pg directly to create all tables from Prisma schema.
 * Protected by rate limiting and init-key verification.
 */

// Rate limiting: max 3 init calls per 10 minutes
const initCalls: { count: number; resetAt: number }[] = [];
const MAX_INIT_CALLS = 3;
const INIT_WINDOW_MS = 10 * 60 * 1000;

function checkInitRateLimit(): boolean {
  const now = Date.now();
  const window = initCalls.find(c => now < c.resetAt);
  if (!window || window.count < MAX_INIT_CALLS) {
    if (!window) initCalls.push({ count: 1, resetAt: now + INIT_WINDOW_MS });
    else window.count++;
    return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  // Rate limit check
  if (!checkInitRateLimit()) {
    return NextResponse.json(
      { error: 'Too many initialization requests. Try again later.' },
      { status: 429 }
    );
  }

  // Verify init key for production environments
  const initKey = req.headers.get('x-init-key');
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret !== 'zbs-dev-secret-do-not-use-in-production') {
    // Production mode: require init key matching JWT_SECRET
    if (!initKey || initKey !== jwtSecret) {
      return NextResponse.json(
        { error: 'Invalid or missing initialization key' },
        { status: 403 }
      );
    }
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  let connected = false;
  try {
    await client.connect();
    connected = true;
  } catch (err: any) {
    return NextResponse.json({
      error: `Failed to connect to database: ${err.message}`,
    }, { status: 500 });
  }

  const tables: string[] = [];
  const errors: string[] = [];

  // All CREATE TABLE statements with IF NOT EXISTS
  // Tables are ordered by dependency (parents first)
  const createStatements = [
    // Platform tables
    `CREATE TABLE IF NOT EXISTS "PlatformUser" (
      "id" TEXT NOT NULL,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Industry" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT,
      "icon" TEXT,
      "color" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Plan" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "tier" TEXT NOT NULL DEFAULT 'starter',
      "priceUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "priceTTD" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Tenant" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "logoUrl" TEXT,
      "industryId" TEXT,
      "planId" TEXT,
      "planName" TEXT,
      "status" TEXT NOT NULL DEFAULT 'trial', -- accepts: 'trial', 'active', 'suspended', 'pending_approval', 'rejected'
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "TenantMembership" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'admin',
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "TenantFeatureFlag" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "featureSlug" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TenantFeatureFlag_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "TenantSubscription" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "planId" TEXT,
      "planName" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
      "priceUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "priceTTD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "currentPeriodStart" TIMESTAMP(3),
      "currentPeriodEnd" TIMESTAMP(3),
      "paymentBehavior" TEXT NOT NULL DEFAULT 'always_on_time',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "tenantId" TEXT,
      "action" TEXT NOT NULL,
      "details" TEXT,
      "severity" TEXT NOT NULL DEFAULT 'info',
      "ipAddress" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "SystemEvent" (
      "id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "severity" TEXT NOT NULL DEFAULT 'info',
      "tenantId" TEXT,
      "metadata" TEXT NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "PlatformInvoice" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT,
      "invoiceNumber" TEXT,
      "amountUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "amountTTD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "issueDate" TIMESTAMP(3),
      "dueDate" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "PriceSetting" (
      "id" TEXT NOT NULL,
      "planId" TEXT,
      "key" TEXT NOT NULL,
      "valueUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "valueTTD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PriceSetting_pkey" PRIMARY KEY ("id")
    )`,

    // Business tables
    `CREATE TABLE IF NOT EXISTS "Client" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "address" TEXT,
      "notes" TEXT,
      "tags" TEXT NOT NULL DEFAULT '[]',
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Order" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "orderNumber" TEXT,
      "clientName" TEXT,
      "clientEmail" TEXT,
      "clientPhone" TEXT,
      "items" TEXT NOT NULL DEFAULT '[]',
      "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "orderType" TEXT NOT NULL DEFAULT 'custom',
      "deliveryDate" TIMESTAMP(3),
      "deliveryAddress" TEXT,
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "CatalogItem" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "unit" TEXT,
      "imageUrl" TEXT,
      "isAvailable" BOOLEAN NOT NULL DEFAULT true,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Invoice" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "invoiceNumber" TEXT,
      "clientName" TEXT,
      "clientEmail" TEXT,
      "items" TEXT NOT NULL DEFAULT '[]',
      "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "issueDate" TIMESTAMP(3),
      "dueDate" TIMESTAMP(3),
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Quotation" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "quoteNumber" TEXT,
      "clientName" TEXT,
      "clientEmail" TEXT,
      "items" TEXT NOT NULL DEFAULT '[]',
      "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "validUntil" TIMESTAMP(3),
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Payment" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "invoiceId" TEXT,
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'TTD',
      "method" TEXT NOT NULL DEFAULT 'cash',
      "reference" TEXT,
      "status" TEXT NOT NULL DEFAULT 'completed',
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Expense" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "category" TEXT,
      "description" TEXT,
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'TTD',
      "date" TIMESTAMP(3),
      "receiptUrl" TEXT,
      "vendor" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Recipe" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "servings" INTEGER,
      "prepTime" INTEGER,
      "cookTime" INTEGER,
      "ingredients" TEXT NOT NULL DEFAULT '[]',
      "instructions" TEXT NOT NULL DEFAULT '[]',
      "costPerServing" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "imageUrl" TEXT,
      "isPublic" BOOLEAN NOT NULL DEFAULT false,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Ingredient" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT,
      "unit" TEXT,
      "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "supplier" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "DesignItem" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "imageUrl" TEXT,
      "tags" TEXT NOT NULL DEFAULT '[]',
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "DesignItem_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "TenantDocument" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'general',
      "content" TEXT,
      "fileUrl" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TenantDocument_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Stylist" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "specialty" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "imageUrl" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Stylist_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "SalonServiceItem" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "duration" INTEGER NOT NULL DEFAULT 60,
      "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "category" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SalonServiceItem_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Appointment" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "clientName" TEXT,
      "stylistId" TEXT,
      "serviceId" TEXT,
      "date" TIMESTAMP(3),
      "duration" INTEGER NOT NULL DEFAULT 60,
      "status" TEXT NOT NULL DEFAULT 'scheduled',
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Patient" (
      "id" TEXT NOT NULL,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "MedicalAppointment" (
      "id" TEXT NOT NULL,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "MedicalAppointment_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "LegalCase" (
      "id" TEXT NOT NULL,
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
      "billingRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "hoursBilled" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "LegalCase_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "TimeEntry" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "caseId" TEXT,
      "description" TEXT NOT NULL,
      "duration" INTEGER NOT NULL DEFAULT 0,
      "billingRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "billable" BOOLEAN NOT NULL DEFAULT true,
      "date" TIMESTAMP(3),
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Policy" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "policyNumber" TEXT,
      "clientName" TEXT,
      "type" TEXT,
      "premium" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "coverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "startDate" TIMESTAMP(3),
      "endDate" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'active',
      "beneficiaries" TEXT NOT NULL DEFAULT '[]',
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Claim" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "policyId" TEXT,
      "claimNumber" TEXT,
      "claimantName" TEXT,
      "type" TEXT,
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'submitted',
      "incidentDate" TIMESTAMP(3),
      "description" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "RetailProduct" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "sku" TEXT,
      "category" TEXT,
      "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "quantity" INTEGER NOT NULL DEFAULT 0,
      "minStock" INTEGER NOT NULL DEFAULT 0,
      "supplier" TEXT,
      "barcode" TEXT,
      "imageUrl" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "RetailProduct_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Event" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" TEXT,
      "clientName" TEXT,
      "venue" TEXT,
      "eventDate" TIMESTAMP(3),
      "setupDate" TIMESTAMP(3),
      "guestCount" INTEGER NOT NULL DEFAULT 0,
      "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'planning',
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Supplier" (
      "id" TEXT NOT NULL,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Venue" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "location" TEXT,
      "capacity" INTEGER NOT NULL DEFAULT 0,
      "contact" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "amenities" TEXT NOT NULL DEFAULT '[]',
      "pricePerHour" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Vendor" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT,
      "contact" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "rating" INTEGER NOT NULL DEFAULT 0,
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Contract" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "clientName" TEXT,
      "type" TEXT,
      "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "startDate" TIMESTAMP(3),
      "endDate" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'active',
      "description" TEXT,
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Project" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "clientName" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "startDate" TIMESTAMP(3),
      "deadline" TIMESTAMP(3),
      "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "progress" INTEGER NOT NULL DEFAULT 0,
      "description" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "BookkeepingEntry" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "description" TEXT NOT NULL,
      "category" TEXT,
      "type" TEXT NOT NULL DEFAULT 'debit',
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'TTD',
      "reference" TEXT,
      "accountId" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "BookkeepingEntry_pkey" PRIMARY KEY ("id")
    )`,

    // Property Management tables
    `CREATE TABLE IF NOT EXISTS "Property" (
      "id" TEXT NOT NULL,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "PropertyUnit" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "unitNumber" TEXT NOT NULL,
      "floor" INTEGER NOT NULL DEFAULT 1,
      "area" DOUBLE PRECISION,
      "baseRentTTD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "baseRentUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "tenantId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'vacant',
      "amenities" TEXT NOT NULL DEFAULT '[]',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PropertyUnit_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "PropertyVendor" (
      "id" TEXT NOT NULL,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PropertyVendor_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Lease" (
      "id" TEXT NOT NULL,
      "unitId" TEXT NOT NULL,
      "tenantId" TEXT,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "rentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "rentCurrency" TEXT NOT NULL DEFAULT 'TTD',
      "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "MaintenanceRequest" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "unitId" TEXT,
      "tenantId" TEXT,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "priority" TEXT NOT NULL DEFAULT 'medium',
      "status" TEXT NOT NULL DEFAULT 'open',
      "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" TIMESTAMP(3),
      "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vendor" TEXT,
      "notes" TEXT,
      "vendorId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "RentPayment" (
      "id" TEXT NOT NULL,
      "leaseId" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "unitId" TEXT NOT NULL,
      "tenantId" TEXT,
      "periodStart" TIMESTAMP(3) NOT NULL,
      "periodEnd" TIMESTAMP(3) NOT NULL,
      "amountDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "lateFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'TTD',
      "paymentMethod" TEXT,
      "paymentRef" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "paidAt" TIMESTAMP(3),
      "dueDate" TIMESTAMP(3) NOT NULL,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "PropertyDocument" (
      "id" TEXT NOT NULL,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "JournalEntry" (
      "id" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "description" TEXT NOT NULL,
      "reference" TEXT,
      "status" TEXT NOT NULL DEFAULT 'posted',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "JournalEntryLine" (
      "id" TEXT NOT NULL,
      "journalEntryId" TEXT NOT NULL,
      "accountCode" TEXT NOT NULL,
      "accountName" TEXT NOT NULL,
      "accountType" TEXT NOT NULL,
      "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "OwnerDisbursement" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT,
      "periodStart" TIMESTAMP(3) NOT NULL,
      "periodEnd" TIMESTAMP(3) NOT NULL,
      "grossIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "netIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "ownerShare" DOUBLE PRECISION NOT NULL DEFAULT 100,
      "disbursementAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'TTD',
      "status" TEXT NOT NULL DEFAULT 'pending',
      "paidAt" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "OwnerDisbursement_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "LeaseRenewalLog" (
      "id" TEXT NOT NULL,
      "leaseId" TEXT NOT NULL,
      "previousEnd" TIMESTAMP(3) NOT NULL,
      "newStart" TIMESTAMP(3) NOT NULL,
      "newEnd" TIMESTAMP(3) NOT NULL,
      "oldRent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "newRent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "increasePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "renewedBy" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LeaseRenewalLog_pkey" PRIMARY KEY ("id")
    )`,

    // Inventory tables
    `CREATE TABLE IF NOT EXISTS "RawMaterial" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "sku" TEXT,
      "category" TEXT NOT NULL DEFAULT 'general',
      "unit" TEXT NOT NULL DEFAULT 'kg',
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "supplierId" TEXT,
      "expiryDays" INTEGER,
      "storageCondition" TEXT,
      "batchNumber" TEXT,
      "entryDate" TIMESTAMP(3),
      "expiryDate" TIMESTAMP(3),
      "method" TEXT NOT NULL DEFAULT 'fifo',
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
    )`,

    // Production Planning tables
    `CREATE TABLE IF NOT EXISTS "ProductionPlan" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "items" TEXT NOT NULL DEFAULT '[]',
      "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "assignedTo" TEXT,
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
    )`,

    // Costing & Margins tables
    `CREATE TABLE IF NOT EXISTS "CostAnalysis" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "recipeId" TEXT,
      "recipeName" TEXT,
      "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "costPerServing" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "profitMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "foodCostPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "suggestedPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "overheadCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "analysisDate" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CostAnalysis_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "StockMovement" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "ingredientId" TEXT,
      "type" TEXT NOT NULL DEFAULT 'entry',
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "previousStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "newStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "reason" TEXT,
      "reference" TEXT,
      "batchNumber" TEXT,
      "expiryDate" TIMESTAMP(3),
      "method" TEXT DEFAULT 'fifo',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS "ProductionBatch" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "batchNumber" TEXT,
      "recipeId" TEXT,
      "recipeName" TEXT,
      "category" TEXT,
      "plannedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "unit" TEXT DEFAULT 'unidades',
      "status" TEXT NOT NULL DEFAULT 'planned',
      "scheduledDate" TIMESTAMP(3),
      "completedDate" TIMESTAMP(3),
      "assignedTo" TEXT,
      "notes" TEXT,
      "ingredientNeeds" TEXT NOT NULL DEFAULT '[]',
      "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
    )`,
  ];

  // Create indexes
  const indexStatements = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "PlatformUser_email_key" ON "PlatformUser"("email")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Industry_slug_key" ON "Industry"("slug")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Plan_slug_key" ON "Plan"("slug")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "TenantMembership_userId_tenantId_key" ON "TenantMembership"("userId", "tenantId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "TenantFeatureFlag_tenantId_featureSlug_key" ON "TenantFeatureFlag"("tenantId", "featureSlug")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PriceSetting_key_key" ON "PriceSetting"("key")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PropertyUnit_propertyId_unitNumber_key" ON "PropertyUnit"("propertyId", "unitNumber")`,
    `CREATE INDEX IF NOT EXISTS "RawMaterial_tenantId_key" ON "RawMaterial"("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "ProductionPlan_tenantId_key" ON "ProductionPlan"("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "CostAnalysis_tenantId_key" ON "CostAnalysis"("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "RawMaterial_category_key" ON "RawMaterial"("tenantId", "category")`,
    `CREATE INDEX IF NOT EXISTS "ProductionPlan_date_key" ON "ProductionPlan"("tenantId", "date")`,
  ];

  try {
    // Create all tables
    for (const stmt of createStatements) {
      try {
        await client.query(stmt);
        // Extract table name from the statement
        const match = stmt.match(/"(\w+)"/);
        if (match) tables.push(match[1]);
      } catch (err: any) {
        errors.push(`${err.message}`);
      }
    }

    // Create indexes
    for (const stmt of indexStatements) {
      try {
        await client.query(stmt);
      } catch (err: any) {
        errors.push(`Index: ${err.message}`);
      }
    }

    // Seed admin user if not exists
    try {
      const adminHash = await bcrypt.hash('zeitgeist2026', 12);
      await client.query(`
        INSERT INTO "PlatformUser" (id, email, password, "fullName", role, "isActive")
        VALUES (
          'admin-001',
          'admin@zeitgeist.business',
          '${adminHash}',
          'ZBS Super Admin',
          'super_admin',
          true
        )
        ON CONFLICT (email) DO NOTHING
      `);
      tables.push('AdminUser');
    } catch (err: any) {
      errors.push(`Seed admin: ${err.message}`);
    }

    // Seed demo tenant if not exists
    try {
      const demoHash = await bcrypt.hash('demo123', 12);
      await client.query(`
        INSERT INTO "PlatformUser" (id, email, password, "fullName", role, "isActive")
        VALUES (
          'demo-001',
          'demo@bakery.com',
          '${demoHash}',
          'Demo Bakery Tenant',
          'tenant_admin',
          true
        )
        ON CONFLICT (email) DO NOTHING
      `);
    } catch (err: any) {
      errors.push(`Seed demo: ${err.message}`);
    }

    // Seed industries
    try {
      await client.query(`
        INSERT INTO "Industry" (id, name, slug, icon, color, status, "sortOrder") VALUES
          ('ind-bakery', 'Panaderias', 'bakery', 'Cake', '#D97706', 'active', 1),
          ('ind-salon', 'Salones de Belleza', 'salon-spa', 'Scissors', '#EC4899', 'active', 2),
          ('ind-clinic', 'Clinicas Medicas', 'clinics', 'Stethoscope', '#10B981', 'active', 3),
          ('ind-legal', 'Firmas Legales', 'legal', 'Scale', '#6366F1', 'active', 4),
          ('ind-insurance', 'Seguros', 'insurance', 'Shield', '#3B82F6', 'active', 5),
          ('ind-retail', 'Retail', 'retail', 'ShoppingBag', '#8B5CF6', 'active', 6),
          ('ind-events', 'Eventos', 'events', 'Calendar', '#F59E0B', 'active', 7),
          ('ind-pm', 'Gestion de Propiedades', 'property-management', 'Building2', '#059669', 'active', 8)
        ON CONFLICT (slug) DO NOTHING
      `);
      // Fix legacy slug mismatches if they exist
      await client.query(`UPDATE "Industry" SET slug = 'salon-spa' WHERE slug = 'salon'`);
      await client.query(`UPDATE "Industry" SET slug = 'clinics' WHERE slug = 'clinic'`);
    } catch (err: any) {
      errors.push(`Seed industries: ${err.message}`);
    }

    // Seed demo tenant with bakery
    try {
      await client.query(`
        INSERT INTO "Tenant" (id, name, slug, "industryId", status, "primaryColor", "accentColor")
        VALUES (
          'tenant-demo-bakery',
          'Demo Bakery',
          'demo-bakery',
          'ind-bakery',
          'active',
          '#D97706',
          '#F59E0B'
        )
        ON CONFLICT (slug) DO NOTHING
      `);

      // Link demo user to tenant
      await client.query(`
        INSERT INTO "TenantMembership" (id, "userId", "tenantId", role, status)
        VALUES (
          'tm-demo-001',
          'demo-001',
          'tenant-demo-bakery',
          'admin',
          'active'
        )
        ON CONFLICT DO NOTHING
      `);
    } catch (err: any) {
      errors.push(`Seed tenant: ${err.message}`);
    }

    await client.end();

    return NextResponse.json({
      message: 'Database initialized successfully',
      tablesCreated: tables.length,
      tables,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    await client.end().catch(() => {});
    return NextResponse.json({
      error: `Database initialization failed: ${err.message}`,
      tablesCreated: tables.length,
      tables,
      errors,
    }, { status: 500 });
  }
}

// GET endpoint to check database status
export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ connected: false, error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    await client.end();

    return NextResponse.json({
      connected: true,
      tables: result.rows.map((r: any) => r.tablename),
      count: result.rows.length,
    });
  } catch (err: any) {
    await client.end().catch(() => {});
    return NextResponse.json({ connected: false, error: err.message }, { status: 500 });
  }
}
