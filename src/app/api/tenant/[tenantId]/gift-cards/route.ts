import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields, checkRateLimit } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── Helpers ───

function generateCardNumber(): string {
  const r = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GC-${r()}-${r()}-${r()}`;
}

function generateCardCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += Math.floor(Math.random() * 10);
  return code;
}

function parseTransactions(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function stringifyTransactions(txns: any[]): string {
  return JSON.stringify(txns);
}

// ─── GET: List gift cards with filters ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const cardNumber = url.searchParams.get('cardNumber');
  const cardCode = url.searchParams.get('cardCode');

  try {
    const where: any = { tenantId, isDeleted: false };
    if (status && status !== 'all') where.status = status;
    if (cardNumber) where.cardNumber = cardNumber.toUpperCase().trim();
    if (cardCode) where.cardCode = cardCode.trim();

    if (search) {
      where.OR = [
        { cardNumber: { contains: search.toUpperCase().trim(), mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { purchaserName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const cards = await db.giftCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json(cards);
  } catch {
    try {
      let sql = `SELECT * FROM "GiftCard" WHERE "tenantId" = $1 AND "isDeleted" = false`;
      const params: any[] = [tenantId];
      let idx = 2;
      if (status && status !== 'all') { sql += ` AND status = $${idx++}`; params.push(status); }
      if (cardNumber) { sql += ` AND "cardNumber" = $${idx++}`; params.push(cardNumber.toUpperCase().trim()); }
      if (cardCode) { sql += ` AND "cardCode" = $${idx++}`; params.push(cardCode.trim()); }
      if (search) { sql += ` AND ("cardNumber" ILIKE $${idx} OR "customerName" ILIKE $${idx} OR "purchaserName" ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
      sql += ` ORDER BY "createdAt" DESC LIMIT 200`;
      const cards = await pgQuery<any>(sql, params);
      return NextResponse.json(cards);
    } catch (err: any) {
        console.error('[gift-cards] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── POST: Issue new gift card ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  try {
    const initialBalance = parseFloat(data.initialBalance) || 0;
    if (initialBalance <= 0) {
      return NextResponse.json({ error: 'Initial balance must be greater than 0' }, { status: 400 });
    }

    let cardNumber = generateCardNumber();
    let cardCode = generateCardCode();

    // Ensure uniqueness (retry up to 5 times)
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const card = await db.giftCard.create({
          data: {
            tenantId,
            cardNumber,
            cardCode,
            initialBalance,
            currentBalance: initialBalance,
            customerName: data.customerName || null,
            purchaserName: data.purchaserName || '',
            status: 'active',
            issuedAt: new Date(),
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            transactions: stringifyTransactions([{
              date: new Date().toISOString(),
              type: 'purchase',
              amount: initialBalance,
              reference: `Issued to ${data.customerName || 'N/A'}`,
            }]),
            notes: data.notes || '',
          },
        });
        return NextResponse.json(card);
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 4) {
          cardNumber = generateCardNumber();
          cardCode = generateCardCode();
          continue;
        }
        throw err;
      }
    }
    return NextResponse.json({ error: 'Failed to generate unique card' }, { status: 500 });
  } catch (error: any) {
    try {
      // pg fallback — data already parsed
      const initialBalance = parseFloat(data.initialBalance) || 0;
      if (initialBalance <= 0) {
        return NextResponse.json({ error: 'Initial balance must be greater than 0' }, { status: 400 });
      }

      let cardNumber = generateCardNumber();
      let cardCode = generateCardCode();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const initialTxn = stringifyTransactions([{
        date: now,
        type: 'purchase',
        amount: initialBalance,
        reference: `Issued to ${data.customerName || 'N/A'}`,
      }]);

      await pgQuery(
        `INSERT INTO "GiftCard" (id, "tenantId", "cardNumber", "cardCode", "initialBalance", "currentBalance", "customerName", "purchaserName", status, "issuedAt", "expiresAt", "transactions", notes, "isDeleted", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, $12, false, $9, $9)`,
        [id, tenantId, cardNumber, cardCode, initialBalance, initialBalance, data.customerName || null, data.purchaserName || '', now, data.expiresAt ? new Date(data.expiresAt).toISOString() : null, initialTxn, data.notes || '']
      );

      const created = await pgQueryOne(`SELECT * FROM "GiftCard" WHERE id = $1`, [id]);
      return NextResponse.json(created);
    } catch (err: any) {
        console.error('[gift-cards] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── PUT: Reload, Redeem, Void ───
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(`gift-cards-put:${req.headers.get('x-forwarded-for') || 'unknown'}`, 20, 60_000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let requestBody: any;
  try {
    requestBody = await req.json();
    const { id, action, amount, reference, saleId, ...fields } = requestBody;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // ── Reload balance ──
    if (action === 'reload') {
      const reloadAmount = parseFloat(amount) || 0;
      if (reloadAmount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

      const card = await db.giftCard.findFirst({ where: { id, tenantId, isDeleted: false } });
      if (!card) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
      if (card.status === 'voided') return NextResponse.json({ error: 'Card has been voided' }, { status: 400 });
      if (card.status === 'expired') return NextResponse.json({ error: 'Card has expired' }, { status: 400 });

      const txns = parseTransactions(card.transactions);
      txns.push({
        date: new Date().toISOString(),
        type: 'reload',
        amount: reloadAmount,
        reference: reference || 'Balance reload',
      });

      const updated = await db.giftCard.update({
        where: { id },
        data: {
          currentBalance: Number(card.currentBalance) + reloadAmount,
          transactions: stringifyTransactions(txns),
          status: card.status === 'used' ? 'active' : card.status,
        },
      });
      return NextResponse.json(updated);
    }

    // ── Redeem partial amount ──
    if (action === 'redeem') {
      const redeemAmount = parseFloat(amount) || 0;
      if (redeemAmount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

      const card = await db.giftCard.findFirst({ where: { id, tenantId, isDeleted: false } });
      if (!card) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
      if (card.status !== 'active') return NextResponse.json({ error: `Card is ${card.status}` }, { status: 400 });
      if (card.expiresAt && new Date(card.expiresAt) < new Date()) return NextResponse.json({ error: 'Card has expired' }, { status: 400 });
      if (Number(card.currentBalance) < redeemAmount) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });

      const newBalance = Math.round((Number(card.currentBalance) - redeemAmount) * 100) / 100;
      const txns = parseTransactions(card.transactions);
      txns.push({
        date: new Date().toISOString(),
        type: 'redemption',
        amount: redeemAmount,
        reference: reference || 'POS Redemption',
        saleId: saleId || null,
      });

      const updated = await db.giftCard.update({
        where: { id },
        data: {
          currentBalance: newBalance,
          transactions: stringifyTransactions(txns),
          status: newBalance <= 0 ? 'used' : 'active',
          lastUsedAt: new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    // ── Void card ──
    if (action === 'void') {
      const card = await db.giftCard.findFirst({ where: { id, tenantId, isDeleted: false } });
      if (!card) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
      if (card.status === 'voided') return NextResponse.json({ error: 'Card already voided' }, { status: 400 });

      const txns = parseTransactions(card.transactions);
      if (Number(card.currentBalance) > 0) {
        txns.push({
          date: new Date().toISOString(),
          type: 'void',
          amount: card.currentBalance,
          reference: 'Card voided — balance forfeited',
        });
      }

      const updated = await db.giftCard.update({
        where: { id },
        data: {
          status: 'voided',
          currentBalance: 0,
          transactions: stringifyTransactions(txns),
        },
      });
      return NextResponse.json(updated);
    }

    // ── Generic field update ──
    if (fields && Object.keys(fields).length > 0) {
      const existing = await db.giftCard.findFirst({ where: { id, tenantId, isDeleted: false } });
      if (!existing) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });

      const safeFields = whitelistFields('GiftCard', fields);
      if (Object.keys(safeFields).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
      }
      const updated = await db.giftCard.update({
        where: { id },
        data: safeFields,
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'No action specified. Use action: reload|redeem|void' }, { status: 400 });
  } catch (error: any) {
    try {
      const { id, action, amount, reference, saleId, ...fields } = requestBody;
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

      // Fetch existing card
      const card = await pgQueryOne<any>(`SELECT * FROM "GiftCard" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`, [id, tenantId]);
      if (!card) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });

      const txns = parseTransactions(card.transactions);
      let newBalance = card.currentBalance;
      let newStatus = card.status;
      const now = new Date().toISOString();

      if (action === 'reload') {
        const reloadAmount = parseFloat(amount) || 0;
        if (reloadAmount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
        if (card.status === 'voided') return NextResponse.json({ error: 'Card has been voided' }, { status: 400 });
        if (card.status === 'expired') return NextResponse.json({ error: 'Card has expired' }, { status: 400 });
        newBalance = card.currentBalance + reloadAmount;
        txns.push({ date: now, type: 'reload', amount: reloadAmount, reference: reference || 'Balance reload' });
        newStatus = card.status === 'used' ? 'active' : card.status;
      } else if (action === 'redeem') {
        const redeemAmount = parseFloat(amount) || 0;
        if (redeemAmount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
        if (card.status !== 'active') return NextResponse.json({ error: `Card is ${card.status}` }, { status: 400 });
        if (card.expiresAt && new Date(card.expiresAt) < new Date()) return NextResponse.json({ error: 'Card has expired' }, { status: 400 });
        if (card.currentBalance < redeemAmount) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
        newBalance = Math.round((card.currentBalance - redeemAmount) * 100) / 100;
        txns.push({ date: now, type: 'redemption', amount: redeemAmount, reference: reference || 'POS Redemption', saleId: saleId || null });
        newStatus = newBalance <= 0 ? 'used' : 'active';
      } else if (action === 'void') {
        if (card.status === 'voided') return NextResponse.json({ error: 'Card already voided' }, { status: 400 });
        if (Number(card.currentBalance) > 0) {
          txns.push({ date: now, type: 'void', amount: card.currentBalance, reference: 'Card voided — balance forfeited' });
        }
        newBalance = 0;
        newStatus = 'voided';
      }

      if (action === 'reload' || action === 'redeem' || action === 'void') {
        await pgQuery(
          `UPDATE "GiftCard" SET "currentBalance" = $1, "transactions" = $2, status = $3, "lastUsedAt" = CASE WHEN $4 = 'redeem' THEN NOW() ELSE "lastUsedAt" END, "updatedAt" = NOW() WHERE id = $5 AND "tenantId" = $6`,
          [newBalance, stringifyTransactions(txns), newStatus, action || '', id, tenantId]
        );

        const updated = await pgQueryOne(`SELECT * FROM "GiftCard" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
        return NextResponse.json(updated);
      }

      // Generic field update (pg fallback)
      if (fields && Object.keys(fields).length > 0) {
        const safeFields = whitelistFields('GiftCard', fields);
        if (Object.keys(safeFields).length === 0) {
          return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }
        const setParts: string[] = [];
        const paramValues: any[] = [];
        let pIdx = 1;
        for (const [k, v] of Object.entries(safeFields)) {
          setParts.push(`"${k}" = $${pIdx++}`);
          paramValues.push(v);
        }
        setParts.push(`"updatedAt" = NOW()`);
        await pgQuery(`UPDATE "GiftCard" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);

        const updated = await pgQueryOne(`SELECT * FROM "GiftCard" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
        return NextResponse.json(updated);
      }
    } catch (err: any) {
        console.error('[gift-cards] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── DELETE: Soft delete ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const existing = await db.giftCard.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
    await db.giftCard.update({ where: { id }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "GiftCard" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[gift-cards] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}
