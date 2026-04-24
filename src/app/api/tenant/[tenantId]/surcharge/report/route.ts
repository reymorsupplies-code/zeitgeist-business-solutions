/**
 * Surcharge Compliance Report API — Trinidad & Tobago
 *
 * GET: Generate compliance report for a period.
 *
 * Returns:
 * - Total surcharges calculated, collected vs pending amounts
 * - Breakdown by property
 * - Breakdown by unit
 * - Compliance summary for BIR (Board of Inland Revenue) filing
 * - Filing deadline calculations
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── Helpers ───

function parseJsonSafe(raw: any): any {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

/** Ensure tables exist */
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
    console.error('[surcharge-report] Error ensuring tables:', err.message);
  }
}

/** BIR filing deadline: 28th of the month following the period end */
function getFilingDeadline(periodEnd: Date): Date {
  const deadline = new Date(periodEnd);
  deadline.setMonth(deadline.getMonth() + 1, 28);
  return deadline;
}

/** Get BIR surcharge filing period labels */
function getFilingPeriodLabel(periodStart: Date, periodEnd: Date): string {
  const startMonth = periodStart.toLocaleDateString('en-US', { month: 'long' });
  const endMonth = periodEnd.toLocaleDateString('en-US', { month: 'long' });
  const year = periodStart.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${year}`;
  }

  // Check if it's a quarter
  const monthDiff = (periodEnd.getMonth() - periodStart.getMonth() + 12) % 12 + 1;
  if (monthDiff === 3 && periodStart.getMonth() % 3 === 0) {
    const q = Math.floor(periodStart.getMonth() / 3) + 1;
    return `Q${q} ${year}`;
  }

  return `${startMonth} - ${endMonth} ${year}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Compliance Report
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
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'periodStart and periodEnd query parameters are required (ISO date format).' },
        { status: 400 }
      );
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    // ─── 1. Fetch surcharge config ───
    const config = await pgQueryOne<any>(
      `SELECT * FROM "SurchargeConfig" WHERE "tenantId" = $1`,
      [tenantId]
    );

    // ─── 2. Overall totals ───
    const totals = await pgQueryOne<any>(
      `SELECT
         COUNT(*) AS "totalRecords",
         COALESCE(SUM(sr."baseRent"), 0) AS "totalBaseRent",
         COALESCE(SUM(sr."surchargeAmount"), 0) AS "totalSurchargeAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'pending'), 0) AS "pendingAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'collected'), 0) AS "collectedAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'overdue'), 0) AS "overdueAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'waived'), 0) AS "waivedAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'remitted'), 0) AS "remittedAmount",
         COUNT(*) FILTER (WHERE sr.status = 'pending') AS "pendingCount",
         COUNT(*) FILTER (WHERE sr.status = 'collected') AS "collectedCount",
         COUNT(*) FILTER (WHERE sr.status = 'overdue') AS "overdueCount",
         COUNT(*) FILTER (WHERE sr.status = 'waived') AS "waivedCount",
         COUNT(*) FILTER (WHERE sr.status = 'remitted') AS "remittedCount"
       FROM "SurchargeRecord" sr
       WHERE sr."tenantId" = $1
         AND sr."periodStart" >= $2
         AND sr."periodEnd" <= $3`,
      [tenantId, startDate.toISOString(), endDate.toISOString()]
    );

    // ─── 3. Breakdown by property ───
    const byProperty = await pgQuery<any>(
      `SELECT
         p.id AS "propertyId",
         p.name AS "propertyName",
         p.address AS "propertyAddress",
         p.city AS "propertyCity",
         p.type AS "propertyType",
         COUNT(sr.id) AS "recordCount",
         COALESCE(SUM(sr."baseRent"), 0) AS "totalBaseRent",
         COALESCE(SUM(sr."surchargeAmount"), 0) AS "totalSurcharge",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'collected'), 0) AS "collectedAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'pending'), 0) AS "pendingAmount",
         COALESCE(SUM(sr."surchargeAmount") FILTER (WHERE sr.status = 'remitted'), 0) AS "remittedAmount"
       FROM "SurchargeRecord" sr
       LEFT JOIN "Property" p ON p.id = sr."propertyId"
       WHERE sr."tenantId" = $1
         AND sr."periodStart" >= $2
         AND sr."periodEnd" <= $3
       GROUP BY p.id, p.name, p.address, p.city, p.type
       ORDER BY "totalSurcharge" DESC`,
      [tenantId, startDate.toISOString(), endDate.toISOString()]
    );

    // ─── 4. Breakdown by unit ───
    const byUnit = await pgQuery<any>(
      `SELECT
         sr."unitId",
         pu."unitNumber",
         p.name AS "propertyName",
         l.id AS "leaseId",
         l.status AS "leaseStatus",
         sr."periodLabel",
         sr."baseRent",
         sr."surchargeRate",
         sr."surchargeAmount",
         sr.status,
         sr."collectedAt",
         sr."remittedAt",
         sr."remittanceRef"
       FROM "SurchargeRecord" sr
       LEFT JOIN "PropertyUnit" pu ON pu.id = sr."unitId"
       LEFT JOIN "Property" p ON p.id = sr."propertyId"
       LEFT JOIN "Lease" l ON l.id = sr."leaseId"
       WHERE sr."tenantId" = $1
         AND sr."periodStart" >= $2
         AND sr."periodEnd" <= $3
       ORDER BY p.name, pu."unitNumber", sr."periodStart"`,
      [tenantId, startDate.toISOString(), endDate.toISOString()]
    );

    // ─── 5. Collection rate analysis ───
    const totalSurcharges = Number(totals?.totalSurchargeAmount || 0);
    const collectedSurcharges = Number(totals?.collectedAmount || 0);
    const remittedSurcharges = Number(totals?.remittedAmount || 0);
    const pendingSurcharges = Number(totals?.pendingAmount || 0);
    const overdueSurcharges = Number(totals?.overdueAmount || 0);

    const collectionRate = totalSurcharges > 0
      ? Math.round((collectedSurcharges / totalSurcharges) * 10000) / 100
      : 0;
    const remittanceRate = totalSurcharges > 0
      ? Math.round((remittedSurcharges / totalSurcharges) * 10000) / 100
      : 0;
    const complianceRate = totalSurcharges > 0
      ? Math.round(((collectedSurcharges + remittedSurcharges) / totalSurcharges) * 10000) / 100
      : 100;

    // ─── 6. BIR filing summary ───
    const filingDeadline = getFilingDeadline(endDate);
    const filingPeriodLabel = getFilingPeriodLabel(startDate, endDate);
    const now = new Date();
    const isOverdue = now > filingDeadline;
    const daysUntilDeadline = Math.max(0, Math.ceil((filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate the amount due for remittance (collected but not yet remitted)
    const dueForRemittance = Math.max(0, collectedSurcharges - remittedSurcharges);

    const birFiling = {
      periodLabel: filingPeriodLabel,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      filingDeadline: filingDeadline.toISOString(),
      isOverdue,
      daysUntilDeadline,
      surchargeRate: config ? Number(config.surchargeRate) : 0,
      currency: config?.currency || 'TTD',
      totalSurchargeCollected: collectedSurcharges,
      totalSurchargeRemitted: remittedSurcharges,
      totalSurchargePending: pendingSurcharges,
      totalSurchargeOverdue: overdueSurcharges,
      amountDueForRemittance: Math.round(dueForRemittance * 100) / 100,
      totalRecords: totals?.totalRecords || 0,
      status: isOverdue
        ? (remittedSurcharges >= collectedSurcharges ? 'filed_late' : 'overdue')
        : (remittedSurcharges >= collectedSurcharges ? 'filed' : 'pending_filing'),
    };

    // ─── 7. Alerts and recommendations ───
    const alerts: string[] = [];
    const recommendations: string[] = [];

    if (isOverdue && dueForRemittance > 0) {
      alerts.push(
        `Surcharge filing for ${filingPeriodLabel} is overdue. Deadline was ${filingDeadline.toLocaleDateString('en-TT')}. Amount due: TT$${dueForRemittance.toLocaleString()}.`
      );
      recommendations.push('Remit surcharge amounts to the Board of Inland Revenue immediately to avoid penalties.');
    } else if (daysUntilDeadline <= 14 && dueForRemittance > 0) {
      alerts.push(
        `Surcharge filing deadline for ${filingPeriodLabel} is in ${daysUntilDeadline} days (${filingDeadline.toLocaleDateString('en-TT')}).`
      );
    }

    if (overdueSurcharges > 0) {
      alerts.push(
        `TT$${overdueSurcharges.toLocaleString()} in surcharges are overdue from tenants.`
      );
      recommendations.push('Follow up with tenants who have overdue surcharge payments.');
    }

    if (pendingSurcharges > 0 && !isOverdue) {
      recommendations.push(
        `TT$${pendingSurcharges.toLocaleString()} in surcharges are still pending collection.`
      );
    }

    if (collectionRate < 80 && totalSurcharges > 0) {
      alerts.push(`Collection rate is ${collectionRate}% — below the 80% threshold.`);
      recommendations.push('Review lease terms and payment reminders for tenants with outstanding surcharges.');
    }

    if (!config) {
      alerts.push('No surcharge configuration found for this tenant.');
      recommendations.push('Create a surcharge configuration to begin tracking compliance.');
    } else if (!config.isApplicable) {
      recommendations.push('Surcharge collection is currently disabled. Enable it in the surcharge config when ready.');
    }

    // ─── 8. Compile report ───
    return NextResponse.json({
      reportMeta: {
        tenantId,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          label: filingPeriodLabel,
        },
        generatedAt: new Date().toISOString(),
        currency: config?.currency || 'TTD',
      },
      config: config ? {
        id: config.id,
        surchargeRate: Number(config.surchargeRate),
        effectiveDate: config.effectiveDate,
        isApplicable: config.isApplicable,
        capAmount: config.capAmount,
        floorAmount: config.floorAmount,
        exemptions: parseJsonSafe(config.exemptions),
      } : null,
      totals: {
        recordCount: totals?.totalRecords || 0,
        totalBaseRent: Number(totals?.totalBaseRent || 0),
        totalSurchargeAmount: totalSurcharges,
        collectedAmount: collectedSurcharges,
        pendingAmount: pendingSurcharges,
        overdueAmount: overdueSurcharges,
        waivedAmount: Number(totals?.waivedAmount || 0),
        remittedAmount: remittedSurcharges,
        collectionRate,
        remittanceRate,
        complianceRate,
        pendingCount: totals?.pendingCount || 0,
        collectedCount: totals?.collectedCount || 0,
        overdueCount: totals?.overdueCount || 0,
        waivedCount: totals?.waivedCount || 0,
        remittedCount: totals?.remittedCount || 0,
      },
      byProperty,
      byUnit,
      birFiling,
      alerts,
      recommendations,
    });
  } catch (error: any) {
    console.error('[surcharge-report] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
