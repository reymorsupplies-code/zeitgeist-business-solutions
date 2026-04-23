import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── HACCP Plan & Risk Log API ──
// T&T Public Health (Food Safety) Regulations compliance

// ── Helper: Ensure HACCP tables exist ──
async function ensureTables() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "HACCPPlan" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "planNumber" TEXT,
      "name" TEXT NOT NULL,
      "productCategory" TEXT,
      "processSteps" TEXT DEFAULT '[]',
      "criticalLimits" TEXT DEFAULT '[]',
      "status" TEXT DEFAULT 'draft',
      "approvedBy" TEXT,
      "approvedAt" TIMESTAMPTZ,
      "nextReviewDate" TIMESTAMPTZ,
      "notes" TEXT,
      "isDeleted" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "HACCPRiskLog" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "planId" TEXT NOT NULL REFERENCES "HACCPPlan"("id") ON DELETE CASCADE,
      "ccpNumber" TEXT,
      "parameter" TEXT NOT NULL,
      "observedValue" TEXT NOT NULL,
      "criticalMin" TEXT,
      "criticalMax" TEXT,
      "isWithinLimit" BOOLEAN DEFAULT true,
      "correctiveAction" TEXT,
      "monitoredBy" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_haccp_plan_tenant" ON "HACCPPlan"("tenantId");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_haccp_risk_tenant" ON "HACCPRiskLog"("tenantId");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_haccp_risk_plan" ON "HACCPRiskLog"("planId");`);
}

// ── GET: List HACCP plans (with risk log count) / risk logs / dashboard ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || '';
    const status = searchParams.get('status') || '';
    const productCategory = searchParams.get('productCategory') || '';
    const planId = searchParams.get('planId') || '';
    const isWithinLimit = searchParams.get('isWithinLimit');
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // ── /dashboard ──
    if (action === 'dashboard') {
      const plans = await pgQuery(
        `SELECT status, COUNT(*)::int as count FROM "HACCPPlan" WHERE "tenantId" = $1 AND "isDeleted" = false GROUP BY status`,
        [tenantId]
      );
      const totalPlans = plans.reduce((s: number, p: any) => s + p.count, 0);
      const activePlans = plans.find((p: any) => p.status === 'active')?.count || 0;

      const outOfLimit = await pgQueryOne(
        `SELECT COUNT(*)::int as count FROM "HACCPRiskLog" WHERE "tenantId" = $1 AND "isWithinLimit" = false`,
        [tenantId]
      );

      const upcomingReviews = await pgQuery(
        `SELECT id, name, "planNumber", "nextReviewDate" FROM "HACCPPlan"
         WHERE "tenantId" = $1 AND "isDeleted" = false AND "status" = 'active'
         AND "nextReviewDate" IS NOT NULL AND "nextReviewDate" <= NOW() + INTERVAL '30 days'
         ORDER BY "nextReviewDate" ASC LIMIT 10`,
        [tenantId]
      );

      return NextResponse.json({
        totalPlans,
        activePlans,
        outOfLimitAlerts: outOfLimit?.count || 0,
        plansByStatus: plans,
        upcomingReviews,
      });
    }

    // ── /risk-logs ──
    if (action === 'risk-logs') {
      const conditions: string[] = [`"tenantId" = $1`];
      const params: any[] = [tenantId];
      let pIdx = 2;

      if (planId) {
        conditions.push(`"planId" = $${pIdx++}`);
        params.push(planId);
      }
      if (isWithinLimit === 'true') {
        conditions.push(`"isWithinLimit" = true`);
      } else if (isWithinLimit === 'false') {
        conditions.push(`"isWithinLimit" = false`);
      }
      if (startDate) {
        conditions.push(`"createdAt" >= $${pIdx++}`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`"createdAt" <= $${pIdx++}`);
        params.push(endDate);
      }

      const logs = await pgQuery(
        `SELECT * FROM "HACCPRiskLog" WHERE ${conditions.join(' AND ')} ORDER BY "createdAt" DESC LIMIT 500`,
        params
      );
      return NextResponse.json(logs);
    }

    // ── List HACCP plans (default) ──
    const conditions: string[] = [`"tenantId" = $1`, `"isDeleted" = false`];
    const params: any[] = [tenantId];
    let pIdx = 2;

    if (status) {
      conditions.push(`"status" = $${pIdx++}`);
      params.push(status);
    }
    if (productCategory) {
      conditions.push(`"productCategory" = $${pIdx++}`);
      params.push(productCategory);
    }

    const plans = await pgQuery(
      `SELECT p.*, COUNT(r.id)::int as "riskLogCount"
       FROM "HACCPPlan" p
       LEFT JOIN "HACCPRiskLog" r ON r."planId" = p.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY p.id
       ORDER BY p."createdAt" DESC LIMIT 500`,
      params
    );
    return NextResponse.json(plans);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Create HACCP plan or risk log ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTables();
    const data = await req.json();

    // ── Create risk log ──
    if (data.action === 'risk-log') {
      if (!data.planId || !data.parameter || !data.observedValue) {
        return NextResponse.json({ error: 'planId, parameter, and observedValue are required' }, { status: 400 });
      }

      // Validate against critical limits
      let isWithinLimit = true;
      const val = parseFloat(data.observedValue);
      if (!isNaN(val)) {
        if (data.criticalMin !== undefined && data.criticalMin !== null) {
          const minVal = parseFloat(data.criticalMin);
          if (!isNaN(minVal) && val < minVal) isWithinLimit = false;
        }
        if (data.criticalMax !== undefined && data.criticalMax !== null) {
          const maxVal = parseFloat(data.criticalMax);
          if (!isNaN(maxVal) && val > maxVal) isWithinLimit = false;
        }
      }

      const result = await pgQuery(
        `INSERT INTO "HACCPRiskLog" ("tenantId", "planId", "ccpNumber", "parameter", "observedValue", "criticalMin", "criticalMax", "isWithinLimit", "correctiveAction", "monitoredBy", "notes")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [tenantId, data.planId, data.ccpNumber || null, data.parameter, data.observedValue,
         data.criticalMin || null, data.criticalMax || null, isWithinLimit,
         data.correctiveAction || null, data.monitoredBy || null, data.notes || null]
      );
      return NextResponse.json(result[0], { status: 201 });
    }

    // ── Create HACCP plan ──
    if (!data.name) {
      return NextResponse.json({ error: 'Plan name is required' }, { status: 400 });
    }

    const planNumber = data.planNumber || `HACCP-${Date.now()}`;
    const processSteps = typeof data.processSteps === 'string' ? data.processSteps : JSON.stringify(data.processSteps || []);
    const criticalLimits = typeof data.criticalLimits === 'string' ? data.criticalLimits : JSON.stringify(data.criticalLimits || []);

    // Auto-set nextReviewDate = created + 12 months
    const nextReviewDate = new Date();
    nextReviewDate.setMonth(nextReviewDate.getMonth() + 12);

    const result = await pgQuery(
      `INSERT INTO "HACCPPlan" ("tenantId", "planNumber", "name", "productCategory", "processSteps", "criticalLimits", "status", "nextReviewDate", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, planNumber, data.name, data.productCategory || null,
       processSteps, criticalLimits, data.status || 'draft',
       nextReviewDate.toISOString(), data.notes || null]
    );
    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH: Update plan / approve / update risk log ──
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTables();
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // ── Approve plan ──
    if (data.action === 'approve') {
      const result = await pgQuery(
        `UPDATE "HACCPPlan" SET status = 'active', "approvedBy" = $1, "approvedAt" = NOW(), "updatedAt" = NOW()
         WHERE id = $2 AND "tenantId" = $3 RETURNING *`,
        [auth.payload?.userId || data.approvedBy || null, data.id, tenantId]
      );
      if (!result.length) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      return NextResponse.json(result[0]);
    }

    // ── Update risk log ──
    if (data.action === 'risk-log') {
      const setParts: string[] = [`"updatedAt" = NOW()`];
      const params: any[] = [];
      let pIdx = 1;

      const allowedFields = ['parameter', 'observedValue', 'correctiveAction', 'monitoredBy', 'notes'];
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          setParts.push(`"${field}" = $${pIdx++}`);
          params.push(data[field]);
        }
      }
      params.push(data.id, tenantId);

      const result = await pgQuery(
        `UPDATE "HACCPRiskLog" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx} RETURNING *`,
        params
      );
      if (!result.length) return NextResponse.json({ error: 'Risk log not found' }, { status: 404 });
      return NextResponse.json(result[0]);
    }

    // ── Update HACCP plan ──
    const setParts: string[] = [`"updatedAt" = NOW()`];
    const params: any[] = [];
    let pIdx = 1;

    const allowedPlanFields = ['name', 'productCategory', 'status', 'notes'];
    for (const field of allowedPlanFields) {
      if (data[field] !== undefined) {
        setParts.push(`"${field}" = $${pIdx++}`);
        params.push(data[field]);
      }
    }
    if (data.processSteps !== undefined) {
      setParts.push(`"processSteps" = $${pIdx++}`);
      params.push(typeof data.processSteps === 'string' ? data.processSteps : JSON.stringify(data.processSteps));
    }
    if (data.criticalLimits !== undefined) {
      setParts.push(`"criticalLimits" = $${pIdx++}`);
      params.push(typeof data.criticalLimits === 'string' ? data.criticalLimits : JSON.stringify(data.criticalLimits));
    }
    params.push(data.id, tenantId);

    const result = await pgQuery(
      `UPDATE "HACCPPlan" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx} RETURNING *`,
      params
    );
    if (!result.length) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Soft-delete a plan ──
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
      `UPDATE "HACCPPlan" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [data.id, tenantId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
