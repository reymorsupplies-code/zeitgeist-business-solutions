/**
 * ZBS Insurance Security Module
 * PII encryption, audit logging, data masking for insurance industry compliance
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.INSURANCE_ENCRYPTION_KEY ||
  crypto.randomBytes(32).toString('hex'); // Fallback: generate if not set (dev only)
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive PII fields (national ID, date of birth, etc.)
 * Uses AES-256-GCM for authenticated encryption
 */
export function encryptPII(plaintext: string): string {
  if (!plaintext) return '';
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt PII fields
 */
export function decryptPII(encrypted: string): string {
  if (!encrypted || !encrypted.includes(':')) return encrypted;
  try {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const [ivHex, tagHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '[ENCRYPTED]'; // Return placeholder if decryption fails
  }
}

/**
 * Mask national ID — show only last 4 characters
 * Example: "12345678901" → "*******8901"
 */
export function maskNationalId(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 4) return id;
  return '*'.repeat(id.length - 4) + id.slice(-4);
}

/**
 * Mask date of birth — show only year
 * Example: "1985-03-15" → "1985"
 */
export function maskDateOfBirth(dob: string | null | undefined): string {
  if (!dob) return '—';
  return dob.split('-')[0] || dob;
}

/**
 * Sanitize insurance-specific fields
 * Removes any potential SQL injection or XSS from claim descriptions, notes, etc.
 */
export function sanitizeInsuranceInput(input: string): string {
  return input
    .replace(/[<>'";&\\]/g, '') // Remove dangerous chars
    .replace(/javascript:/gi, '') // Remove JS injection
    .replace(/data:/gi, '')      // Remove data URI
    .trim()
    .slice(0, 10000); // Limit length
}

/**
 * Validate claim amount — prevent absurd values
 */
export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= 0 && amount <= 100_000_000;
}

/**
 * Validate national ID format for Trinidad & Tobago
 * T&T National ID is 8 digits
 */
export function isValidTTNationalId(id: string): boolean {
  return /^\d{8}$/.test(id.replace(/[-\s]/g, ''));
}

/**
 * Validate policy number format
 * Must be alphanumeric, 3-20 chars
 */
export function isValidPolicyNumber(num: string): boolean {
  return /^[A-Za-z0-9\-/]{3,20}$/.test(num);
}

/**
 * Generate audit log entry for insurance operations
 */
export function createInsuranceAuditEntry(
  action: string,
  entityType: 'policy' | 'claim' | 'quote' | 'insured' | 'agent' | 'product',
  entityId: string,
  userId: string,
  tenantId: string,
  details?: Record<string, any>
): {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  tenantId: string;
  timestamp: string;
  details: Record<string, any>;
} {
  return {
    action, // create, update, delete, status_change, document_upload, note_add, claim_assign, policy_renew, quote_convert
    entityType,
    entityId,
    userId,
    tenantId,
    timestamp: new Date().toISOString(),
    details: details || {},
  };
}

/**
 * Insurance RBAC permissions matrix
 * Defines what each role can do within the insurance module
 */
export const INSURANCE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    'policies:read', 'policies:write', 'policies:delete',
    'claims:read', 'claims:write', 'claims:delete', 'claims:approve', 'claims:settle',
    'insured:read', 'insured:write', 'insured:delete',
    'agents:read', 'agents:write', 'agents:delete',
    'products:read', 'products:write', 'products:delete',
    'quotes:read', 'quotes:write', 'quotes:delete', 'quotes:convert',
    'renewals:read', 'renewals:write',
    'endorsements:read', 'endorsements:write',
    'premium_schedules:read', 'premium_schedules:write',
    'reports:read', 'reports:export',
  ],
  admin: [
    'policies:read', 'policies:write',
    'claims:read', 'claims:write', 'claims:approve',
    'insured:read', 'insured:write',
    'agents:read', 'agents:write',
    'products:read', 'products:write',
    'quotes:read', 'quotes:write', 'quotes:convert',
    'renewals:read', 'renewals:write',
    'endorsements:read', 'endorsements:write',
    'premium_schedules:read', 'premium_schedules:write',
    'reports:read',
  ],
  underwriter: [
    'policies:read', 'policies:write',
    'claims:read', 'claims:write',
    'insured:read', 'insured:write',
    'products:read',
    'quotes:read', 'quotes:write', 'quotes:convert',
    'renewals:read', 'renewals:write',
    'reports:read',
  ],
  adjuster: [
    'claims:read', 'claims:write',
    'insured:read',
    'policies:read',
    'reports:read',
  ],
  agent_role: [
    'policies:read',
    'claims:read',
    'insured:read', 'insured:write',
    'quotes:read', 'quotes:write',
    'renewals:read',
  ],
  viewer: [
    'policies:read',
    'claims:read',
    'insured:read',
    'products:read',
    'reports:read',
  ],
};

/**
 * Check if a role has a specific insurance permission
 */
export function hasInsurancePermission(role: string, permission: string): boolean {
  const perms = INSURANCE_PERMISSIONS[role] || INSURANCE_PERMISSIONS['viewer'] || [];
  return perms.includes('*') || perms.includes(permission);
}
