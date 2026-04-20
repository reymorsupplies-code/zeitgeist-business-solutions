import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, checkRateLimit } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import crypto from 'crypto';

// ── Online Ordering API (Public + Internal) ──

// Ensure the OnlineOrder table exists (idempotent)
async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "OnlineOrder" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "clientPhone" TEXT DEFAULT '',
      "clientEmail" TEXT DEFAULT '',
      "items" TEXT NOT NULL DEFAULT '[]',
      "deliveryType" TEXT NOT NULL DEFAULT 'pickup',
      "deliveryAddress" TEXT DEFAULT '',
      "pickupDate" TEXT DEFAULT '',
      "pickupTime" TEXT DEFAULT '',
      "notes" TEXT DEFAULT '',
      "internalNotes" TEXT DEFAULT '',
      "totalAmount" REAL NOT NULL DEFAULT 0,
      "depositAmount" REAL NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'new',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT
    )
  `);
}

// ── GET: List online orders (authenticated, internal) ──

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureTable();

    const url = new URL(_req.url);
    const status = url.searchParams.get('status');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const conditions: string[] = [`"tenantId" = $1`, `"deletedAt" IS NULL`];
    const params: any[] = [tenantId];
    let pIdx = 2;

    const validStatuses = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (status && validStatuses.includes(status)) {
      conditions.push(`"status" = $${pIdx++}`);
      params.push(status);
    }
    if (from) {
      conditions.push(`"createdAt" >= $${pIdx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`"createdAt" <= $${pIdx++}`);
      params.push(to + 'T23:59:59.999Z');
    }

    const whereClause = conditions.join(' AND ');
    const orders = await pgQuery(
      `SELECT * FROM "OnlineOrder" WHERE ${whereClause} ORDER BY "createdAt" DESC`,
      params
    );

    // Parse JSON items for each order
    const parsed = orders.map((o: any) => {
      try {
        return { ...o, items: JSON.parse(o.items || '[]') };
      } catch {
        return { ...o, items: [] };
      }
    });

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Submit a new online order (PUBLIC — no auth required) ──

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
  }

  // Rate limit by IP for public endpoint
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateLimit = checkRateLimit(`online-order:${ip}`, 10, 60 * 1000); // 10 per minute
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    await ensureTable();

    const data = await req.json();

    // Validate required fields
    if (!data.clientName || (typeof data.clientName === 'string' && data.clientName.trim() === '')) {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
    }
    if (!data.pickupDate) {
      return NextResponse.json({ error: 'pickupDate is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const order = await pgQueryOne(
      `INSERT INTO "OnlineOrder" (
        "id", "tenantId", "clientName", "clientPhone", "clientEmail",
        "items", "deliveryType", "deliveryAddress", "pickupDate", "pickupTime",
        "notes", "totalAmount", "depositAmount", "status", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        id,
        tenantId,
        data.clientName?.trim() || '',
        data.clientPhone?.trim() || '',
        data.clientEmail?.trim() || '',
        JSON.stringify(data.items || []),
        data.deliveryType === 'delivery' ? 'delivery' : 'pickup',
        data.deliveryAddress?.trim() || '',
        data.pickupDate || '',
        data.pickupTime || '',
        data.notes?.trim() || '',
        Number(data.totalAmount) || 0,
        Number(data.depositAmount) || 0,
        'new',
        now,
        now,
      ]
    );

    // Parse items before returning
    if (order) {
      try {
        order.items = JSON.parse(order.items || '[]');
      } catch {
        order.items = [];
      }
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT: Update an online order (authenticated, internal) ──

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  const data = await req.json();
  const { id, status, notes, internalNotes } = data;

  if (!id) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }
  if (!status) {
    return NextResponse.json({ error: 'Status is required' }, { status: 400 });
  }

  const validStatuses = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    await ensureTable();

    // Verify order belongs to this tenant
    const existing = await pgQueryOne(
      `SELECT * FROM "OnlineOrder" WHERE id = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL`,
      [id, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const setParts: string[] = [`"status" = $1`, `"updatedAt" = NOW()`];
    const paramValues: any[] = [status];
    let pIdx = 2;

    // Append optional staff-only internal notes (cumulative, with newline separator)
    if (internalNotes) {
      const prev = (existing.internalNotes || '').trim();
      const newNotes = prev ? prev + '\n' + internalNotes.trim() : internalNotes.trim();
      setParts.push(`"internalNotes" = $${pIdx++}`);
      paramValues.push(newNotes);
    }

    // Optional client-visible notes update
    if (notes !== undefined) {
      setParts.push(`"notes" = $${pIdx++}`);
      paramValues.push(notes);
    }

    const updated = await pgQueryOne(
      `UPDATE "OnlineOrder" SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1} RETURNING *`,
      [...paramValues, id, tenantId]
    );

    // Parse items before returning
    if (updated) {
      try {
        updated.items = JSON.parse(updated.items || '[]');
      } catch {
        updated.items = [];
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Soft-delete an online order (authenticated, internal) ──

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  try {
    await ensureTable();

    // Verify order belongs to this tenant before deleting
    const existing = await pgQueryOne(
      `SELECT * FROM "OnlineOrder" WHERE id = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL`,
      [id, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await pgQuery(
      `UPDATE "OnlineOrder" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
