import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

export async function GET(_req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
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
    const entries = await db.bookkeepingEntry.findMany({ where: { tenantId, isDeleted: false }, orderBy: { date: 'desc' } });
    
    // Calculate P&L
    const credits = entries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount.toNumber(), 0);
    const debits = entries.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount.toNumber(), 0);
    const netIncome = credits - debits;
    
    // By category
    const categories: Record<string, { credits: number; debits: number }> = {};
    for (const entry of entries) {
      const cat = entry.category || 'Uncategorized';
      if (!categories[cat]) categories[cat] = { credits: 0, debits: 0 };
      if (entry.type === 'credit') categories[cat].credits += entry.amount.toNumber();
      else categories[cat].debits += entry.amount.toNumber();
    }
    
    return NextResponse.json({ entries, summary: { totalCredits: credits, totalDebits: debits, netIncome, categories } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }
  try {
    const data = await req.json();
    const entry = await db.bookkeepingEntry.create({
      data: { tenantId, date: data.date ? new Date(data.date) : new Date(), description: data.description || 'General entry', category: data.category, type: data.type || 'debit', amount: data.amount || 0, currency: data.currency || 'TTD', reference: data.reference, accountId: data.accountId }
    });
    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const existing = await db.bookkeepingEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    const updated = await db.bookkeepingEntry.update({ where: { id }, data: whitelistFields('BookkeepingEntry', fields) });
    return NextResponse.json(updated);
  } catch {
    try {
      const safeFields = whitelistFields('BookkeepingEntry', fields);
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(safeFields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "BookkeepingEntry" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);
      const updated = await pgQueryOne(`SELECT * FROM "BookkeepingEntry" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json(updated);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

export async function DELETE(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
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
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const existing = await db.bookkeepingEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    await db.bookkeepingEntry.update({ where: { id }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "BookkeepingEntry" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
