import { NextRequest, NextResponse } from 'next/server';
import { apiGuard } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

const TABLE = '"GuestList"';

async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "eventId" TEXT NOT NULL,
      "guestName" TEXT NOT NULL,
      "guestEmail" TEXT DEFAULT '',
      "guestPhone" TEXT DEFAULT '',
      "rsvpStatus" TEXT DEFAULT 'pending',
      "mealPreference" TEXT DEFAULT '',
      "plusOne" BOOLEAN DEFAULT false,
      "plusOneName" TEXT DEFAULT '',
      "tableAssignment" TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      "isDeleted" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const guard = apiGuard(req, tenantId, 'guest_lists', 'read');
  if (guard) return guard;

  try {
    await ensureTable();

    // Support filtering by ?eventId=xxx
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    let sql = `SELECT * FROM ${TABLE} WHERE "tenantId" = $1 AND "isDeleted" = false`;
    const queryParams: any[] = [tenantId];

    if (eventId) {
      sql += ` AND "eventId" = $2`;
      queryParams.push(eventId);
    }

    sql += ` ORDER BY "createdAt" DESC`;

    const items = await pgQuery(sql, queryParams);
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const guard = apiGuard(req, tenantId, 'guest_lists', 'write');
  if (guard) return guard;

  try {
    await ensureTable();
    const data = await req.json();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await pgQuery(
      `INSERT INTO ${TABLE} (id, "tenantId", "eventId", "guestName", "guestEmail", "guestPhone", "rsvpStatus", "mealPreference", "plusOne", "plusOneName", "tableAssignment", notes, "isDeleted", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, $13, $13)`,
      [
        id,
        tenantId,
        data.eventId || '',
        data.guestName || '',
        data.guestEmail || '',
        data.guestPhone || '',
        data.rsvpStatus || 'pending',
        data.mealPreference || '',
        data.plusOne || false,
        data.plusOneName || '',
        data.tableAssignment || '',
        data.notes || '',
        now,
      ]
    );

    const created = await pgQueryOne(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const guard = apiGuard(req, tenantId, 'guest_lists', 'write');
  if (guard) return guard;

  try {
    await ensureTable();
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const [k, v] of Object.entries(fields)) {
      setParts.push(`"${k}" = $${pIdx++}`);
      paramValues.push(v);
    }
    setParts.push(`"updatedAt" = NOW()`);

    await pgQuery(
      `UPDATE ${TABLE} SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1}`,
      [...paramValues, id, tenantId]
    );

    const updated = await pgQueryOne(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const guard = apiGuard(req, tenantId, 'guest_lists', 'delete');
  if (guard) return guard;

  try {
    await ensureTable();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await pgQuery(
      `UPDATE ${TABLE} SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
