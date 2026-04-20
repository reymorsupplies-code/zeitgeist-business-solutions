import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, checkRateLimit } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Tasting Bookings API ──

// Allowed columns for dynamic UPDATE (whitelist to prevent injection)
const UPDATABLE_COLUMNS = new Set([
  'status', 'date', 'time', 'guests', 'flavors', 'notes',
]);

// ── Helper: Ensure TastingBooking table exists ──
async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "TastingBooking" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "clientPhone" TEXT DEFAULT '',
      "clientEmail" TEXT DEFAULT '',
      "date" TEXT NOT NULL,
      "time" TEXT NOT NULL,
      "guests" INTEGER NOT NULL DEFAULT 2,
      "flavors" TEXT NOT NULL DEFAULT '[]',
      "notes" TEXT DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'requested',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
}

// ── GET: Query tasting bookings ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateLimit = checkRateLimit(`tastings-get:${ip}`, 60, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    await ensureTable();

    const { searchParams } = new URL(req.url);
    const dateFilter = searchParams.get('date');
    const statusFilter = searchParams.get('status');

    const conditions: string[] = [`"tenantId" = $1`];
    const values: any[] = [tenantId];
    let paramIdx = 2;

    if (dateFilter) {
      conditions.push(`"date" = $${paramIdx++}`);
      values.push(dateFilter);
    }

    if (statusFilter) {
      const validStatuses = ['requested', 'confirmed', 'completed', 'cancelled'];
      if (!validStatuses.includes(statusFilter)) {
        return NextResponse.json({ error: 'Invalid status. Must be one of: requested, confirmed, completed, cancelled' }, { status: 400 });
      }
      conditions.push(`"status" = $${paramIdx++}`);
      values.push(statusFilter);
    }

    const whereClause = conditions.join(' AND ');
    const bookings = await pgQuery(
      `SELECT * FROM "TastingBooking" WHERE ${whereClause} ORDER BY "date" ASC, "time" ASC`,
      values
    );

    return NextResponse.json(bookings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Create a tasting booking ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateLimit = checkRateLimit(`tastings-post:${ip}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    await ensureTable();

    const data = await req.json();

    // Validate required fields
    if (!data.clientName || typeof data.clientName !== 'string' || data.clientName.trim() === '') {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }
    if (!data.date || typeof data.date !== 'string' || data.date.trim() === '') {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }
    if (!data.time || typeof data.time !== 'string' || data.time.trim() === '') {
      return NextResponse.json({ error: 'time is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const flavors = Array.isArray(data.flavors) ? JSON.stringify(data.flavors) : (data.flavors || '[]');

    await pgQuery(
      `INSERT INTO "TastingBooking" (
        "id", "tenantId", "clientName", "clientPhone", "clientEmail",
        "date", "time", "guests", "flavors", "notes",
        "status", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        tenantId,
        data.clientName.trim(),
        data.clientPhone || '',
        data.clientEmail || '',
        data.date.trim(),
        data.time.trim(),
        Math.max(1, Math.min(Number(data.guests) || 2, 50)),
        flavors,
        data.notes || '',
        'requested',
        now,
        now,
      ]
    );

    const booking = await pgQueryOne(`SELECT * FROM "TastingBooking" WHERE id = $1`, [id]);
    return NextResponse.json(booking, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT: Update a tasting booking ──
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateLimit = checkRateLimit(`tastings-put:${ip}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    await ensureTable();

    const { id, ...fields } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    // Validate status if provided
    if (fields.status) {
      const validStatuses = ['requested', 'confirmed', 'completed', 'cancelled'];
      if (!validStatuses.includes(fields.status)) {
        return NextResponse.json({ error: 'Invalid status. Must be one of: requested, confirmed, completed, cancelled' }, { status: 400 });
      }
    }

    // Validate guests if provided
    if (fields.guests !== undefined) {
      const guests = Number(fields.guests);
      if (isNaN(guests) || guests < 1 || guests > 50) {
        return NextResponse.json({ error: 'guests must be a number between 1 and 50' }, { status: 400 });
      }
    }

    // Build SET clause using only whitelisted columns
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (!UPDATABLE_COLUMNS.has(key)) continue;

      // Serialize flavors array to JSON string
      if (key === 'flavors' && Array.isArray(value)) {
        setParts.push(`"${key}" = $${paramIdx++}`);
        values.push(JSON.stringify(value));
      } else {
        setParts.push(`"${key}" = $${paramIdx++}`);
        values.push(value);
      }
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    setParts.push(`"updatedAt" = $${paramIdx++}`);
    values.push(new Date().toISOString());

    values.push(id, tenantId);

    const result = await pgQuery(
      `UPDATE "TastingBooking" SET ${setParts.join(', ')} WHERE id = $${paramIdx++} AND "tenantId" = $${paramIdx}`,
      values
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 });
    }

    const updated = await pgQueryOne(`SELECT * FROM "TastingBooking" WHERE id = $1`, [id]);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Delete a tasting booking ──
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateLimit = checkRateLimit(`tastings-delete:${ip}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    await ensureTable();

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const existing = await pgQueryOne(
      `SELECT id FROM "TastingBooking" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 });
    }

    await pgQuery(
      `DELETE FROM "TastingBooking" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
