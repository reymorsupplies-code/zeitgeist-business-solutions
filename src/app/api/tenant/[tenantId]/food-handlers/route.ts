import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Food Handler Registration API ──
// T&T Public Health (Food Handlers) Regulations compliance

// ── Helper: Ensure table exists ──
async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "FoodHandlerRegistration" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "handlerName" TEXT NOT NULL,
      "registrationNumber" TEXT NOT NULL,
      "issuingAuthority" TEXT,
      "expiryDate" TIMESTAMPTZ NOT NULL,
      "trainingDate" TIMESTAMPTZ,
      "certificateUrl" TEXT,
      "status" TEXT DEFAULT 'active',
      "notes" TEXT,
      "isDeleted" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_fh_tenant" ON "FoodHandlerRegistration"("tenantId");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_fh_expiry" ON "FoodHandlerRegistration"("expiryDate");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_fh_status" ON "FoodHandlerRegistration"("status");`);
}

// ── GET: List registrations / expiry alerts / compliance status ──
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
    const status = searchParams.get('status') || '';

    // ── /compliance-status ──
    if (action === 'compliance-status') {
      const total = await pgQueryOne(
        `SELECT COUNT(*)::int as count FROM "FoodHandlerRegistration" WHERE "tenantId" = $1 AND "isDeleted" = false`,
        [tenantId]
      );

      const active = await pgQueryOne(
        `SELECT COUNT(*)::int as count FROM "FoodHandlerRegistration" WHERE "tenantId" = $1 AND "isDeleted" = false AND "status" = 'active'`,
        [tenantId]
      );

      const validCerts = await pgQueryOne(
        `SELECT COUNT(*)::int as count FROM "FoodHandlerRegistration"
         WHERE "tenantId" = $1 AND "isDeleted" = false AND "status" = 'active' AND "expiryDate" > NOW()`,
        [tenantId]
      );

      const expiredCerts = await pgQueryOne(
        `SELECT COUNT(*)::int as count FROM "FoodHandlerRegistration"
         WHERE "tenantId" = $1 AND "isDeleted" = false AND ("status" = 'expired' OR "expiryDate" <= NOW())`,
        [tenantId]
      );

      const totalCount = total?.count || 0;
      const activeCount = active?.count || 0;
      const validCount = validCerts?.count || 0;
      const expiredCount = expiredCerts?.count || 0;

      // Get total employee count from Tenant for compliance percentage
      const tenantData = await pgQueryOne<any>(
        `SELECT "maxUsers" FROM "Tenant" WHERE id = $1`,
        [tenantId]
      );
      const totalEmployees = tenantData?.maxUsers || totalCount || 1;

      return NextResponse.json({
        totalRegistered: totalCount,
        totalEmployees,
        percentageRegistered: totalCount > 0 ? Math.round((totalCount / Math.max(totalEmployees, 1)) * 100) : 0,
        activeCount,
        percentageActive: totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0,
        validCertificates: validCount,
        percentageValid: activeCount > 0 ? Math.round((validCount / activeCount) * 100) : 0,
        expiredCount,
        percentageExpired: activeCount > 0 ? Math.round((expiredCount / activeCount) * 100) : 0,
        isCompliant: expiredCount === 0 && validCount > 0,
      });
    }

    // ── /expiry-alerts ──
    if (action === 'expiry-alerts') {
      const alerts = await pgQuery(
        `SELECT * FROM "FoodHandlerRegistration"
         WHERE "tenantId" = $1 AND "isDeleted" = false AND "status" = 'active'
         AND ("expiryDate" <= NOW() + INTERVAL '30 days' OR "expiryDate" <= NOW())
         ORDER BY "expiryDate" ASC LIMIT 100`,
        [tenantId]
      );

      const formatted = alerts.map((a: any) => ({
        ...a,
        daysUntilExpiry: Math.ceil((new Date(a.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        isExpired: new Date(a.expiryDate) <= new Date(),
        urgency: new Date(a.expiryDate) <= new Date()
          ? 'expired'
          : Math.ceil((new Date(a.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 7
            ? 'critical'
            : Math.ceil((new Date(a.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 14
              ? 'warning'
              : 'info',
      }));

      return NextResponse.json({
        alerts: formatted,
        totalAlerts: formatted.length,
        expiredCount: formatted.filter((a: any) => a.isExpired).length,
      });
    }

    // ── List registrations (default) ──
    const conditions: string[] = [`"tenantId" = $1`, `"isDeleted" = false`];
    const params: any[] = [tenantId];

    if (status) {
      conditions.push(`"status" = $2`);
      params.push(status);
    }

    const registrations = await pgQuery(
      `SELECT * FROM "FoodHandlerRegistration" WHERE ${conditions.join(' AND ')} ORDER BY "createdAt" DESC LIMIT 500`,
      params
    );
    return NextResponse.json(registrations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Register new food handler ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const data = await req.json();

    // Validate required fields
    if (!data.handlerName || !data.registrationNumber || !data.expiryDate) {
      return NextResponse.json({
        error: 'handlerName, registrationNumber, and expiryDate are required',
      }, { status: 400 });
    }

    // Check expiry date is in the future
    const expiry = new Date(data.expiryDate);
    if (expiry <= new Date()) {
      return NextResponse.json({
        error: 'expiryDate must be in the future',
      }, { status: 400 });
    }

    // Check for duplicate registration number
    const existing = await pgQueryOne(
      `SELECT id FROM "FoodHandlerRegistration" WHERE "tenantId" = $1 AND "registrationNumber" = $2 AND "isDeleted" = false`,
      [tenantId, data.registrationNumber]
    );
    if (existing) {
      return NextResponse.json({ error: 'Registration number already exists for this tenant' }, { status: 409 });
    }

    const result = await pgQuery(
      `INSERT INTO "FoodHandlerRegistration" ("tenantId", "handlerName", "registrationNumber", "issuingAuthority", "expiryDate", "trainingDate", "certificateUrl", "status", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, data.handlerName, data.registrationNumber,
       data.issuingAuthority || null, expiry.toISOString(),
       data.trainingDate ? new Date(data.trainingDate).toISOString() : null,
       data.certificateUrl || null, 'active', data.notes || null]
    );
    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH: Update registration / suspend / expire ──
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

    const setParts: string[] = [`"updatedAt" = NOW()`];
    const params: any[] = [];
    let pIdx = 1;

    // Handle status-specific actions
    if (data.action === 'suspend') {
      setParts.push(`"status" = $${pIdx++}`);
      params.push('suspended');
    } else if (data.action === 'expire') {
      setParts.push(`"status" = $${pIdx++}`);
      params.push('expired');
    } else if (data.action === 'reactivate') {
      setParts.push(`"status" = $${pIdx++}`);
      params.push('active');
    } else {
      const allowedFields = ['handlerName', 'registrationNumber', 'issuingAuthority', 'expiryDate', 'trainingDate', 'certificateUrl', 'status', 'notes'];
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          setParts.push(`"${field}" = $${pIdx++}`);
          params.push(field === 'expiryDate' || field === 'trainingDate' ? new Date(data[field]).toISOString() : data[field]);
        }
      }
    }

    params.push(data.id, tenantId);

    const result = await pgQuery(
      `UPDATE "FoodHandlerRegistration" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx} RETURNING *`,
      params
    );
    if (!result.length) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
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
      `UPDATE "FoodHandlerRegistration" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [data.id, tenantId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
