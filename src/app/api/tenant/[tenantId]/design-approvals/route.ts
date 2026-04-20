import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, checkRateLimit } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Design Approval Workflow API ──

const VALID_STATUSES = ['draft', 'sent', 'approved', 'revision', 'rejected'] as const;
type DesignApprovalStatus = (typeof VALID_STATUSES)[number];

interface DesignApprovalRow {
  id: string;
  tenantId: string;
  orderId: string | null;
  clientName: string;
  designDescription: string;
  imageUrl: string | null;
  referenceImages: string;
  notes: string | null;
  status: string;
  revisionNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Helper: ensure table exists ──
async function ensureDesignApprovalTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "DesignApproval" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "orderId" TEXT,
      "clientName" TEXT NOT NULL,
      "designDescription" TEXT NOT NULL,
      "imageUrl" TEXT DEFAULT '',
      "referenceImages" TEXT NOT NULL DEFAULT '[]',
      "notes" TEXT DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'draft',
      "revisionNotes" TEXT DEFAULT '',
      "approvedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
}

// ── Helper: rate limit guard ──
function rateLimitOrError(req: NextRequest): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rate = checkRateLimit(`design-approvals:${ip}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }
  return null;
}

// ── Helper: extract IP for rate limit ──
function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

// ────────────────────────────────────────────────
// GET — Query design approvals for tenant
// ────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth
  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  // Rate limit
  const rl = rateLimitOrError(_req);
  if (rl) return rl;

  try {
    await ensureDesignApprovalTable();

    // Optional status filter from query string
    const { searchParams } = new URL(_req.url);
    const statusFilter = searchParams.get('status');

    let rows: DesignApprovalRow[];

    if (statusFilter) {
      if (!VALID_STATUSES.includes(statusFilter as DesignApprovalStatus)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      rows = await pgQuery<DesignApprovalRow>(
        `SELECT * FROM "DesignApproval" WHERE "tenantId" = $1 AND "status" = $2 ORDER BY "createdAt" DESC`,
        [tenantId, statusFilter]
      );
    } else {
      rows = await pgQuery<DesignApprovalRow>(
        `SELECT * FROM "DesignApproval" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
        [tenantId]
      );
    }

    // Parse referenceImages from JSON string
    const result = rows.map((row) => ({
      ...row,
      referenceImages: JSON.parse(row.referenceImages || '[]'),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ────────────────────────────────────────────────
// POST — Create a new design approval
// ────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  // Rate limit
  const rl = rateLimitOrError(req);
  if (rl) return rl;

  try {
    const data = await req.json();

    // Validate required fields
    if (!data.clientName || typeof data.clientName !== 'string' || data.clientName.trim() === '') {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }
    if (!data.designDescription || typeof data.designDescription !== 'string' || data.designDescription.trim() === '') {
      return NextResponse.json({ error: 'designDescription is required' }, { status: 400 });
    }

    await ensureDesignApprovalTable();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const orderId = data.orderId || null;
    const imageUrl = data.imageUrl || '';
    const referenceImages = Array.isArray(data.referenceImages) ? JSON.stringify(data.referenceImages) : '[]';
    const notes = data.notes || '';

    await pgQuery(
      `INSERT INTO "DesignApproval" ("id","tenantId","orderId","clientName","designDescription","imageUrl","referenceImages","notes","status","revisionNotes","approvedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft','',NULL,$9,$10)`,
      [id, tenantId, orderId, data.clientName.trim(), data.designDescription.trim(), imageUrl, referenceImages, notes, now, now]
    );

    const created = await pgQueryOne<DesignApprovalRow>(`SELECT * FROM "DesignApproval" WHERE id = $1`, [id]);

    return NextResponse.json({
      ...created,
      referenceImages: JSON.parse(created?.referenceImages || '[]'),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ────────────────────────────────────────────────
// PUT — Update a design approval
// ────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  // Auth
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  // Rate limit
  const rl = rateLimitOrError(req);
  if (rl) return rl;

  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Validate status if provided
    if (fields.status && !VALID_STATUSES.includes(fields.status as DesignApprovalStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // If status is 'revision', require revisionNotes
    if (fields.status === 'revision' && (!fields.revisionNotes || fields.revisionNotes.trim() === '')) {
      return NextResponse.json(
        { error: 'revisionNotes is required when status is set to revision' },
        { status: 400 }
      );
    }

    // Auto-set approvedAt when status changes to 'approved'
    let approvedAt: string | null = fields.approvedAt ?? null;
    if (fields.status === 'approved') {
      approvedAt = new Date().toISOString();
    }

    // Serialize referenceImages if it's an array
    let referenceImagesValue: any = fields.referenceImages;
    if (Array.isArray(referenceImagesValue)) {
      referenceImagesValue = JSON.stringify(referenceImagesValue);
    }

    // Build dynamic SET clause
    const allowedKeys = ['status', 'designDescription', 'imageUrl', 'referenceImages', 'revisionNotes', 'approvedAt', 'notes'];
    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const key of allowedKeys) {
      if (key in fields) {
        const value = key === 'referenceImages' ? referenceImagesValue
          : key === 'approvedAt' ? approvedAt
          : fields[key];
        setParts.push(`"${key}" = $${pIdx++}`);
        paramValues.push(value ?? null);
      }
    }

    // Always update updatedAt
    setParts.push(`"updatedAt" = $${pIdx++}`);
    paramValues.push(new Date().toISOString());

    await pgQuery(
      `UPDATE "DesignApproval" SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1}`,
      [...paramValues, id, tenantId]
    );

    const updated = await pgQueryOne<DesignApprovalRow>(`SELECT * FROM "DesignApproval" WHERE id = $1`, [id]);

    if (!updated) {
      return NextResponse.json({ error: 'Design approval not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      referenceImages: JSON.parse(updated.referenceImages || '[]'),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ────────────────────────────────────────────────
// DELETE — Delete a design approval
// ────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  // Auth
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  // Rate limit
  const rl = rateLimitOrError(req);
  if (rl) return rl;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const deleted = await pgQuery(
      `DELETE FROM "DesignApproval" WHERE id = $1 AND "tenantId" = $2 RETURNING id`,
      [id, tenantId]
    );

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Design approval not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
