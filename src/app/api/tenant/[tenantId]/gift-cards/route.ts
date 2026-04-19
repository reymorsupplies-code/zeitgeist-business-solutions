import { NextRequest, NextResponse } from 'next/server';
import { apiGuard } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

const TABLE = '"GiftCard"';

function generateGiftCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'GIFT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      "initialBalance" DOUBLE PRECISION DEFAULT 0,
      "currentBalance" DOUBLE PRECISION DEFAULT 0,
      "recipientName" TEXT DEFAULT '',
      "recipientEmail" TEXT DEFAULT '',
      "purchaserName" TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      "expiresAt" TIMESTAMP,
      "purchaseDate" TIMESTAMP,
      notes TEXT DEFAULT '',
      "isDeleted" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const guard = apiGuard(req, tenantId, 'gift_cards', 'read');
  if (guard) return guard;

  try {
    await ensureTable();

    // Support lookup by ?code=xxx
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (code) {
      const card = await pgQueryOne(
        `SELECT * FROM ${TABLE} WHERE "tenantId" = $1 AND code = $2 AND "isDeleted" = false`,
        [tenantId, code]
      );
      if (!card) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
      return NextResponse.json(card);
    }

    const items = await pgQuery(
      `SELECT * FROM ${TABLE} WHERE "tenantId" = $1 AND "isDeleted" = false ORDER BY "createdAt" DESC`,
      [tenantId]
    );
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const guard = apiGuard(req, tenantId, 'gift_cards', 'write');
  if (guard) return guard;

  try {
    await ensureTable();
    const data = await req.json();
    const id = crypto.randomUUID();
    const code = data.code || generateGiftCode();
    const now = new Date().toISOString();

    await pgQuery(
      `INSERT INTO ${TABLE} (id, "tenantId", code, "initialBalance", "currentBalance", "recipientName", "recipientEmail", "purchaserName", status, "expiresAt", "purchaseDate", notes, "isDeleted", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, $13, $13)`,
      [
        id,
        tenantId,
        code,
        data.initialBalance || 0,
        data.initialBalance || 0,
        data.recipientName || '',
        data.recipientEmail || '',
        data.purchaserName || '',
        data.status || 'active',
        data.expiresAt || null,
        data.purchaseDate || now,
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

  const guard = apiGuard(req, tenantId, 'gift_cards', 'write');
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

  const guard = apiGuard(req, tenantId, 'gift_cards', 'delete');
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
