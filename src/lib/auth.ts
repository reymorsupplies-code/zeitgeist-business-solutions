/**
 * ZBS Authentication & Security Module
 * - bcrypt password hashing
 * - JWT token issuance & verification
 * - Rate limiting (in-memory)
 * - Input validation helpers
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zbs-secret-change-in-production-' + (process.env.DATABASE_URL || 'fallback');
const JWT_EXPIRES_IN = '24h';
const BCRYPT_ROUNDS = 12;

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function extractBearerToken(request: Request | NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Also check cookie for SSR compatibility
  if (request instanceof Request) {
    // NextRequest has cookies
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
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export function validateRequiredFields(data: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      return field;
    }
  }
  return null;
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

// ─── Tenant Ownership Verification ───

export interface OwnershipResult {
  success: boolean;
  error?: string;
  status?: number;
}

/**
 * Verify that the authenticated user belongs to the given tenant.
 * Uses JWT tenantId claim for fast verification.
 */
export function verifyTenantAccess(
  auth: AuthResult,
  tenantId: string
): OwnershipResult {
  if (!auth.success) {
    return { success: false, error: auth.error, status: auth.status };
  }

  // Super admins can access any tenant
  if (auth.payload?.isSuperAdmin) {
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
  if (auth.payload?.isSuperAdmin) return null;

  const userRole = auth.payload?.tenantRole || 'viewer';
  if (!hasPermission(userRole, resource, action)) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null; // All checks passed
}
