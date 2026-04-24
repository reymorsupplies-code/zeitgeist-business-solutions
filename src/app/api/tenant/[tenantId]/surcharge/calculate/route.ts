/**
 * Surcharge Auto-Calculate API
 *
 * POST: Calculate surcharges for all active leases for a given quarter or month.
 *
 * Logic:
 * 1. Fetch the tenant's SurchargeConfig (must exist and be applicable).
 * 2. Fetch all active leases scoped to the tenant (via property → tenantId).
 * 3. For each active lease, find all rent payments in the period.
 * 4. Calculate surcharge = baseRent * surchargeRate (with cap/floor).
 * 5. Create a SurchargeRecord for each lease.
 * 6. Return summary of all calculated surcharges.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, checkRateLimit } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { db } from '@/lib/db';

// ─── Helpers ───

function parseJsonSafe(raw: any): any {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

/** Ensure SurchargeRecord table exists */
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
  } catch (err: any) {
    console.error('[surcharge-calculate] Error ensuring tables:', err.message);
  }
}

/** Calculate period date range from year/month/quarter */
function getPeriodRange(body: any): { start: Date; end: Date; label: string } {
  const year = body.year || new Date().getFullYear();

  if (body.quarter) {
    // Quarter mode: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
    const q = Math.min(Math.max(body.quarter, 1), 4);
    const startMonth = (q - 1) * 3; // 0, 3, 6, 9
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { start, end, label: `Q${q} ${year}` };
  }

  // Month mode (default)
  const month = body.month !== undefined ? body.month : new Date().getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const monthName = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { start, end, label: monthName };
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Auto-calculate surcharges for a period
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  // Rate limit to prevent abuse
  const rateLimitResult = checkRateLimit(
    `surcharge-calc:${req.headers.get('x-forwarded-for') || 'unknown'}`,
    10,
    60_000
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    await ensureTables();

    // ─── 1. Fetch surcharge config ───
    const config = await pgQueryOne<any>(
      `SELECT * FROM "SurchargeConfig" WHERE "tenantId" = $1`,
      [tenantId]
    );

    if (!config) {
      return NextResponse.json(
        { error: 'No surcharge config found. Please create a surcharge configuration first.' },
        { status: 404 }
      );
    }

    if (!config.isApplicable) {
      return NextResponse.json(
        { error: 'Surcharge is not currently applicable (isApplicable = false). Enable it in the config.' },
        { status: 400 }
      );
    }

    const surchargeRate = Number(config.surchargeRate);
    if (surchargeRate <= 0) {
      return NextResponse.json(
        { error: 'Surcharge rate must be greater than 0.' },
        { status: 400 }
      );
    }

    // Parse exemptions
    const exemptions: string[] = parseJsonSafe(config.exemptions);
    const capAmount = config.capAmount !== null ? Number(config.capAmount) : null;
    const floorAmount = config.floorAmount !== null ? Number(config.floorAmount) : null;

    // ─── 2. Determine period ───
    const { start: periodStart, end: periodEnd, label: periodLabel } = getPeriodRange(body);

    // ─── 3. Fetch active leases scoped to this tenant ───
    const activeLeases = await db.lease.findMany({
      where: {
        status: 'active',
        unit: { property: { tenantId } },
      },
      include: { unit: { include: { property: true } } },
    });

    if (activeLeases.length === 0) {
      return NextResponse.json(
        { error: `No active leases found for this tenant.` },
        { status: 404 }
      );
    }

    // ─── 4. Process each lease ───
    const results: any[] = [];
    let totalBaseRent = 0;
    let totalSurcharge = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let exemptCount = 0;

    for (const lease of activeLeases) {
      // Check if lease is exempt
      const leasePropertyType = lease.unit?.property?.type || '';
      const isExempt = exemptions.some((ex: string) =>
        ex.toLowerCase() === leasePropertyType.toLowerCase() ||
        ex === lease.id
      );

      if (isExempt) {
        exemptCount++;
        results.push({
          leaseId: lease.id,
          unitNumber: lease.unit?.unitNumber,
          propertyName: lease.unit?.property?.name,
          status: 'exempt',
          reason: 'Lease or property type is in exemptions list',
        });
        continue;
      }

      // Check if effective date has passed
      if (new Date(config.effectiveDate) > periodEnd) {
        results.push({
          leaseId: lease.id,
          unitNumber: lease.unit?.unitNumber,
          propertyName: lease.unit?.property?.name,
          status: 'skipped',
          reason: `Surcharge not yet effective (effective: ${config.effectiveDate})`,
        });
        continue;
      }

      // Check if a record already exists for this lease/period
      const existingRecord = await pgQueryOne<any>(
        `SELECT id, status, "surchargeAmount" FROM "SurchargeRecord"
         WHERE "leaseId" = $1 AND "periodStart" = $2 AND "periodEnd" = $3`,
        [lease.id, periodStart.toISOString(), periodEnd.toISOString()]
      );

      if (existingRecord && !body.forceRecalculate) {
        skippedCount++;
        results.push({
          leaseId: lease.id,
          unitNumber: lease.unit?.unitNumber,
          propertyName: lease.unit?.property?.name,
          status: 'skipped',
          reason: 'Record already exists',
          existingRecordId: existingRecord.id,
          existingAmount: existingRecord.surchargeAmount,
        });
        continue;
      }

      // ─── 5. Find rent payments in the period ───
      const rentPayments = await db.rentPayment.findMany({
        where: {
          leaseId: lease.id,
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd },
        },
      });

      const baseRent = rentPayments.reduce(
        (sum, rp) => sum + Number(rp.amountDue || 0),
        0
      );

      if (baseRent <= 0) {
        results.push({
          leaseId: lease.id,
          unitNumber: lease.unit?.unitNumber,
          propertyName: lease.unit?.property?.name,
          status: 'skipped',
          reason: 'No rent payments found for this period',
        });
        skippedCount++;
        continue;
      }

      // ─── 6. Calculate surcharge ───
      let surchargeAmount = Math.round(baseRent * surchargeRate * 100) / 100;

      // Apply floor
      if (floorAmount !== null && surchargeAmount < floorAmount) {
        surchargeAmount = floorAmount;
      }

      // Apply cap
      if (capAmount !== null && surchargeAmount > capAmount) {
        surchargeAmount = capAmount;
      }

      // ─── 7. Create or update SurchargeRecord ───
      const propertyId = lease.unit?.propertyId || '';
      const unitId = lease.unitId || '';

      let record: any;
      if (existingRecord && body.forceRecalculate) {
        record = await pgQueryOne<any>(
          `UPDATE "SurchargeRecord" SET
             "baseRent" = $1, "surchargeRate" = $2, "surchargeAmount" = $3,
             "capAmount" = $4, "floorAmount" = $5, "periodLabel" = $6,
             "updatedAt" = NOW()
           WHERE id = $7
           RETURNING *`,
          [baseRent, surchargeRate, surchargeAmount, capAmount, floorAmount, periodLabel, existingRecord.id]
        );
        results.push({
          leaseId: lease.id,
          unitNumber: lease.unit?.unitNumber,
          propertyName: lease.unit?.property?.name,
          status: 'recalculated',
          recordId: record.id,
          baseRent,
          surchargeRate,
          surchargeAmount,
        });
      } else {
        record = await pgQueryOne<any>(
          `INSERT INTO "SurchargeRecord" (
            "tenantId", "configId", "leaseId", "propertyId", "unitId",
            "periodStart", "periodEnd", "periodLabel", "baseRent",
            "surchargeRate", "surchargeAmount", "capAmount", "floorAmount",
            status, currency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *`,
          [
            tenantId, config.id, lease.id, propertyId, unitId,
            periodStart.toISOString(), periodEnd.toISOString(), periodLabel,
            baseRent, surchargeRate, surchargeAmount, capAmount, floorAmount,
            'pending', config.currency || 'TTD',
          ]
        );
        createdCount++;
        results.push({
          leaseId: lease.id,
          unitNumber: lease.unit?.unitNumber,
          propertyName: lease.unit?.property?.name,
          status: 'created',
          recordId: record.id,
          baseRent,
          surchargeRate,
          surchargeAmount,
        });
      }

      totalBaseRent += baseRent;
      totalSurcharge += surchargeAmount;
    }

    // ─── 8. Return summary ───
    return NextResponse.json({
      period: {
        label: periodLabel,
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      config: {
        id: config.id,
        surchargeRate,
        currency: config.currency || 'TTD',
        capAmount,
        floorAmount,
        exemptionCount: exemptions.length,
      },
      summary: {
        totalLeases: activeLeases.length,
        created: createdCount,
        skipped: skippedCount,
        exempt: exemptCount,
        totalBaseRent: Math.round(totalBaseRent * 100) / 100,
        totalSurcharge: Math.round(totalSurcharge * 100) / 100,
      },
      details: results,
    });
  } catch (error: any) {
    console.error('[surcharge-calculate] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
