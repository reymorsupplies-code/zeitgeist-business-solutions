import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields, checkRateLimit } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── Gift Card Helpers ───

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

// ─── GET: List POS sales ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('from');
  const dateTo = url.searchParams.get('to');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '100');

  try {
    const where: any = { tenantId, isDeleted: false };
    if (status && status !== 'all') where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const sales = await db.pOSSale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json(sales);
  } catch {
    try {
      let sql = `SELECT * FROM "POSSale" WHERE "tenantId" = $1 AND "isDeleted" = false`;
      const params: any[] = [tenantId];
      let idx = 2;
      if (status && status !== 'all') { sql += ` AND status = $${idx++}`; params.push(status); }
      if (dateFrom) { sql += ` AND "createdAt" >= $${idx++}`; params.push(dateFrom); }
      if (dateTo) { sql += ` AND "createdAt" <= $${idx++}`; params.push(dateTo); }
      sql += ` ORDER BY "createdAt" DESC LIMIT 100`;
      const sales = await pgQuery<any>(sql, params);
      return NextResponse.json(sales);
    } catch (err: any) {
        console.error('[pos-sales] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── POST: Create POS sale + deduct stock + gift card integration ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(`pos-sales-post:${req.headers.get('x-forwarded-for') || 'unknown'}`, 30, 60_000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const paymentMethod = data.paymentMethod || 'cash';
  const totalAmount = data.totalAmount || 0;
  const giftCardId = data.giftCardId || null;
  const splitDetails = data.splitDetails || null;

  // ─── Validate gift card payment requirements ───
  if (paymentMethod === 'gift_card') {
    if (!giftCardId) {
      return NextResponse.json({ error: 'giftCardId is required for gift_card payment' }, { status: 400 });
    }
  }

  if (paymentMethod === 'split') {
    if (!splitDetails) {
      return NextResponse.json({ error: 'splitDetails is required for split payment' }, { status: 400 });
    }
    const parts = splitDetails;
    const sumParts = (parts.cash || 0) + (parts.card || 0) + (parts.giftCard || 0) + (parts.transfer || 0);
    if (Math.abs(sumParts - totalAmount) > 0.01) {
      return NextResponse.json({ error: `Split total (${sumParts}) does not match sale total (${totalAmount})` }, { status: 400 });
    }
    if ((parts.giftCard || 0) > 0 && !parts.giftCardId) {
      return NextResponse.json({ error: 'giftCardId is required in splitDetails when giftCard amount > 0' }, { status: 400 });
    }
  }

  try {
    // ─── Validate gift card before creating sale ───
    let giftCard: any = null;
    let giftCardDeductAmount = 0;

    if (paymentMethod === 'gift_card') {
      giftCard = await db.giftCard.findFirst({ where: { id: giftCardId, tenantId, isDeleted: false } });
      if (!giftCard) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
      if (giftCard.status !== 'active') return NextResponse.json({ error: `Gift card is ${giftCard.status}` }, { status: 400 });
      if (giftCard.expiresAt && new Date(giftCard.expiresAt) < new Date()) return NextResponse.json({ error: 'Gift card has expired' }, { status: 400 });
      if (giftCard.currentBalance < totalAmount) return NextResponse.json({ error: 'Insufficient gift card balance' }, { status: 400 });
      giftCardDeductAmount = totalAmount;
    }

    if (paymentMethod === 'split' && (splitDetails?.giftCard || 0) > 0) {
      giftCard = await db.giftCard.findFirst({ where: { id: splitDetails.giftCardId, tenantId, isDeleted: false } });
      if (!giftCard) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
      if (giftCard.status !== 'active') return NextResponse.json({ error: `Gift card is ${giftCard.status}` }, { status: 400 });
      if (giftCard.expiresAt && new Date(giftCard.expiresAt) < new Date()) return NextResponse.json({ error: 'Gift card has expired' }, { status: 400 });
      if (giftCard.currentBalance < splitDetails.giftCard) return NextResponse.json({ error: 'Insufficient gift card balance' }, { status: 400 });
      giftCardDeductAmount = splitDetails.giftCard;
    }

    // Generate sale number with retry loop for unique constraint
    let sale: any;
    let saleNumber = '';
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const count = await db.pOSSale.count({ where: { tenantId } });
        saleNumber = `SL-${String(count + 1).padStart(5, '0')}`;
        sale = await db.pOSSale.create({
          data: {
            tenantId,
            saleNumber,
            items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
            subtotal: data.subtotal || 0,
            discountPct: data.discountPct || 0,
            discountAmount: data.discountAmount || 0,
            taxAmount: data.taxAmount || 0,
            totalAmount,
            paymentMethod,
            cashReceived: data.cashReceived || 0,
            changeAmount: data.changeAmount || 0,
            currency: data.currency || 'TTD',
            customerName: data.customerName || '',
            staffName: data.staffName || '',
            status: data.status || 'completed',
          },
        });
        break;
      } catch (err: any) {
        if (err.code === 'P2002' && attempts < maxAttempts - 1) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    // ─── Deduct from gift card (atomic) ───
    if (giftCard && giftCardDeductAmount > 0 && sale.status === 'completed') {
      const deductResult = await db.$executeRaw`
        UPDATE "GiftCard" 
        SET "currentBalance" = "currentBalance" - ${giftCardDeductAmount}, 
            "lastUsedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE id = ${giftCard.id} AND "tenantId" = ${tenantId} AND "currentBalance" >= ${giftCardDeductAmount}
      `;

      // Check if deduction actually happened (rowCount)
      // If the atomic check failed (balance changed between check and update), we need to handle it
      // Re-fetch to verify
      const updatedCard = await db.giftCard.findFirst({ where: { id: giftCard.id, tenantId } });
      if (!updatedCard || Number(updatedCard.currentBalance) > Number(giftCard.currentBalance) - giftCardDeductAmount + 0.01) {
        // Deduction failed — the gift card balance was changed between our check and update
        // We should NOT have created the sale. Delete it and return error.
        await db.pOSSale.delete({ where: { id: sale.id } });
        return NextResponse.json({ error: 'Gift card balance changed. Please try again.' }, { status: 409 });
      }

      // Append redemption transaction
      const txns = parseTransactions(updatedCard.transactions);
      txns.push({
        date: new Date().toISOString(),
        type: 'redemption',
        amount: giftCardDeductAmount,
        reference: `POS Sale ${saleNumber}`,
        saleId: sale.id,
      });

      const newBalance = Math.round(Number(updatedCard.currentBalance) * 100) / 100;
      await db.giftCard.update({
        where: { id: giftCard.id },
        data: {
          transactions: stringifyTransactions(txns),
          status: newBalance <= 0 ? 'used' : 'active',
        },
      });
    }

    // Deduct stock for each item (atomic)
    if (sale.status === 'completed' && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.productId && item.qty > 0) {
          try {
            await db.$executeRaw`UPDATE "RetailProduct" SET quantity = GREATEST(0, quantity - ${item.qty}) WHERE id = ${item.productId} AND "tenantId" = ${tenantId}`;
          } catch { /* stock deduction best-effort */ }
        }
      }
    }

    return NextResponse.json(sale);
  } catch (error: any) {
    try {
      // pg fallback — data already parsed
      // ─── Validate gift card (pg) ───
      let giftCard: any = null;
      let giftCardDeductAmount = 0;

      if (paymentMethod === 'gift_card') {
        giftCard = await pgQueryOne<any>(`SELECT * FROM "GiftCard" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`, [giftCardId, tenantId]);
        if (!giftCard) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
        if (giftCard.status !== 'active') return NextResponse.json({ error: `Gift card is ${giftCard.status}` }, { status: 400 });
        if (giftCard.expiresAt && new Date(giftCard.expiresAt) < new Date()) return NextResponse.json({ error: 'Gift card has expired' }, { status: 400 });
        if (giftCard.currentBalance < totalAmount) return NextResponse.json({ error: 'Insufficient gift card balance' }, { status: 400 });
        giftCardDeductAmount = totalAmount;
      }

      if (paymentMethod === 'split' && (splitDetails?.giftCard || 0) > 0) {
        giftCard = await pgQueryOne<any>(`SELECT * FROM "GiftCard" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`, [splitDetails.giftCardId, tenantId]);
        if (!giftCard) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
        if (giftCard.status !== 'active') return NextResponse.json({ error: `Gift card is ${giftCard.status}` }, { status: 400 });
        if (giftCard.expiresAt && new Date(giftCard.expiresAt) < new Date()) return NextResponse.json({ error: 'Gift card has expired' }, { status: 400 });
        if (giftCard.currentBalance < splitDetails.giftCard) return NextResponse.json({ error: 'Insufficient gift card balance' }, { status: 400 });
        giftCardDeductAmount = splitDetails.giftCard;
      }

      // Generate sale number with retry loop for unique constraint (pg fallback)
      let saleNumber = '';
      let created: any;
      let pgAttempts = 0;
      const pgMaxAttempts = 3;
      while (pgAttempts < pgMaxAttempts) {
        try {
          const count = await pgQuery<any>(`SELECT COUNT(*)::int as c FROM "POSSale" WHERE "tenantId" = $1`, [tenantId]);
          const cn = (count[0]?.c || 0) + 1;
          saleNumber = `SL-${String(cn).padStart(5, '0')}`;
          const itemsStr = typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []);
          const now = new Date().toISOString();

          await pgQuery(
            `INSERT INTO "POSSale" ("tenantId","saleNumber","items","subtotal","discountPct","discountAmount","taxAmount","totalAmount","paymentMethod","cashReceived","changeAmount","currency","customerName","staffName","status","isDeleted","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,$16,$17)`,
            [tenantId, saleNumber, itemsStr, data.subtotal || 0, data.discountPct || 0, data.discountAmount || 0, data.taxAmount || 0, data.totalAmount || 0, data.paymentMethod || 'cash', data.cashReceived || 0, data.changeAmount || 0, data.currency || 'TTD', data.customerName || '', data.staffName || '', data.status || 'completed', now, now]
          );

          created = await pgQueryOne<any>(`SELECT * FROM "POSSale" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
          break;
        } catch (pgErr: any) {
          if (pgErr.code === '23505' && pgAttempts < pgMaxAttempts - 1) {
            pgAttempts++;
            continue;
          }
          throw pgErr;
        }
      }

      // ─── Deduct from gift card (pg) ───
      if (giftCard && giftCardDeductAmount > 0 && (data.status || 'completed') === 'completed') {
        await pgQuery(
          `UPDATE "GiftCard" SET "currentBalance" = "currentBalance" - $1, "lastUsedAt" = NOW(), "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3 AND "currentBalance" >= $1`,
          [giftCardDeductAmount, giftCard.id, tenantId]
        );

        // Re-fetch to verify deduction and build transactions
        const updatedCard = await pgQueryOne<any>(`SELECT * FROM "GiftCard" WHERE id = $1`, [giftCard.id]);
        if (updatedCard) {
          const txns = parseTransactions(updatedCard.transactions);
          txns.push({
            date: new Date().toISOString(),
            type: 'redemption',
            amount: giftCardDeductAmount,
            reference: `POS Sale ${saleNumber}`,
            saleId: created?.id || null,
          });

          const newBalance = Math.round(Number(updatedCard.currentBalance) * 100) / 100;
          await pgQuery(
            `UPDATE "GiftCard" SET "transactions" = $1, status = $2 WHERE id = $3 AND "tenantId" = $4`,
            [stringifyTransactions(txns), newBalance <= 0 ? 'used' : 'active', giftCard.id, tenantId]
          );
        }
      }

      // Deduct stock
      if (data.status === 'completed' && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.productId && item.qty > 0) {
            try {
              await pgQuery(`UPDATE "RetailProduct" SET quantity = GREATEST(0, quantity - $1), "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [item.qty, item.productId, tenantId]);
            } catch { /* best-effort */ }
          }
        }
      }

      return NextResponse.json(created);
    } catch (err: any) {
        console.error('[pos-sales] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── PUT: Update sale status (void, hold) + gift card restoration ───
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(`pos-sales-put:${req.headers.get('x-forwarded-for') || 'unknown'}`, 30, 60_000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const updated = await db.pOSSale.update({
      where: { id, tenantId },
      data: whitelistFields('POSSale', fields),
    });

    // If voiding a completed sale, restore stock + gift card
    if (fields.status === 'voided') {
      const sale = await db.pOSSale.findFirst({ where: { id, tenantId } });

      if (sale) {
        // Restore stock
        const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
        for (const item of items) {
          if (item.productId && item.qty > 0) {
            try {
              await db.$executeRaw`UPDATE "RetailProduct" SET quantity = quantity + ${item.qty} WHERE id = ${item.productId} AND "tenantId" = ${tenantId}`;
            } catch { /* best-effort */ }
          }
        }

        // Restore gift card balance
        await restoreGiftCardBalance(sale, tenantId, 'prisma');
      }
    }

    return NextResponse.json(updated);
  } catch {
    try {
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(fields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "POSSale" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);

      // Restore stock + gift card if voiding
      if (fields.status === 'voided') {
        const sale = await pgQueryOne<any>(`SELECT * FROM "POSSale" WHERE id = $1`, [id]);
        if (sale) {
          // Restore stock
          const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
          for (const item of items) {
            if (item.productId && item.qty > 0) {
              try { await pgQuery(`UPDATE "RetailProduct" SET quantity = quantity + $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [item.qty, item.productId, tenantId]); } catch { /* best-effort */ }
            }
          }

          // Restore gift card balance
          await restoreGiftCardBalancePG(sale, tenantId);
        }
      }

      const updated = await pgQueryOne(`SELECT * FROM "POSSale" WHERE id = $1`, [id]);
      return NextResponse.json(updated);
    } catch (err: any) {
        console.error('[pos-sales] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

// ─── Gift Card Restoration Helpers ───

/**
 * Determine the gift card refund amount and card ID from a sale.
 * Works for both 'gift_card' and 'split' payment methods.
 */
function getGiftCardRefundInfo(sale: any): { giftCardId: string | null; refundAmount: number } {
  if (sale.paymentMethod === 'gift_card') {
    return { giftCardId: sale.giftCardId || null, refundAmount: sale.totalAmount || 0 };
  }

  if (sale.paymentMethod === 'split' && sale.splitDetails) {
    const split = typeof sale.splitDetails === 'string' ? JSON.parse(sale.splitDetails) : sale.splitDetails;
    if (split.giftCardId && (split.giftCard || 0) > 0) {
      return { giftCardId: split.giftCardId, refundAmount: split.giftCard };
    }
  }

  // Also try to find giftCardId directly on the sale for backward compat
  if (sale.giftCardId && sale.paymentMethod === 'gift_card') {
    return { giftCardId: sale.giftCardId, refundAmount: sale.totalAmount || 0 };
  }

  return { giftCardId: null, refundAmount: 0 };
}

async function restoreGiftCardBalance(sale: any, tenantId: string, _mode: string): Promise<void> {
  const { giftCardId, refundAmount } = getGiftCardRefundInfo(sale);
  if (!giftCardId || refundAmount <= 0) return;

  try {
    const giftCard = await db.giftCard.findFirst({ where: { id: giftCardId, tenantId, isDeleted: false } });
    if (!giftCard) return;

    const newBalance = Math.round((Number(giftCard.currentBalance) + refundAmount) * 100) / 100;
    const txns = parseTransactions(giftCard.transactions);
    txns.push({
      date: new Date().toISOString(),
      type: 'refund',
      amount: refundAmount,
      reference: `Refund for voided sale ${sale.saleNumber || sale.id}`,
      saleId: sale.id,
    });

    await db.giftCard.update({
      where: { id: giftCardId },
      data: {
        currentBalance: newBalance,
        transactions: stringifyTransactions(txns),
        status: 'active', // Reactivate if it was 'used'
      },
    });
  } catch { /* gift card restoration best-effort */ }
}

async function restoreGiftCardBalancePG(sale: any, tenantId: string): Promise<void> {
  const { giftCardId, refundAmount } = getGiftCardRefundInfo(sale);
  if (!giftCardId || refundAmount <= 0) return;

  try {
    const giftCard = await pgQueryOne<any>(`SELECT * FROM "GiftCard" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`, [giftCardId, tenantId]);
    if (!giftCard) return;

    const newBalance = Math.round((Number(giftCard.currentBalance) + refundAmount) * 100) / 100;
    const txns = parseTransactions(giftCard.transactions);
    txns.push({
      date: new Date().toISOString(),
      type: 'refund',
      amount: refundAmount,
      reference: `Refund for voided sale ${sale.saleNumber || sale.id}`,
      saleId: sale.id,
    });

    await pgQuery(
      `UPDATE "GiftCard" SET "currentBalance" = $1, "transactions" = $2, status = 'active', "updatedAt" = NOW() WHERE id = $3 AND "tenantId" = $4`,
      [newBalance, stringifyTransactions(txns), giftCardId, tenantId]
    );
  } catch { /* gift card restoration best-effort */ }
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
    await db.pOSSale.update({ where: { id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "POSSale" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[pos-sales] Error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}
