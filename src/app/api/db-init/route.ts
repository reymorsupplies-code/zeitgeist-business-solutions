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
  if (jwtSecret) {
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
    ssl: { rejectUnauthorized: true },
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
      "price" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "cost" NUMERIC(12,2) NOT NULL DEFAULT 0,
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
      "quantity" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "previousStock" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "newStock" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "unitCost" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "reason" TEXT,
      "reference" TEXT,
      "batchNumber" TEXT,
      "expiryDate" TIMESTAMP(3),
      "method" TEXT DEFAULT 'fifo',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    // Retail POS & Operations tables
    `CREATE TABLE IF NOT EXISTS "POSSale" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "saleNumber" TEXT,
      "items" TEXT NOT NULL DEFAULT '[]',
      "subtotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "discountPct" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "discountAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "taxAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
      "cashReceived" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "changeAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'TTD',
      "customerName" TEXT,
      "staffName" TEXT,
      "status" TEXT NOT NULL DEFAULT 'completed',
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "POSSale_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "poNumber" TEXT,
      "supplierId" TEXT,
      "supplierName" TEXT,
      "items" TEXT NOT NULL DEFAULT '[]',
      "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "receivedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "expectedDate" TIMESTAMP(3),
      "receivedAt" TIMESTAMP(3),
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "ProductReturn" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "saleId" TEXT,
      "returnNumber" TEXT,
      "items" TEXT NOT NULL DEFAULT '[]',
      "totalRefund" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "refundMethod" TEXT NOT NULL DEFAULT 'cash',
      "reason" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "processedBy" TEXT,
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ProductReturn_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "Layaway" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "layawayNumber" TEXT,
      "customerName" TEXT,
      "customerPhone" TEXT,
      "customerEmail" TEXT,
      "items" TEXT NOT NULL DEFAULT '[]',
      "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "depositAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "balanceRemaining" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "payments" TEXT NOT NULL DEFAULT '[]',
      "status" TEXT NOT NULL DEFAULT 'active',
      "dueDate" TIMESTAMP(3),
      "expiryDate" TIMESTAMP(3),
      "depositPercentage" NUMERIC(12,2) NOT NULL DEFAULT 20,
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Layaway_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "GiftCard" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "cardNumber" TEXT NOT NULL,
      "cardCode" TEXT NOT NULL,
      "initialBalance" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "currentBalance" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "customerName" TEXT,
      "purchaserName" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "issuedAt" TIMESTAMP(3),
      "expiresAt" TIMESTAMP(3),
      "lastUsedAt" TIMESTAMP(3),
      "transactions" TEXT NOT NULL DEFAULT '[]',
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "RegisterShift" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "shiftNumber" TEXT,
      "staffName" TEXT,
      "staffId" TEXT,
      "openedAt" TIMESTAMP(3),
      "closedAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'open',
      "startingCash" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "closingCash" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "expectedCash" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "cashSales" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "cardSales" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "transferSales" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "totalSales" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "totalRefunds" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "giftCardSales" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "layawayDeposits" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "transactionCount" INTEGER NOT NULL DEFAULT 0,
      "refundCount" INTEGER NOT NULL DEFAULT 0,
      "discrepancy" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "notes" TEXT,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "RegisterShift_pkey" PRIMARY KEY ("id")
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

    // ═══════════════════════════════════════════════
    // SEED REALISTIC DEMO DATA (bakery)
    // ═══════════════════════════════════════════════
    const TID = 'tenant-demo-bakery';

    // --- Clients ---
    try {
      await client.query(`
        INSERT INTO "Client" (id, "tenantId", name, email, phone, address, tags, "createdAt") VALUES
          ('c-01', $1, 'Maria Santos', 'maria.santos@email.com', '+1868-771-2345', '45 San Fernando Rd', '["VIP","Repeat"]', NOW() - INTERVAL '45 days'),
          ('c-02', $1, 'James Ali', 'j.ali@gmail.com', '+1868-299-8765', '12 Couva Main St', '["Corporate"]', NOW() - INTERVAL '38 days'),
          ('c-03', $1, 'Priya Sharma', 'priya.s@outlook.com', '+1868-355-4422', '88 Chaguanas Blvd', '["Repeat","Birthday"]', NOW() - INTERVAL '30 days'),
          ('c-04', $1, 'David Williams', 'dwilliams@email.com', '+1868-688-1100', '23 Port of Spain', '["Wedding"]', NOW() - INTERVAL '25 days'),
          ('c-05', $1, 'Anita Ramlogan', 'anita.r@gmail.com', '+1868-772-3399', '56 Arima', '["VIP","Corporate"]', NOW() - INTERVAL '20 days'),
          ('c-06', $1, 'Chris Taylor', 'ctaylor@email.com', '+1868-445-6677', '9 Diego Martin', '["New"]', NOW() - INTERVAL '15 days'),
          ('c-07', $1, 'Shelly Boodram', 'shelly.b@email.com', '+1868-331-2244', '77 Princes Town', '["Repeat"]', NOW() - INTERVAL '10 days'),
          ('c-08', $1, 'Mark Joseph', 'mjoseph@gmail.com', '+1868-654-9900', '34 Scarborough', '["Wholesale"]', NOW() - INTERVAL '8 days'),
          ('c-09', $1, 'Lisa Perreira', 'lisa.p@email.com', '+1868-212-5588', '11 Siparia', '["Birthday"]', NOW() - INTERVAL '5 days'),
          ('c-10', $1, 'Rohan Nanan', 'rnanan@email.com', '+1868-470-3311', '67 Point Fortin', '["Corporate","Repeat"]', NOW() - INTERVAL '2 days')
        ON CONFLICT DO NOTHING
      `, [TID]);
    } catch (err: any) { errors.push(`Seed clients: ${err.message}`); }

    // --- Catalog Items (bakery products) ---
    try {
      await client.query(`
        INSERT INTO "CatalogItem" (id, "tenantId", name, description, category, price, cost, unit, "isAvailable", "createdAt") VALUES
          ('cat-01', $1, 'Black Forest Cake', 'Classic chocolate cake with cherry filling', 'Cakes', 280.00, 95.00, 'each', true, NOW() - INTERVAL '40 days'),
          ('cat-02', $1, 'Sourdough Bread', 'Artisan sourdough loaf', 'Bread', 45.00, 15.00, 'loaf', true, NOW() - INTERVAL '40 days'),
          ('cat-03', $1, 'Vanilla Cupcake (6-pack)', 'Premium vanilla cupcakes with buttercream', 'Cupcakes', 120.00, 40.00, 'pack', true, NOW() - INTERVAL '38 days'),
          ('cat-04', $1, 'Chocolate Eclairs (4-pack)', 'Choux pastry with chocolate cream filling', 'Pastries', 90.00, 30.00, 'pack', true, NOW() - INTERVAL '35 days'),
          ('cat-05', $1, 'Coconut Bake', 'Traditional Trinidadian coconut bake', 'Bread', 25.00, 8.00, 'each', true, NOW() - INTERVAL '30 days'),
          ('cat-06', $1, 'Pineapple Tart (12-pack)', 'Mini pineapple tarts for events', 'Pastries', 180.00, 60.00, 'box', true, NOW() - INTERVAL '28 days'),
          ('cat-07', $1, 'Red Velvet Cake', 'Cream cheese frosting, 2-tier', 'Cakes', 350.00, 120.00, 'each', true, NOW() - INTERVAL '25 days'),
          ('cat-08', $1, 'Croissants (6-pack)', 'Butter croissants, freshly baked', 'Bread', 150.00, 55.00, 'pack', true, NOW() - INTERVAL '20 days'),
          ('cat-09', $1, 'Doubles (25-pack)', 'Bulk order of doubles for catering', 'Local', 125.00, 45.00, 'pack', true, NOW() - INTERVAL '15 days'),
          ('cat-10', $1, 'Wedding Cake (3-tier)', 'Custom design, serves 100+', 'Cakes', 1800.00, 550.00, 'each', true, NOW() - INTERVAL '10 days'),
          ('cat-11', $1, 'Cinnamon Rolls (8-pack)', 'Warm cinnamon rolls with glaze', 'Pastries', 110.00, 35.00, 'pack', true, NOW() - INTERVAL '8 days'),
          ('cat-12', $1, 'Whole Wheat Bread', 'Healthy whole wheat loaf', 'Bread', 35.00, 12.00, 'loaf', true, NOW() - INTERVAL '5 days')
        ON CONFLICT DO NOTHING
      `, [TID]);
    } catch (err: any) { errors.push(`Seed catalog: ${err.message}`); }

    // --- Orders ---
    try {
      await client.query(`
        INSERT INTO "Order" (id, "tenantId", "orderNumber", "clientName", "clientEmail", "clientPhone", items, subtotal, "taxAmount", "totalAmount", status, "orderType", "deliveryDate", notes, "createdAt") VALUES
          ('o-01', $1, 'ORD-001', 'Maria Santos', 'maria.santos@email.com', '+1868-771-2345', '[{"name":"Black Forest Cake","qty":1,"price":280}]', 280.00, 35.00, 315.00, 'delivered', 'custom', NOW() - INTERVAL '40 days', 'Birthday party', NOW() - INTERVAL '42 days'),
          ('o-02', $1, 'ORD-002', 'James Ali', 'j.ali@gmail.com', '+1868-299-8765', '[{"name":"Sourdough Bread","qty":10,"price":45},{"name":"Croissants","qty":5,"price":150}]', 1200.00, 150.00, 1350.00, 'delivered', 'custom', NOW() - INTERVAL '35 days', 'Weekly corporate order', NOW() - INTERVAL '38 days'),
          ('o-03', $1, 'ORD-003', 'David Williams', 'dwilliams@email.com', '+1868-688-1100', '[{"name":"Wedding Cake (3-tier)","qty":1,"price":1800}]', 1800.00, 225.00, 2025.00, 'completed', 'custom', NOW() - INTERVAL '20 days', 'Wedding reception May 15', NOW() - INTERVAL '28 days'),
          ('o-04', $1, 'ORD-004', 'Priya Sharma', 'priya.s@outlook.com', '+1868-355-4422', '[{"name":"Vanilla Cupcake (6-pack)","qty":3,"price":120},{"name":"Pineapple Tart (12-pack)","qty":2,"price":180}]', 720.00, 90.00, 810.00, 'delivered', 'custom', NOW() - INTERVAL '15 days', 'Daughter birthday party', NOW() - INTERVAL '18 days'),
          ('o-05', $1, 'ORD-005', 'Anita Ramlogan', 'anita.r@gmail.com', '+1868-772-3399', '[{"name":"Coconut Bake","qty":20,"price":25}]', 500.00, 62.50, 562.50, 'delivered', 'custom', NOW() - INTERVAL '12 days', 'Office breakfast catering', NOW() - INTERVAL '14 days'),
          ('o-06', $1, 'ORD-006', 'Chris Taylor', 'ctaylor@email.com', '+1868-445-6677', '[{"name":"Red Velvet Cake","qty":1,"price":350}]', 350.00, 43.75, 393.75, 'in_progress', 'custom', NOW() + INTERVAL '3 days', 'Anniversary cake', NOW() - INTERVAL '5 days'),
          ('o-07', $1, 'ORD-007', 'Mark Joseph', 'mjoseph@gmail.com', '+1868-654-9900', '[{"name":"Doubles (25-pack)","qty":4,"price":125},{"name":"Coconut Bake","qty":10,"price":25}]', 750.00, 93.75, 843.75, 'confirmed', 'custom', NOW() + INTERVAL '5 days', 'Friday catering event', NOW() - INTERVAL '3 days'),
          ('o-08', $1, 'ORD-008', 'Shelly Boodram', 'shelly.b@email.com', '+1868-331-2244', '[{"name":"Chocolate Eclairs (4-pack)","qty":4,"price":90},{"name":"Cinnamon Rolls (8-pack)","qty":2,"price":110}]', 580.00, 72.50, 652.50, 'in_progress', 'custom', NOW() + INTERVAL '2 days', '', NOW() - INTERVAL '2 days'),
          ('o-09', $1, 'ORD-009', 'Lisa Perreira', 'lisa.p@email.com', '+1868-212-5588', '[{"name":"Black Forest Cake","qty":1,"price":280},{"name":"Vanilla Cupcake (6-pack)","qty":2,"price":120}]', 520.00, 65.00, 585.00, 'pending', 'custom', NOW() + INTERVAL '7 days', 'Surprise birthday', NOW() - INTERVAL '1 day'),
          ('o-10', $1, 'ORD-010', 'Rohan Nanan', 'rnanan@email.com', '+1868-470-3311', '[{"name":"Whole Wheat Bread","qty":50,"price":35}]', 1750.00, 218.75, 1968.75, 'pending', 'wholesale', NOW() + INTERVAL '10 days', 'Monthly standing order', NOW() - INTERVAL '1 day')
        ON CONFLICT DO NOTHING
      `, [TID]);
    } catch (err: any) { errors.push(`Seed orders: ${err.message}`); }

    // --- Invoices ---
    try {
      await client.query(`
        INSERT INTO "Invoice" (id, "tenantId", "invoiceNumber", "clientName", "clientEmail", items, subtotal, "taxRate", "taxAmount", "totalAmount", "balanceDue", status, "issueDate", "dueDate", "createdAt") VALUES
          ('inv-01', $1, 'INV-001', 'James Ali', 'j.ali@gmail.com', '[{"desc":"Weekly bread order x3","amount":4050}]', 4050.00, 0.125, 506.25, 4556.25, 0.00, 'paid', NOW() - INTERVAL '30 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '30 days'),
          ('inv-02', $1, 'INV-002', 'David Williams', 'dwilliams@email.com', '[{"desc":"Wedding Cake 3-tier","amount":2025}]', 2025.00, 0.125, 253.13, 2278.13, 0.00, 'paid', NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '20 days'),
          ('inv-03', $1, 'INV-003', 'Priya Sharma', 'priya.s@outlook.com', '[{"desc":"Birthday cupcakes + tarts","amount":810}]', 810.00, 0.125, 101.25, 911.25, 0.00, 'paid', NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '15 days'),
          ('inv-04', $1, 'INV-004', 'Anita Ramlogan', 'anita.r@gmail.com', '[{"desc":"Coconut bake catering","amount":562.50}]', 562.50, 0.125, 70.31, 632.81, 632.81, 'sent', NOW() - INTERVAL '5 days', NOW() + INTERVAL '20 days', NOW() - INTERVAL '5 days'),
          ('inv-05', $1, 'INV-005', 'Maria Santos', 'maria.santos@email.com', '[{"desc":"Black Forest Cake","amount":315}]', 315.00, 0.125, 39.38, 354.38, 354.38, 'draft', NOW() - INTERVAL '1 day', NOW() + INTERVAL '25 days', NOW() - INTERVAL '1 day')
        ON CONFLICT DO NOTHING
      `, [TID]);
    } catch (err: any) { errors.push(`Seed invoices: ${err.message}`); }

    // --- Expenses ---
    try {
      await client.query(`
        INSERT INTO "Expense" (id, "tenantId", category, description, amount, currency, date, vendor, "createdAt") VALUES
          ('exp-01', $1, 'Ingredients', 'Flour bulk purchase (50kg x4)', 1200.00, 'TTD', NOW() - INTERVAL '25 days', 'Caribbean Flour Mills', NOW() - INTERVAL '25 days'),
          ('exp-02', $1, 'Ingredients', 'Butter & margarine', 680.00, 'TTD', NOW() - INTERVAL '22 days', 'Supermix Trading', NOW() - INTERVAL '22 days'),
          ('exp-03', $1, 'Utilities', 'Electricity bill - April', 1850.00, 'TTD', NOW() - INTERVAL '20 days', 'T&TEC', NOW() - INTERVAL '20 days'),
          ('exp-04', $1, 'Ingredients', 'Sugar (25kg x2)', 450.00, 'TTD', NOW() - INTERVAL '18 days', 'Caribbean Sugar', NOW() - INTERVAL '18 days'),
          ('exp-05', $1, 'Equipment', 'Stand mixer repair', 350.00, 'TTD', NOW() - INTERVAL '15 days', 'Kitchen Fix Ltd', NOW() - INTERVAL '15 days'),
          ('exp-06', $1, 'Marketing', 'Facebook ads - April', 500.00, 'TTD', NOW() - INTERVAL '12 days', 'Meta Ads', NOW() - INTERVAL '12 days'),
          ('exp-07', $1, 'Ingredients', 'Chocolate & cocoa supplies', 420.00, 'TTD', NOW() - INTERVAL '10 days', 'Cocoa Innovators', NOW() - INTERVAL '10 days'),
          ('exp-08', $1, 'Rent', 'Shop rent - May', 4500.00, 'TTD', NOW() - INTERVAL '5 days', 'Property Management Co', NOW() - INTERVAL '5 days'),
          ('exp-09', $1, 'Ingredients', 'Eggs (tray x10)', 380.00, 'TTD', NOW() - INTERVAL '3 days', 'Poultry World', NOW() - INTERVAL '3 days'),
          ('exp-10', $1, 'Labor', 'Part-time baker (2 weeks)', 2400.00, 'TTD', NOW() - INTERVAL '1 day', 'Staff', NOW() - INTERVAL '1 day')
        ON CONFLICT DO NOTHING
      `, [TID]);
    } catch (err: any) { errors.push(`Seed expenses: ${err.message}`); }

    // --- Payments ---
    try {
      await client.query(`
        INSERT INTO "Payment" (id, "tenantId", "invoiceId", amount, currency, method, reference, status, "createdAt") VALUES
          ('pay-01', $1, 'inv-01', 4556.25, 'TTD', 'bank_transfer', 'BT-20260415', 'completed', NOW() - INTERVAL '20 days'),
          ('pay-02', $1, 'inv-02', 2278.13, 'TTD', 'credit_card', 'CC-8832', 'completed', NOW() - INTERVAL '12 days'),
          ('pay-03', $1, 'inv-03', 911.25, 'TTD', 'cash', 'CASH-001', 'completed', NOW() - INTERVAL '5 days')
        ON CONFLICT DO NOTHING
      `, [TID]);
    } catch (err: any) { errors.push(`Seed payments: ${err.message}`); }

    // --- Audit Log entries ---
    try {
      await client.query(`
        INSERT INTO "AuditLog" (id, "userId", "tenantId", action, details, severity, "createdAt") VALUES
          ('al-01', 'demo-001', $1, 'ORDER_CREATED', 'Order ORD-009 received from Lisa Perreira', 'info', NOW() - INTERVAL '1 day'),
          ('al-02', 'demo-001', $1, 'INVOICE_SENT', 'Invoice INV-004 sent to Anita Ramlogan', 'info', NOW() - INTERVAL '5 days'),
          ('al-03', 'demo-001', $1, 'PAYMENT_RECEIVED', 'Payment of TT$911.25 received from Priya Sharma', 'info', NOW() - INTERVAL '5 days'),
          ('al-04', 'demo-001', $1, 'ORDER_COMPLETED', 'Order ORD-003 (Wedding Cake) completed successfully', 'info', NOW() - INTERVAL '20 days'),
          ('al-05', 'demo-001', $1, 'CLIENT_CREATED', 'New client Rohan Nanan added', 'info', NOW() - INTERVAL '2 days'),
          ('al-06', 'admin-001', NULL, 'TENANT_APPROVED', 'Demo Bakery tenant approved', 'info', NOW() - INTERVAL '45 days'),
          ('al-07', 'demo-001', $1, 'INVOICE_CREATED', 'Invoice INV-005 drafted for Maria Santos', 'info', NOW() - INTERVAL '1 day'),
          ('al-08', 'demo-001', $1, 'LOGIN', 'User logged in from Port of Spain', 'low', NOW() - INTERVAL '6 hours')
        ON CONFLICT DO NOTHING
      `, [TID]);
    } catch (err: any) { errors.push(`Seed audit: ${err.message}`); }

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
    ssl: { rejectUnauthorized: true },
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
