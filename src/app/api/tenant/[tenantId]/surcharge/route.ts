/**
 * Landlord Surcharge Compliance API — Trinidad & Tobago
 *
 * Effective January 2026 per the Residential Tenancies Act.
 *
 * GET  — List surcharge records (with filters). Also returns surcharge config.
 * POST — Create surcharge config OR calculate surcharges for a period.
 * PUT  — Update surcharge config (rate, exemptions).
 * DELETE — Not allowed (compliance records are immutable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { db } from '@/lib/db';

// ─── Helpers ───

function parseJsonSafe(raw: any): any {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

/** Ensure tables exist (idempotent, lazy) */
async function ensureTables(): Promise<void> {
  try {
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "SurchargeConfig" (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"      TEXT NOT NULL,
        "surchargeRate" NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
        "effectiveDate" TIMESTAMPTZ NOT NULL DEFAULT '2026-01-01 00:00:00+00',
        "isApplicable"  BOOLEAN NOT NULL DEFAULT false,
        currency        TEXT NOT NULL DEFAULT 'TTD',
        exemptions      TEXT NOT NULL DEFAULT '[]',
        "capAmount"     NUMERIC(14,2),
        "floorAmount"   NUMERIC(14,2),
        notes           TEXT,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "SurchargeConfig_tenantId_key" UNIQUE ("tenantId")
      );
    `);
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "SurchargeRecord" (
        id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"        TEXT NOT NULL,
        "configId"        TEXT NOT NULL REFERENCES "SurchargeConfig"(id) ON DELETE RESTRICT,
        "leaseId"         TEXT NOT NULL,
        "propertyId"      TEXT NOT NULL,
        "unitId"          TEXT NOT NULL,
        "periodStart"     TIMESTAMPTZ NOT NULL,
        "periodEnd"       TIMESTAMPTZ NOT NULL,
        "periodLabel"     TEXT,
        "baseRent"        NUMERIC(14,2) NOT NULL DEFAULT 0,
        "surchargeRate"   NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
        "surchargeAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
        "capAmount"       NUMERIC(14,2),
        "floorAmount"     NUMERIC(14,2),
        status            TEXT NOT NULL DEFAULT 'pending',
        "collectedAt"     TIMESTAMPTZ,
        "remittedAt"      TIMESTAMPTZ,
        "remittanceRef"   TEXT,
        currency          TEXT NOT NULL DEFAULT 'TTD',
        notes             TEXT,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "SurchargeRecord_lease_period_key" UNIQUE ("leaseId", "periodStart", "periodEnd")
      );
    `);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_tenantId" ON "SurchargeRecord"("tenantId")`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_configId" ON "SurchargeRecord"("configId")`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_leaseId" ON "SurchargeRecord"("leaseId")`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_propertyId" ON "SurchargeRecord"("propertyId")`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_SurchargeRecord_status" ON "SurchargeRecord"("tenantId", status)`);
  } catch (err: any) {
    console.error('[surcharge] Error ensuring tables:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET — List surcharge records + config
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTables();

    const { searchParams } = new URL(req.url);
    const leaseId = searchParams.get('leaseId');
    const status = searchParams.get('status');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const propertyId = searchParams.get('propertyId');

    // Build dynamic WHERE clause safely
    const conditions: string[] = [`sr."tenantId" = $1`];
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (leaseId) {
      conditions.push(`sr."leaseId" = $${paramIdx++}`);
      params.push(leaseId);
    }
    if (status && status !== 'all') {
      conditions.push(`sr.status = $${paramIdx++}`);
      params.push(status);
    }
    if (periodStart) {
      conditions.push(`sr."periodStart" >= $${paramIdx++}`);
      params.push(new Date(periodStart).toISOString());
    }
    if (periodEnd) {
      conditions.push(`sr."periodEnd" <= $${paramIdx++}`);
      params.push(new Date(periodEnd).toISOString());
    }
    if (propertyId) {
      conditions.push(`sr."propertyId" = $${paramIdx++}`);
      params.push(propertyId);
    }

    const whereClause = conditions.join(' AND ');

    // Fetch surcharge records with lease and property info
    const records = await pgQuery<any>(
      `SELECT sr.*,
              l."rentAmount" AS "leaseRentAmount", l."rentCurrency" AS "leaseRentCurrency",
              l."startDate" AS "leaseStartDate", l."endDate" AS "leaseEndDate", l.status AS "leaseStatus",
              pu."unitNumber" AS "unitNumber",
              p.name AS "propertyName", p.address AS "propertyAddress", p.city AS "propertyCity"
       FROM "SurchargeRecord" sr
       LEFT JOIN "Lease" l ON l.id = sr."leaseId"
       LEFT JOIN "PropertyUnit" pu ON pu.id = sr."unitId"
       LEFT JOIN "Property" p ON p.id = sr."propertyId"
       WHERE ${whereClause}
       ORDER BY sr."periodStart" DESC, sr."createdAt" DESC`,
      params
    );

    // Fetch surcharge config for this tenant
    const config = await pgQueryOne<any>(
      `SELECT * FROM "SurchargeConfig" WHERE "tenantId" = $1`,
      [tenantId]
    );

    // Fetch summary counts
    const summary = await pgQueryOne<any>(
      `SELECT
         COUNT(*) FILTER (WHERE sr.status = 'pending') AS "pendingCount",
         COUNT(*) FILTER (WHERE sr.status = 'collected') AS "collectedCount",
         COUNT(*) FILTER (WHERE sr.status = 'overdue') AS "overdueCount",
         COUNT(*) FILTER (WHERE sr.status = 'waived') AS "waivedCount",
         COUNT(*) FILTER (WHERE sr.status = 'remitted') AS "remittedCount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'pending'), 0) AS "pendingAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'collected'), 0) AS "collectedAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'overdue'), 0) AS "overdueAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'remitted'), 0) AS "remittedAmount"
       FROM "SurchargeRecord" sr
       WHERE sr."tenantId" = $1`,
      [tenantId]
    );

    return NextResponse.json({
      config,
      records,
      summary,
    });
  } catch (error: any) {
    console.error('[surcharge] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Create surcharge config OR trigger calculation
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    await ensureTables();

    const action = body.action || 'createConfig';

    if (action === 'createConfig' || action === 'upsertConfig') {
      // ─── Create or upsert surcharge config ───
      const surchargeRate = Number(body.surchargeRate) || 0;
      const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate).toISOString() : '2026-01-01T00:00:00.000Z';
      const isApplicable = body.isApplicable === true;
      const currency = body.currency || 'TTD';
      const exemptions = JSON.stringify(body.exemptions || []);
      const capAmount = body.capAmount !== undefined ? Number(body.capAmount) : null;
      const floorAmount = body.floorAmount !== undefined ? Number(body.floorAmount) : null;
      const notes = body.notes || null;

      // Check if config already exists
      const existing = await pgQueryOne<any>(
        `SELECT id FROM "SurchargeConfig" WHERE "tenantId" = $1`,
        [tenantId]
      );

      let config: any;
      if (existing && action === 'upsertConfig') {
        // Update existing
        config = await pgQueryOne<any>(
          `UPDATE "SurchargeConfig" SET
             "surchargeRate" = $1, "effectiveDate" = $2, "isApplicable" = $3,
             currency = $4, exemptions = $5, "capAmount" = $6, "floorAmount" = $7,
             notes = $8, "updatedAt" = NOW()
           WHERE "tenantId" = $9
           RETURNING *`,
          [surchargeRate, effectiveDate, isApplicable, currency, exemptions, capAmount, floorAmount, notes, tenantId]
        );
      } else if (existing) {
        return NextResponse.json(
          { error: 'Surcharge config already exists. Use action: "upsertConfig" to update.' },
          { status: 409 }
        );
      } else {
        // Create new
        config = await pgQueryOne<any>(
          `INSERT INTO "SurchargeConfig" (
            "tenantId", "surchargeRate", "effectiveDate", "isApplicable",
            currency, exemptions, "capAmount", "floorAmount", notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [tenantId, surchargeRate, effectiveDate, isApplicable, currency, exemptions, capAmount, floorAmount, notes]
        );
      }

      return NextResponse.json(config);
    }

    if (action === 'createRecord') {
      // ─── Manually create a single surcharge record ───
      const configId = body.configId;
      const leaseId = body.leaseId;
      const propertyId = body.propertyId;
      const unitId = body.unitId;
      const periodStart = body.periodStart ? new Date(body.periodStart).toISOString() : null;
      const periodEnd = body.periodEnd ? new Date(body.periodEnd).toISOString() : null;
      const baseRent = Number(body.baseRent) || 0;
      const surchargeRate = Number(body.surchargeRate) || 0;
      const surchargeAmount = Number(body.surchargeAmount) || 0;

      if (!configId || !leaseId || !propertyId || !unitId || !periodStart || !periodEnd) {
        return NextResponse.json(
          { error: 'configId, leaseId, propertyId, unitId, periodStart, and periodEnd are required' },
          { status: 400 }
        );
      }

      const record = await pgQueryOne<any>(
        `INSERT INTO "SurchargeRecord" (
          "tenantId", "configId", "leaseId", "propertyId", "unitId",
          "periodStart", "periodEnd", "periodLabel", "baseRent",
          "surchargeRate", "surchargeAmount", status, currency, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          tenantId, configId, leaseId, propertyId, unitId,
          periodStart, periodEnd, body.periodLabel || null, baseRent,
          surchargeRate, surchargeAmount, body.status || 'pending', body.currency || 'TTD', body.notes || null,
        ]
      );

      return NextResponse.json(record);
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Use "createConfig", "upsertConfig", or "createRecord".` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[surcharge] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT — Update surcharge config
// ═══════════════════════════════════════════════════════════════════════════════

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    await ensureTables();

    const configId = body.id;
    if (!configId) {
      return NextResponse.json({ error: 'Config ID required' }, { status: 400 });
    }

    // Verify config belongs to this tenant
    const existing = await pgQueryOne<any>(
      `SELECT id FROM "SurchargeConfig" WHERE id = $1 AND "tenantId" = $2`,
      [configId, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Surcharge config not found' }, { status: 404 });
    }

    // Build SET clause dynamically
    const setClauses: string[] = [`"updatedAt" = NOW()`];
    const params: any[] = [];
    let paramIdx = 1;

    if (body.surchargeRate !== undefined) {
      setClauses.push(`"surchargeRate" = $${paramIdx++}`);
      params.push(Number(body.surchargeRate));
    }
    if (body.effectiveDate !== undefined) {
      setClauses.push(`"effectiveDate" = $${paramIdx++}`);
      params.push(new Date(body.effectiveDate).toISOString());
    }
    if (body.isApplicable !== undefined) {
      setClauses.push(`"isApplicable" = $${paramIdx++}`);
      params.push(body.isApplicable === true);
    }
    if (body.currency !== undefined) {
      setClauses.push(`currency = $${paramIdx++}`);
      params.push(body.currency);
    }
    if (body.exemptions !== undefined) {
      setClauses.push(`exemptions = $${paramIdx++}`);
      params.push(JSON.stringify(body.exemptions));
    }
    if (body.capAmount !== undefined) {
      setClauses.push(`"capAmount" = $${paramIdx++}`);
      params.push(body.capAmount !== null ? Number(body.capAmount) : null);
    }
    if (body.floorAmount !== undefined) {
      setClauses.push(`"floorAmount" = $${paramIdx++}`);
      params.push(body.floorAmount !== null ? Number(body.floorAmount) : null);
    }
    if (body.notes !== undefined) {
      setClauses.push(`notes = $${paramIdx++}`);
      params.push(body.notes);
    }

    params.push(configId, tenantId);

    const updated = await pgQueryOne<any>(
      `UPDATE "SurchargeConfig" SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx++} AND "tenantId" = $${paramIdx}
       RETURNING *`,
      params
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[surcharge] PUT error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE — Not allowed (compliance records are immutable)
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  return NextResponse.json(
    { error: 'DELETE not allowed: Surcharge compliance records are immutable for audit purposes.' },
    { status: 405 }
  );
}
