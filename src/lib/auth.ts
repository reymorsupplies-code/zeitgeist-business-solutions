/**
 * ZBS Authentication & Security Module
 * - bcrypt password hashing
 * - JWT token issuance & verification
 * - Rate limiting (in-memory)
 * - Input validation helpers
 * - Column whitelist helper for dynamic SQL
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;

/** Get JWT secret — throws only at runtime, not during build */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('[AUTH] FATAL: JWT_SECRET environment variable is not configured.');
  }
  return secret;
}

// ─── Password Hashing ───

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT Tokens ───

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
  tenantRole?: string;
  isSuperAdmin?: boolean;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

export function extractBearerToken(request: Request | NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

// Re-export NextRequest for type reference
import { NextRequest } from 'next/server';

// ─── Rate Limiting (in-memory, per IP) ───

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // per window

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  identifier: string,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    rateLimitMap.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// Stricter rate limit for auth endpoints
export function checkAuthRateLimit(identifier: string): RateLimitResult {
  return checkRateLimit(identifier, 10, RATE_LIMIT_WINDOW_MS);
}

// ─── Input Validation Helpers ───

export function sanitizeString(input: string): string {
  return input.replace(/[<>'";&\\]/g, '').trim();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUUID(id: string): boolean {
  // CUID format (used by Prisma): starts with letter, 25+ chars, alphanumeric + hyphens/underscores
  // Also accepts standard UUID v4 format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return true;
  // Prisma CUID: min 9 chars, starts with letter, alphanumeric + underscore/hyphen
  if (/^[a-z][a-z0-9_-]{8,}$/i.test(id)) return true;
  return false;
}

export function validateRequiredFields(data: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      return field;
    }
  }
  return null;
}

// ─── Column Whitelist for Dynamic SQL ───

/**
 * Whitelists of allowed column names per table.
 * Prevents column name injection in dynamic UPDATE/INSERT queries.
 */
const COLUMN_WHITELISTS: Record<string, Set<string>> = {
  Client: new Set([
    'name', 'email', 'phone', 'address', 'notes', 'tags',
    'companyName', 'taxId', 'website', 'isDeleted', 'updatedAt',
  ]),
  Order: new Set([
    'orderNumber', 'clientName', 'clientEmail', 'clientPhone',
    'items', 'subtotal', 'taxAmount', 'totalAmount', 'status',
    'orderType', 'deliveryDate', 'deliveryAddress', 'notes',
    'isDeleted', 'updatedAt', 'priority', 'dueDate',
  ]),
  Product: new Set([
    'name', 'description', 'price', 'costPrice', 'category',
    'sku', 'image', 'isActive', 'stock', 'tags', 'notes',
    'isDeleted', 'updatedAt', 'unit', 'minStock',
  ]),
  Ingredient: new Set([
    'name', 'description', 'unit', 'costPrice', 'stock',
    'minStock', 'supplier', 'category', 'isDeleted', 'updatedAt',
  ]),
  Appointment: new Set([
    'date', 'time', 'duration', 'clientName', 'clientPhone',
    'clientEmail', 'service', 'notes', 'status', 'isDeleted', 'updatedAt',
  ]),
  Expense: new Set([
    'description', 'amount', 'category', 'date', 'currency',
    'receiptUrl', 'vendor', 'isDeleted', 'updatedAt',
  ]),
  Invoice: new Set([
    'invoiceNumber', 'clientName', 'clientEmail', 'items',
    'subtotal', 'taxRate', 'taxAmount', 'totalAmount', 'balanceDue',
    'status', 'issueDate', 'dueDate',
    'notes', 'isDeleted', 'updatedAt',
  ]),
  Payment: new Set([
    'amount', 'method', 'reference', 'date', 'notes',
    'invoiceId', 'status', 'isDeleted', 'updatedAt',
  ]),
  Document: new Set([
    'name', 'type', 'category', 'content', 'fileUrl',
    'notes', 'isDeleted', 'updatedAt',
  ]),
  SalonService: new Set([
    'name', 'description', 'price', 'duration', 'category',
    'isActive', 'isDeleted', 'updatedAt',
  ]),
  Membership: new Set([
    'name', 'description', 'price', 'duration', 'benefits',
    'isActive', 'isDeleted', 'updatedAt',
  ]),
  Booking: new Set([
    'clientName', 'clientPhone', 'clientEmail', 'date', 'time',
    'guestCount', 'venue', 'eventPackage', 'status', 'notes',
    'isDeleted', 'updatedAt',
  ]),
  Project: new Set([
    'name', 'description', 'status', 'startDate', 'endDate',
    'clientName', 'budget', 'isDeleted', 'updatedAt',
  ]),
  Policy: new Set([
    'name', 'type', 'premium', 'coverage', 'status',
    'clientName', 'startDate', 'endDate', 'isDeleted', 'updatedAt',
  ]),
  LegalCase: new Set([
    'caseNumber', 'clientName', 'caseType', 'description',
    'status', 'court', 'nextDate', 'isDeleted', 'updatedAt',
  ]),
  Supplier: new Set([
    'name', 'contact', 'email', 'phone', 'address',
    'category', 'rating', 'notes', 'isDeleted', 'updatedAt',
  ]),
  Recipe: new Set([
    'name', 'description', 'yield', 'costPrice', 'sellPrice',
    'category', 'instructions', 'isDeleted', 'updatedAt',
  ]),
  RetailProduct: new Set([
    'name', 'price', 'cost', 'quantity', 'minStock', 'category',
    'sku', 'barcode', 'supplier', 'imageUrl', 'taxCategory', 'settings',
    'isActive', 'isDeleted', 'updatedAt',
  ]),
  POSSale: new Set([
    'status', 'customerName', 'staffName', 'paymentMethod', 'notes',
  ]),
  PurchaseOrder: new Set([
    'supplierId', 'supplierName', 'status', 'expectedDate', 'notes', 'items',
  ]),
  Return: new Set([
    'status', 'refundMethod', 'reason', 'processedBy', 'notes', 'totalRefund',
  ]),
  Layaway: new Set([
    'status', 'customerName', 'customerPhone', 'customerEmail', 'notes', 'dueDate', 'expiryDate',
  ]),
  GiftCard: new Set([
    'customerName', 'purchaserName', 'status', 'notes', 'expiresAt',
    'initialBalance', 'currentBalance',
  ]),
  RegisterShift: new Set([
    'closingCash', 'notes', 'status',
  ]),
  Insured: new Set([
    'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender',
    'nationalId', 'address', 'city', 'occupation', 'employer', 'idType',
    'idExpiry', 'notes', 'isActive', 'isDeleted', 'updatedAt',
  ]),
  InsuranceAgent: new Set([
    'agentCode', 'firstName', 'lastName', 'email', 'phone',
    'commissionRate', 'status', 'joinDate', 'address', 'notes',
    'isDeleted', 'updatedAt',
  ]),
  InsuranceProduct: new Set([
    'code', 'name', 'category', 'description', 'basePremium',
    'minCoverage', 'maxCoverage', 'excessPercent', 'deductible',
    'termsMonths', 'isActive', 'settings', 'isDeleted', 'updatedAt',
  ]),
  Quote: new Set([
    'quoteNumber', 'insuredName', 'insuredEmail', 'insuredPhone',
    'productId', 'status', 'quotedPremium', 'quotedCoverage',
    'excessAmount', 'deductibleAmount', 'validUntil',
    'convertedToPolicyId', 'notes', 'isDeleted', 'updatedAt',
  ]),
  QuoteLine: new Set([
    'quoteId', 'description', 'coverageType', 'premium', 'coverage',
    'excess', 'deductible', 'sortOrder',
  ]),
  ClaimDocument: new Set([
    'claimId', 'fileName', 'fileType', 'fileSize', 'fileUrl',
    'category', 'description', 'uploadedBy', 'isDeleted', 'updatedAt',
  ]),
  ClaimNote: new Set([
    'claimId', 'author', 'content', 'isInternal',
    'isDeleted', 'updatedAt',
  ]),
  Endorsement: new Set([
    'policyId', 'endorsementNumber', 'type', 'description',
    'premiumImpact', 'effectiveDate', 'status',
    'isDeleted', 'updatedAt',
  ]),
  PremiumSchedule: new Set([
    'policyId', 'dueDate', 'amount', 'status', 'paidDate',
    'paidAmount', 'reference', 'notes', 'isDeleted', 'updatedAt',
  ]),
  RenewalTask: new Set([
    'policyId', 'dueDate', 'status', 'assignedTo', 'notes',
    'completedDate', 'isDeleted', 'updatedAt',
  ]),
  // Events & Hospitality
  Event: new Set([
    'name', 'type', 'clientName', 'venue', 'eventDate', 'setupDate',
    'guestCount', 'budget', 'status', 'notes', 'isDeleted', 'updatedAt',
  ]),
  Venue: new Set([
    'name', 'location', 'capacity', 'contact', 'email', 'phone',
    'amenities', 'pricePerHour', 'isActive', 'isDeleted', 'updatedAt',
  ]),
  Vendor: new Set([
    'name', 'category', 'contact', 'email', 'phone',
    'rating', 'notes', 'isDeleted', 'updatedAt',
  ]),
  // Bookkeeping
  BookkeepingEntry: new Set([
    'date', 'description', 'category', 'type', 'amount',
    'currency', 'reference', 'accountId', 'isDeleted', 'updatedAt',
  ]),
  // Property Management
  Property: new Set([
    'name', 'address', 'city', 'country', 'type', 'totalArea',
    'units', 'description', 'imageUrl', 'status', 'updatedAt',
  ]),
  PropertyUnit: new Set([
    'unitNumber', 'floor', 'area', 'baseRentTTD', 'baseRentUSD',
    'status', 'amenities', 'notes', 'updatedAt',
  ]),
  Lease: new Set([
    'unitId', 'startDate', 'endDate', 'rentAmount', 'rentCurrency',
    'depositAmount', 'status', 'terms', 'notes',
    'autoRenew', 'renewalNoticeDays', 'rentIncreasePercent',
    'lastRenewedAt', 'renewalCount', 'updatedAt',
  ]),
  MaintenanceRequest: new Set([
    'title', 'description', 'category', 'priority', 'status',
    'resolvedAt', 'cost', 'vendor', 'notes', 'updatedAt',
  ]),
  LegalNotice: new Set([
    'type', 'jurisdiction', 'templateSlug', 'title', 'content',
    'sentDate', 'sentMethod', 'responseDate', 'responseNotes',
    'status', 'effectiveDate', 'expiresAt', 'updatedAt',
  ]),
  PropertyVendor: new Set([
    'propertyId', 'name', 'category', 'contact', 'email', 'phone',
    'address', 'rating', 'isActive', 'notes', 'updatedAt',
  ]),
  PropertyDocument: new Set([
    'propertyId', 'unitId', 'leaseId', 'name', 'type', 'category',
    'fileUrl', 'description', 'expiresAt', 'status', 'updatedAt',
  ]),
};

/**
 * Filter fields against a column whitelist for a given table.
 * Returns only fields whose keys are in the whitelist.
 * Prevents column name injection in dynamic SQL.
 */
export function whitelistFields(tableName: string, fields: Record<string, any>): Record<string, any> {
  const allowed = COLUMN_WHITELISTS[tableName];
  if (!allowed) {
    // If no whitelist defined for this table, allow nothing by default (fail-safe)
    console.warn(`[AUTH] No column whitelist defined for table "${tableName}". Rejecting all fields.`);
    return {};
  }
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    } else {
      console.warn(`[AUTH] Blocked column "${key}" in dynamic SQL for table "${tableName}"`);
    }
  }
  return filtered;
}

// ─── Auth Guard for API Routes ───

export interface AuthResult {
  success: boolean;
  payload: JWTPayload | null;
  error?: string;
  status?: number;
}

export function authenticateRequest(request: Request | NextRequest): AuthResult {
  const token = extractBearerToken(request);

  if (!token) {
    return { success: false, payload: null, error: 'Authentication required', status: 401 };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { success: false, payload: null, error: 'Invalid or expired token', status: 401 };
  }

  return { success: true, payload };
}

/**
 * Extract tenantId from request headers (set by middleware).
 * Returns null if not found.
 */
export function getTenantIdFromRequest(request: Request | NextRequest): string | null {
  return request.headers.get('x-tenant-id');
}

/**
 * Check if the authenticated user is a super admin (isSuperAdmin === true ONLY).
 */
export function isStrictSuperAdmin(auth: AuthResult): boolean {
  return auth.success && auth.payload?.isSuperAdmin === true;
}

// ─── Tenant Ownership Verification ───

export interface OwnershipResult {
  success: boolean;
  error?: string;
  status?: number;
}

/**
 * Verify that the authenticated user belongs to the given tenant.
 * Uses JWT tenantId claim for fast verification.
 * Super admins (isSuperAdmin === true) can access any tenant.
 */
export function verifyTenantAccess(
  auth: AuthResult,
  tenantId: string
): OwnershipResult {
  if (!auth.success) {
    return { success: false, error: auth.error, status: auth.status };
  }

  // Super admins (ONLY isSuperAdmin === true) can access any tenant
  if (auth.payload?.isSuperAdmin === true) {
    return { success: true };
  }

  if (auth.payload?.tenantId !== tenantId) {
    return { success: false, error: 'Access denied: tenant mismatch', status: 403 };
  }

  return { success: true };
}

// ─── RBAC Permission Check ───

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: ['dashboard', 'orders', 'pos', 'catalog', 'clients', 'quotes', 'invoices', 'payments', 'expenses', 'documents', 'bookkeeping', 'reports', 'settings', 'team', 'inventory', 'production', 'recipes', 'ingredients', 'stealth_finance', 'smart_import'],
  manager: ['dashboard', 'orders', 'pos', 'catalog', 'clients', 'quotes', 'invoices', 'payments', 'reports', 'inventory', 'production', 'recipes', 'ingredients'],
  baker: ['dashboard', 'orders', 'recipes', 'ingredients', 'production', 'inventory', 'kds'],
  cashier: ['pos', 'orders', 'clients', 'dashboard'],
  viewer: ['dashboard', 'reports'],
  // Insurance-specific roles
  underwriter: ['dashboard', 'policies', 'claims', 'insured', 'insurance-products', 'insurance-quotes', 'insurance-renewals', 'reports'],
  adjuster: ['dashboard', 'claims', 'insured', 'policies', 'reports'],
  agent_role: ['dashboard', 'policies', 'claims', 'insured', 'insurance-quotes', 'insurance-renewals'],
};

/**
 * Check if a role has permission for a given resource/action.
 */
export function hasPermission(role: string, resource: string, action: string = 'read'): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  if (permissions.includes('*')) return true;

  // For write operations, check with ':write' suffix
  if (action === 'write' || action === 'delete') {
    return permissions.includes(`${resource}:write`) || permissions.includes(resource);
  }

  return permissions.includes(resource);
}

/**
 * API guard that combines auth + tenant access + RBAC.
 * Returns error Response or null if all checks pass.
 */
export function apiGuard(
  request: Request | NextRequest,
  tenantId: string,
  resource: string,
  action: string = 'read'
): Response | null {
  const auth = authenticateRequest(request);

  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return new Response(JSON.stringify({ error: ownership.error }), {
      status: ownership.status || 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Super admins bypass RBAC
  if (auth.payload?.isSuperAdmin === true) return null;

  const userRole = auth.payload?.tenantRole || 'viewer';
  if (!hasPermission(userRole, resource, action)) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null; // All checks passed
}
