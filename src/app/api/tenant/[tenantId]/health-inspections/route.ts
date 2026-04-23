import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

// ── Health Inspection API ──
// T&T Public Health (Food Establishment) Regulations

// ── Helper: Ensure table exists ──
async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "HealthInspection" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "inspectionNumber" TEXT,
      "inspectorName" TEXT,
      "inspectorId" TEXT,
      "type" TEXT DEFAULT 'routine',
      "result" TEXT,
      "score" INTEGER,
      "maxScore" INTEGER DEFAULT 100,
      "violations" TEXT DEFAULT '[]',
      "correctiveActions" TEXT DEFAULT '[]',
      "inspectionDate" TIMESTAMPTZ,
      "nextInspectionDate" TIMESTAMPTZ,
      "notes" TEXT,
      "isDeleted" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_hi_tenant" ON "HealthInspection"("tenantId");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_hi_result" ON "HealthInspection"("result");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_hi_date" ON "HealthInspection"("inspectionDate");`);
}

// ── GET: List inspections / upcoming / violation-summary ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || '';
    const result = searchParams.get('result') || '';
    const type = searchParams.get('type') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // ── /violation-summary ──
    if (action === 'violation-summary') {
      const inspections = await pgQuery(
        `SELECT * FROM "HealthInspection" WHERE "tenantId" = $1 AND "isDeleted" = false`,
        [tenantId]
      );

      // Aggregate violations from all inspections
      const categoryStats: Record<string, { total: number; resolved: number; unresolved: number }> = {};
      const severityStats: Record<string, { total: number; resolved: number; unresolved: number }> = {};

      let totalViolations = 0;
      let resolvedViolations = 0;

      for (const insp of inspections) {
        const violations: any[] = typeof insp.violations === 'string' ? JSON.parse(insp.violations) : (insp.violations || []);
        for (const v of violations) {
          totalViolations++;
          if (v.resolved) resolvedViolations++;

          const cat = v.category || 'uncategorized';
          if (!categoryStats[cat]) categoryStats[cat] = { total: 0, resolved: 0, unresolved: 0 };
          categoryStats[cat].total++;
          if (v.resolved) categoryStats[cat].resolved++;
          else categoryStats[cat].unresolved++;

          const sev = v.severity || 'unknown';
          if (!severityStats[sev]) severityStats[sev] = { total: 0, resolved: 0, unresolved: 0 };
          severityStats[sev].total++;
          if (v.resolved) severityStats[sev].resolved++;
          else severityStats[sev].unresolved++;
        }
      }

      return NextResponse.json({
        totalViolations,
        resolvedViolations,
        unresolvedViolations: totalViolations - resolvedViolations,
        resolutionRate: totalViolations > 0 ? Math.round((resolvedViolations / totalViolations) * 100) : 100,
        byCategory: categoryStats,
        bySeverity: severityStats,
        totalInspections: inspections.length,
      });
    }

    // ── /upcoming ──
    if (action === 'upcoming') {
      const upcoming = await pgQuery(
        `SELECT * FROM "HealthInspection"
         WHERE "tenantId" = $1 AND "isDeleted" = false
         AND "nextInspectionDate" IS NOT NULL
         AND "nextInspectionDate" <= NOW() + INTERVAL '30 days'
         ORDER BY "nextInspectionDate" ASC LIMIT 50`,
        [tenantId]
      );
      return NextResponse.json({
        upcoming,
        count: upcoming.length,
      });
    }

    // ── List inspections (default) ──
    const conditions: string[] = [`"tenantId" = $1`, `"isDeleted" = false`];
    const params: any[] = [tenantId];
    let pIdx = 2;

    if (result) {
      conditions.push(`"result" = $${pIdx++}`);
      params.push(result);
    }
    if (type) {
      conditions.push(`"type" = $${pIdx++}`);
      params.push(type);
    }
    if (startDate) {
      conditions.push(`"inspectionDate" >= $${pIdx++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`"inspectionDate" <= $${pIdx++}`);
      params.push(endDate);
    }

    const inspections = await pgQuery(
      `SELECT * FROM "HealthInspection" WHERE ${conditions.join(' AND ')} ORDER BY "inspectionDate" DESC NULLS LAST, "createdAt" DESC LIMIT 500`,
      params
    );

    // Add violation stats to each inspection
    const enriched = inspections.map((insp: any) => {
      const violations: any[] = typeof insp.violations === 'string' ? JSON.parse(insp.violations) : (insp.violations || []);
      const correctiveActions: any[] = typeof insp.correctiveActions === 'string' ? JSON.parse(insp.correctiveActions) : (insp.correctiveActions || []);
      return {
        ...insp,
        violationCount: violations.length,
        resolvedViolations: violations.filter((v: any) => v.resolved).length,
        openViolations: violations.filter((v: any) => !v.resolved).length,
        completedActions: correctiveActions.filter((a: any) => a.completed).length,
        pendingActions: correctiveActions.filter((a: any) => !a.completed).length,
      };
    });

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Create inspection record ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const data = await req.json();

    if (!data.inspectionDate) {
      return NextResponse.json({ error: 'inspectionDate is required' }, { status: 400 });
    }

    const inspectionNumber = data.inspectionNumber || `INS-${Date.now()}`;
    const violations = typeof data.violations === 'string' ? data.violations : JSON.stringify(data.violations || []);
    const correctiveActions = typeof data.correctiveActions === 'string' ? data.correctiveActions : JSON.stringify(data.correctiveActions || []);

    const result = await pgQuery(
      `INSERT INTO "HealthInspection" ("tenantId", "inspectionNumber", "inspectorName", "inspectorId", "type", "result", "score", "maxScore", "violations", "correctiveActions", "inspectionDate", "nextInspectionDate", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [tenantId, inspectionNumber, data.inspectorName || null, data.inspectorId || null,
       data.type || 'routine', data.result || null,
       data.score !== undefined ? data.score : null, data.maxScore || 100,
       violations, correctiveActions,
       new Date(data.inspectionDate).toISOString(),
       data.nextInspectionDate ? new Date(data.nextInspectionDate).toISOString() : null,
       data.notes || null]
    );
    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH: Update inspection / add corrective actions / resolve violations ──
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // ── Add corrective action ──
    if (data.action === 'add-corrective-action') {
      const existing = await pgQuery(
        `SELECT "correctiveActions" FROM "HealthInspection" WHERE id = $1 AND "tenantId" = $2`,
        [data.id, tenantId]
      );
      if (!existing.length) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });

      const actions: any[] = typeof existing[0].correctiveActions === 'string'
        ? JSON.parse(existing[0].correctiveActions) : (existing[0].correctiveActions || []);

      const newAction = {
        description: data.description || '',
        dueDate: data.dueDate || null,
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
      };
      actions.push(newAction);

      const result = await pgQuery(
        `UPDATE "HealthInspection" SET "correctiveActions" = $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3 RETURNING *`,
        [JSON.stringify(actions), data.id, tenantId]
      );
      return NextResponse.json(result[0]);
    }

    // ── Resolve violation ──
    if (data.action === 'resolve-violation') {
      if (data.violationIndex === undefined) {
        return NextResponse.json({ error: 'violationIndex is required' }, { status: 400 });
      }

      const existing = await pgQuery(
        `SELECT violations FROM "HealthInspection" WHERE id = $1 AND "tenantId" = $2`,
        [data.id, tenantId]
      );
      if (!existing.length) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });

      const violations: any[] = typeof existing[0].violations === 'string'
        ? JSON.parse(existing[0].violations) : (existing[0].violations || []);

      if (violations[data.violationIndex]) {
        violations[data.violationIndex].resolved = true;
        violations[data.violationIndex].resolvedAt = new Date().toISOString();
        violations[data.violationIndex].correctiveAction = data.correctiveAction || violations[data.violationIndex].correctiveAction;
      }

      const result = await pgQuery(
        `UPDATE "HealthInspection" SET violations = $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3 RETURNING *`,
        [JSON.stringify(violations), data.id, tenantId]
      );
      return NextResponse.json(result[0]);
    }

    // ── Complete corrective action ──
    if (data.action === 'complete-action') {
      if (data.actionIndex === undefined) {
        return NextResponse.json({ error: 'actionIndex is required' }, { status: 400 });
      }

      const existing = await pgQuery(
        `SELECT "correctiveActions" FROM "HealthInspection" WHERE id = $1 AND "tenantId" = $2`,
        [data.id, tenantId]
      );
      if (!existing.length) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });

      const actions: any[] = typeof existing[0].correctiveActions === 'string'
        ? JSON.parse(existing[0].correctiveActions) : (existing[0].correctiveActions || []);

      if (actions[data.actionIndex]) {
        actions[data.actionIndex].completed = true;
        actions[data.actionIndex].completedAt = new Date().toISOString();
      }

      const result = await pgQuery(
        `UPDATE "HealthInspection" SET "correctiveActions" = $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3 RETURNING *`,
        [JSON.stringify(actions), data.id, tenantId]
      );
      return NextResponse.json(result[0]);
    }

    // ── Standard update ──
    const setParts: string[] = [`"updatedAt" = NOW()`];
    const params: any[] = [];
    let pIdx = 1;

    const allowedFields = ['inspectorName', 'inspectorId', 'type', 'result', 'score', 'maxScore', 'inspectionDate', 'nextInspectionDate', 'notes'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        setParts.push(`"${field}" = $${pIdx++}`);
        params.push((field === 'inspectionDate' || field === 'nextInspectionDate') && data[field] ? new Date(data[field]).toISOString() : data[field]);
      }
    }
    if (data.violations !== undefined) {
      setParts.push(`violations = $${pIdx++}`);
      params.push(typeof data.violations === 'string' ? data.violations : JSON.stringify(data.violations));
    }
    if (data.correctiveActions !== undefined) {
      setParts.push(`"correctiveActions" = $${pIdx++}`);
      params.push(typeof data.correctiveActions === 'string' ? data.correctiveActions : JSON.stringify(data.correctiveActions));
    }

    params.push(data.id, tenantId);

    const result = await pgQuery(
      `UPDATE "HealthInspection" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx} RETURNING *`,
      params
    );
    if (!result.length) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Soft-delete ──
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await pgQuery(
      `UPDATE "HealthInspection" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [data.id, tenantId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
