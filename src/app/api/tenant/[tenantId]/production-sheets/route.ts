import { NextRequest, NextResponse } from 'next/server';
import { apiGuard, checkRateLimit } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Daily Production Sheets API ──

const TABLE = '"ProductionSheet"';

// ─── Types ───

interface ProductionSheetItem {
  productName: string;
  quantity: number;
  unit: string;
  notes?: string;
  completed: boolean;
}

type SheetStatus = 'pending' | 'in_progress' | 'completed';

// ─── Table Migration ───

async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "items" TEXT NOT NULL DEFAULT '[]',
      "notes" TEXT DEFAULT '',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "deletedAt" TEXT
    )
  `);
}

// ─── GET: List production sheets with optional filters ───

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Rate limit check (read is more permissive)
  const rateLimit = checkRateLimit(req.headers.get('x-forwarded-for') || 'unknown', 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const guard = apiGuard(req, tenantId, 'production', 'read');
  if (guard) return guard;

  try {
    await ensureTable();

    const url = new URL(req.url);
    const dateFilter = url.searchParams.get('date') || '';
    const statusFilter = url.searchParams.get('status') || '';

    // Build parameterized WHERE clause
    const where: string[] = [`"tenantId" = $1`, `"deletedAt" IS NULL`];
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (dateFilter) {
      where.push(`"date" = $${paramIdx++}`);
      queryParams.push(dateFilter);
    }

    if (statusFilter) {
      const validStatuses: SheetStatus[] = ['pending', 'in_progress', 'completed'];
      if (!validStatuses.includes(statusFilter as SheetStatus)) {
        return NextResponse.json(
          { error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      where.push(`"status" = $${paramIdx++}`);
      queryParams.push(statusFilter);
    }

    const sheets = await pgQuery(
      `SELECT * FROM ${TABLE} WHERE ${where.join(' AND ')} ORDER BY "date" DESC, "createdAt" DESC`,
      queryParams
    );

    // Parse JSON items for each sheet
    const parsed = sheets.map((sheet: any) => ({
      ...sheet,
      items: typeof sheet.items === 'string' ? JSON.parse(sheet.items) : (sheet.items || []),
    }));

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create a new production sheet ───

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Rate limit for writes
  const rateLimit = checkRateLimit(req.headers.get('x-forwarded-for') || 'unknown', 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const guard = apiGuard(req, tenantId, 'production', 'write');
  if (guard) return guard;

  try {
    await ensureTable();

    const data = await req.json();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Validate required fields
    if (!data.date) {
      return NextResponse.json({ error: 'Date is required (YYYY-MM-DD)' }, { status: 400 });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    // Parse and validate items
    let items: ProductionSheetItem[] = [];
    if (data.items && Array.isArray(data.items)) {
      items = data.items.map((item: any, index: number) => ({
        productName: item.productName || '',
        quantity: Number(item.quantity) || 0,
        unit: item.unit || '',
        notes: item.notes || '',
        completed: Boolean(item.completed),
      }));

      // Validate each item has at least a product name
      for (let i = 0; i < items.length; i++) {
        if (!items[i].productName.trim()) {
          return NextResponse.json(
            { error: `Item at index ${i} must have a productName` },
            { status: 400 }
          );
        }
      }
    } else if (data.items && typeof data.items === 'string') {
      try {
        items = JSON.parse(data.items);
      } catch {
        return NextResponse.json({ error: 'Invalid items JSON format' }, { status: 400 });
      }
    }

    await pgQuery(
      `INSERT INTO ${TABLE} ("id", "tenantId", "date", "status", "items", "notes", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        tenantId,
        data.date,
        'pending',
        JSON.stringify(items),
        data.notes || '',
        now,
        now,
      ]
    );

    const created = await pgQueryOne(`SELECT * FROM ${TABLE} WHERE "id" = $1`, [id]);
    if (created && typeof created.items === 'string') {
      created.items = JSON.parse(created.items);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PUT: Update a production sheet ───

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Rate limit for writes
  const rateLimit = checkRateLimit(req.headers.get('x-forwarded-for') || 'unknown', 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const guard = apiGuard(req, tenantId, 'production', 'write');
  if (guard) return guard;

  try {
    await ensureTable();

    const { id, ...fields } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Verify the sheet belongs to this tenant
    const existing = await pgQueryOne(
      `SELECT * FROM ${TABLE} WHERE "id" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL`,
      [id, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Production sheet not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {};

    // Validate status if provided
    if (fields.status !== undefined) {
      const validStatuses: SheetStatus[] = ['pending', 'in_progress', 'completed'];
      if (!validStatuses.includes(fields.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updates.status = fields.status;
    }

    // Validate and serialize items if provided
    if (fields.items !== undefined) {
      let parsedItems: ProductionSheetItem[];

      if (typeof fields.items === 'string') {
        try {
          parsedItems = JSON.parse(fields.items);
        } catch {
          return NextResponse.json({ error: 'Invalid items JSON format' }, { status: 400 });
        }
      } else if (Array.isArray(fields.items)) {
        parsedItems = fields.items;
      } else {
        return NextResponse.json({ error: 'Items must be an array or JSON string' }, { status: 400 });
      }

      // Validate each item
      for (let i = 0; i < parsedItems.length; i++) {
        if (!parsedItems[i].productName?.trim()) {
          return NextResponse.json(
            { error: `Item at index ${i} must have a productName` },
            { status: 400 }
          );
        }
      }

      // Normalize items
      updates.items = JSON.stringify(
        parsedItems.map((item: any) => ({
          productName: item.productName || '',
          quantity: Number(item.quantity) || 0,
          unit: item.unit || '',
          notes: item.notes || '',
          completed: Boolean(item.completed),
        }))
      );
    }

    // Handle notes
    if (fields.notes !== undefined) {
      updates.notes = fields.notes;
    }

    // Build parameterized SET clause
    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const [k, v] of Object.entries(updates)) {
      setParts.push(`"${k}" = $${pIdx++}`);
      paramValues.push(v);
    }
    setParts.push(`"updatedAt" = NOW()`);

    await pgQuery(
      `UPDATE ${TABLE} SET ${setParts.join(', ')} WHERE "id" = $${pIdx} AND "tenantId" = $${pIdx + 1}`,
      [...paramValues, id, tenantId]
    );

    const updated = await pgQueryOne(`SELECT * FROM ${TABLE} WHERE "id" = $1`, [id]);
    if (updated && typeof updated.items === 'string') {
      updated.items = JSON.parse(updated.items);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Soft delete a production sheet ───

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Rate limit for deletes
  const rateLimit = checkRateLimit(req.headers.get('x-forwarded-for') || 'unknown', 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const guard = apiGuard(req, tenantId, 'production', 'delete');
  if (guard) return guard;

  try {
    await ensureTable();

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Verify the sheet belongs to this tenant before deleting
    const existing = await pgQueryOne(
      `SELECT "id" FROM ${TABLE} WHERE "id" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL`,
      [id, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Production sheet not found' }, { status: 404 });
    }

    // Soft delete by setting deletedAt
    await pgQuery(
      `UPDATE ${TABLE} SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
