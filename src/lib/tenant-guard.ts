/**
 * Tenant Guard Module
 *
 * Reusable helpers to enforce tenant isolation in API route handlers.
 * Use these in PUT / DELETE handlers that receive `req: NextRequest` without
 * params, where tenantId must be extracted from the `x-tenant-id` header.
 *
 * Usage example (PUT handler):
 *   import { requireTenantAuth, tenantWhere, tenantSqlWhere, whitelistFields } from '@/lib/tenant-guard';
 *
 *   export async function PUT(req: NextRequest) {
 *     const guard = requireTenantAuth(req);
 *     if (guard.error) return guard.error;
 *     const { tenantId, auth } = guard;
 *
 *     const { id, ...fields } = await req.json();
 *     if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
 *
 *     const safe = whitelistFields('CatalogItem', fields);
 *
 *     try {
 *       const updated = await db.catalogItem.update({
 *         where: { id, tenantId },
 *         data: safe,
 *       });
 *       return NextResponse.json(updated);
 *     } catch {
 *       try {
 *         const setParts: string[] = [];
 *         const paramValues: any[] = [];
 *         let pIdx = 1;
 *         for (const [k, v] of Object.entries(safe)) {
 *           setParts.push(`"${k}" = $${pIdx++}`);
 *           paramValues.push(v);
 *         }
 *         setParts.push(`"updatedAt" = NOW()`);
 *         paramValues.push(id);
 *         await pgQuery(
 *           `UPDATE "CatalogItem" SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1}`,
 *           [...paramValues, tenantId],
 *         );
 *         const updated = await pgQueryOne(
 *           `SELECT * FROM "CatalogItem" WHERE id = $1 AND "tenantId" = $2`,
 *           [id, tenantId],
 *         );
 *         return NextResponse.json(updated);
 *       } catch (err: any) {
 *         return NextResponse.json({ error: err.message }, { status: 500 });
 *       }
 *     }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  verifyTenantAccess,
  type AuthResult,
} from '@/lib/auth';

// ─── Types ───

/** Successful guard result — carries both tenantId and the auth payload. */
export interface TenantGuardSuccess {
  tenantId: string;
  auth: AuthResult;
}

/** Error-shaped return — the caller spreads or returns this directly. */
export interface TenantGuardError {
  error: NextResponse;
}

/** Discriminated union returned by the guard helpers. */
export type TenantGuardResult = TenantGuardSuccess | TenantGuardError;

// ─── Type Guards ───

function isErrorResponse(result: TenantGuardResult): result is TenantGuardError {
  return 'error' in result;
}

// ─── Core Helpers ───

/**
 * Extract tenantId from the `x-tenant-id` request header.
 *
 * Returns the tenantId string if present, or a JSON error Response
 * (`400 Tenant ID required`) that the caller should return immediately.
 *
 * @example
 *   const tenantId = requireTenantId(req);
 *   if (tenantId instanceof Response) return tenantId;
 *   // tenantId is now a string
 */
export function requireTenantId(req: NextRequest): string | NextResponse {
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant ID required' },
      { status: 400 },
    );
  }
  return tenantId;
}

/**
 * Authenticate the request and extract tenantId from headers.
 *
 * Combines `authenticateRequest` + header-based tenantId extraction.
 * Does NOT perform ownership verification — the caller can add that
 * separately if needed (e.g. for super-admin cross-tenant access).
 *
 * @returns On success: `{ tenantId, auth }`. On failure: `{ error }`.
 *
 * @example
 *   const guard = requireTenantAuth(req);
 *   if (guard.error) return guard.error;
 *   const { tenantId, auth } = guard;
 */
export function requireTenantAuth(req: NextRequest): TenantGuardResult {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return {
      error: NextResponse.json(
        { error: auth.error },
        { status: auth.status || 401 },
      ),
    };
  }

  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) {
    return {
      error: NextResponse.json(
        { error: 'Tenant ID required' },
        { status: 400 },
      ),
    };
  }

  return { tenantId, auth };
}

/**
 * Authenticate + extract tenantId + verify the user owns the tenant.
 *
 * The strictest guard — rejects any request where the JWT tenantId claim
 * does not match the header tenantId (unless the user is a super admin).
 *
 * @returns On success: `{ tenantId, auth }`. On failure: `{ error }`.
 *
 * @example
 *   const guard = requireTenantAuthStrict(req);
 *   if (guard.error) return guard.error;
 *   const { tenantId } = guard;
 */
export function requireTenantAuthStrict(req: NextRequest): TenantGuardResult {
  const guard = requireTenantAuth(req);
  if (isErrorResponse(guard)) return guard;

  const { tenantId, auth } = guard;
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return {
      error: NextResponse.json(
        { error: ownership.error },
        { status: ownership.status || 403 },
      ),
    };
  }

  return { tenantId, auth };
}

// ─── Prisma Helpers ───

/**
 * Returns a Prisma `where` clause object that includes tenantId.
 * Merge this with any additional filter conditions using spread.
 *
 * @example
 *   const where = tenantWhere(tenantId, { id });
 *   // => { id, tenantId }
 *
 *   const where = tenantWhere(tenantId, { isDeleted: false });
 *   // => { tenantId, isDeleted: false }
 */
export function tenantWhere(
  tenantId: string,
  additional?: Record<string, unknown>,
): Record<string, unknown> {
  return additional ? { ...additional, tenantId } : { tenantId };
}

/**
 * Returns a Prisma query object to find a single record scoped to a tenant.
 * Use before an update or delete to verify ownership.
 *
 * @example
 *   const record = await db.invoice.findFirst(
 *     applyTenantIsolation(tenantId, { id }),
 *   );
 *   if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
 */
export function applyTenantIsolation(
  tenantId: string,
  additional?: Record<string, unknown>,
): { where: Record<string, unknown> } {
  return { where: tenantWhere(tenantId, additional) };
}

// ─── SQL Helpers ───

/**
 * Build a SQL WHERE clause fragment with a tenantId condition.
 *
 * @param column   - The SQL column name for the tenant ID (default `"tenantId"`).
 * @param paramIdx - The current $N parameter index. The tenantId param will
 *                   use `paramIdx` and the return value tells you the next index.
 * @param extra    - Optional additional WHERE condition string (e.g. `"id = $1"`).
 *
 * @returns An object with `clause` (the full WHERE string) and `nextIdx`.
 *
 * @example
 *   const { clause, nextIdx } = tenantSqlWhere(2);
 *   // clause = 'WHERE "tenantId" = $2'
 *   // nextIdx = 3
 *
 *   const { clause, nextIdx } = tenantSqlWhere(2, '"tenantId"', 'id = $1');
 *   // clause = 'WHERE id = $1 AND "tenantId" = $2'
 *   // nextIdx = 3
 */
export function tenantSqlWhere(
  paramIdx: number,
  column: string = '"tenantId"',
  extra?: string,
): { clause: string; nextIdx: number } {
  const parts: string[] = [];
  if (extra) parts.push(extra);
  parts.push(`${column} = $${paramIdx}`);
  return {
    clause: `WHERE ${parts.join(' AND ')}`,
    nextIdx: paramIdx + 1,
  };
}

/**
 * Appends a `AND "tenantId" = $N` clause to an existing WHERE string.
 *
 * @example
 *   const { clause, nextIdx } = appendTenantFilter('WHERE id = $1', 2);
 *   // clause = 'WHERE id = $1 AND "tenantId" = $2'
 *   // nextIdx = 3
 */
export function appendTenantFilter(
  existingWhere: string,
  paramIdx: number,
  column: string = '"tenantId"',
): { clause: string; nextIdx: number } {
  // Strip leading WHERE if present (we'll re-add it)
  const stripped = existingWhere.replace(/^WHERE\s+/i, '').trim();
  const clause = `WHERE ${stripped} AND ${column} = $${paramIdx}`;
  return { clause, nextIdx: paramIdx + 1 };
}

// ─── Re-export whitelistFields for convenience ───

export { whitelistFields } from '@/lib/auth';
