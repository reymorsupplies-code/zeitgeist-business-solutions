/**
 * Accountant Access API
 *
 * GET    — Returns read-only financial data for accountant review
 *          (trial balance, journal entries, bookkeeping entries)
 *          Structured for spreadsheet export.
 *
 * POST   — Invite an accountant
 *          Creates a PlatformUser with role "accountant"
 *          Creates TenantMembership with role "accountant"
 *          Sends invitation email via Resend.
 *
 * DELETE — Remove accountant access
 *          Removes TenantMembership for the specified user/tenant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, isValidEmail, checkRateLimit } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { hashPassword } from '@/lib/auth';
import { sendEmail, FROM_EMAIL } from '@/lib/email';

// ─── Helpers ───

function parseJsonSafe(raw: any): any {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
}

function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// ─── Ensure JournalEntry & JournalEntryLine tables exist ───

async function ensureJournalTables(): Promise<void> {
  try {
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "JournalEntry" (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"  TEXT NOT NULL,
        date        TIMESTAMPTZ NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        reference   TEXT,
        status      TEXT NOT NULL DEFAULT 'draft',
        "isDeleted" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "JournalEntryLine" (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "journalEntryId" TEXT NOT NULL REFERENCES "JournalEntry"(id) ON DELETE CASCADE,
        accountName     TEXT NOT NULL DEFAULT '',
        accountType     TEXT NOT NULL DEFAULT '',
        "debitAmount"   NUMERIC(14,2) NOT NULL DEFAULT 0,
        "creditAmount"  NUMERIC(14,2) NOT NULL DEFAULT 0,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_JournalEntry_tenantId" ON "JournalEntry"("tenantId");`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_JournalEntryLine_journalEntryId" ON "JournalEntryLine"("journalEntryId");`);
  } catch (err: any) {
    console.error('[accountant] Error ensuring journal tables:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// GET — Read-only financial data for accountant
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureJournalTables();

    // ─── Tenant info ───
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, currency: true, country: true, settings: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const settings = parseJsonSafe(tenant.settings);
    const currency = tenant.currency || 'TTD';

    // ─── 1. Trial Balance (summary of all accounts) ───
    const bookkeepingEntries = await db.bookkeepingEntry.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: { date: 'asc' },
    });

    // Build trial balance by account/category
    const accountBalances: Record<string, { debitTotal: number; creditTotal: number; netBalance: number }> = {};
    for (const entry of bookkeepingEntries) {
      const account = entry.category || entry.accountId || 'Uncategorized';
      if (!accountBalances[account]) {
        accountBalances[account] = { debitTotal: 0, creditTotal: 0, netBalance: 0 };
      }
      if (entry.type === 'debit') {
        accountBalances[account].debitTotal += entry.amount.toNumber();
      } else {
        accountBalances[account].creditTotal += entry.amount.toNumber();
      }
      accountBalances[account].netBalance = round2(accountBalances[account].debitTotal - accountBalances[account].creditTotal);
    }

    const trialBalance = Object.entries(accountBalances).map(([account, balances]) => ({
      account,
      debitTotal: round2(balances.debitTotal),
      creditTotal: round2(balances.creditTotal),
      netBalance: round2(balances.netBalance),
      currency,
    }));

    const totalDebits = round2(trialBalance.reduce((s, a) => s + a.debitTotal, 0));
    const totalCredits = round2(trialBalance.reduce((s, a) => s + a.creditTotal, 0));

    // ─── 2. Bookkeeping Entries (formatted for accountant) ───
    const formattedEntries = bookkeepingEntries.map(e => ({
      id: e.id,
      date: e.date.toISOString().split('T')[0],
      description: e.description,
      category: e.category || 'Uncategorized',
      type: e.type,
      amount: round2(e.amount.toNumber()),
      currency: e.currency || currency,
      reference: e.reference,
      accountId: e.accountId,
    }));

    // ─── 3. Journal Entries ───
    const journalEntries = await pgQuery<any>(
      `SELECT je.*, ARRAY(
        SELECT json_build_object(
          'accountName', jel."accountName",
          'accountType', jel."accountType",
          'debitAmount', jel."debitAmount",
          'creditAmount', jel."creditAmount"
        ) FROM "JournalEntryLine" jel WHERE jel."journalEntryId" = je.id
      ) AS lines
      FROM "JournalEntry" je
      WHERE je."tenantId" = $1 AND je."isDeleted" = false
      ORDER BY je.date DESC, je."createdAt" DESC`,
      [tenantId]
    );

    const formattedJournalEntries = journalEntries.map(je => ({
      id: je.id,
      date: je.date ? new Date(je.date).toISOString().split('T')[0] : null,
      description: je.description,
      reference: je.reference,
      status: je.status,
      lines: parseJsonSafe(je.lines) || [],
    }));

    // ─── 4. Spreadsheet Export Structure ───
    const exportData = {
      trialBalance: {
        headers: ['Account', 'Debit Total', 'Credit Total', 'Net Balance', 'Currency'],
        rows: trialBalance.map(tb => [tb.account, tb.debitTotal, tb.creditTotal, tb.netBalance, currency]),
        summary: { totalDebits, totalCredits, balanced: round2(totalDebits - totalCredits) === 0 },
      },
      bookkeepingEntries: {
        headers: ['Date', 'Description', 'Category', 'Type', 'Amount', 'Currency', 'Reference'],
        rows: formattedEntries.map(e => [e.date, e.description, e.category, e.type, e.amount, e.currency, e.reference]),
      },
      journalEntries: {
        headers: ['Date', 'Description', 'Reference', 'Status', 'Account', 'Debit', 'Credit'],
        rows: formattedJournalEntries.flatMap(je =>
          (Array.isArray(je.lines) ? je.lines : []).map((line: any) => [
            je.date, je.description, je.reference, je.status,
            line.accountName || '', Number(line.debitAmount) || 0, Number(line.creditAmount) || 0,
          ])
        ),
      },
    };

    // ─── 5. Accountant team members ───
    const accountantMemberships = await db.tenantMembership.findMany({
      where: { tenantId, role: 'accountant', status: 'active' },
      include: { user: { select: { id: true, email: true, fullName: true, isActive: true, lastActiveAt: true } } },
    });

    return NextResponse.json({
      reportMeta: {
        tenantId,
        tenantName: tenant.name,
        currency,
        country: tenant.country || 'TT',
        generatedAt: new Date().toISOString(),
        birNumber: settings.birNumber || null,
        tin: settings.tin || null,
        vatRegistrationNumber: settings.vatRegistrationNumber || null,
      },
      trialBalance: {
        accounts: trialBalance,
        totalDebits,
        totalCredits,
        isBalanced: round2(totalDebits - totalCredits) === 0,
      },
      bookkeepingEntries: formattedEntries,
      journalEntries: formattedJournalEntries,
      exportData,
      accountantTeam: accountantMemberships.map(m => ({
        userId: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
        isActive: m.user.isActive,
        lastActiveAt: m.user.lastActiveAt,
        role: m.role,
      })),
    });
  } catch (error: any) {
    console.error('[accountant] GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST — Invite Accountant
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(
    `accountant-invite:${req.headers.get('x-forwarded-for') || 'unknown'}`,
    5,
    60_000
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let data: any;
  try { data = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, fullName } = data;
  if (!email || !fullName) {
    return NextResponse.json({ error: 'email and fullName are required' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  try {
    // ─── Check if user already exists ───
    let user = await db.platformUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Create new PlatformUser with accountant role
      const tempPassword = crypto.randomUUID().slice(0, 12) + '!Tt1';
      const hashedPw = await hashPassword(tempPassword);
      user = await db.platformUser.create({
        data: {
          email: email.toLowerCase(),
          fullName,
          password: hashedPw,
          role: 'accountant',
          isActive: true,
          country: 'TT',
        },
      });
    }

    // ─── Check if membership already exists ───
    const existingMembership = await db.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });

    if (existingMembership) {
      if (existingMembership.role === 'accountant' && existingMembership.status === 'active') {
        return NextResponse.json(
          { error: 'This accountant already has access to this tenant' },
          { status: 409 }
        );
      }
      // Update existing membership to accountant
      await db.tenantMembership.update({
        where: { id: existingMembership.id },
        data: { role: 'accountant', status: 'active' },
      });
    } else {
      // Create new TenantMembership
      await db.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId,
          role: 'accountant',
          status: 'active',
        },
      });
    }

    // ─── Send invitation email ───
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });

    const emailHtml = `
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Accountant Invitation — ZBS</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;min-height:100%;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,26,46,0.08);">
<tr><td style="background:linear-gradient(135deg,#0F1A2E,#1E3A8A);padding:32px 40px;text-align:center;">
<span style="color:#fff;font-size:20px;font-weight:700;">Zeitgeist Business Solutions</span>
</td></tr>
<tr><td style="padding:32px 40px;font-size:15px;line-height:1.7;color:#334155;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F1A2E;">Accountant Access Invitation</h1>
<p>Hi ${fullName},</p>
<p>You have been invited by <strong>${tenant?.name || 'a business'}</strong> to access their financial data as an accountant on Zeitgeist Business Solutions.</p>
<p><strong>Your Access Includes:</strong></p>
<ul style="padding-left:20px;margin:16px 0;">
<li>Read-only access to trial balance and bookkeeping entries</li>
<li>Journal entry review</li>
<li>Property fiscal reports and tax summaries</li>
<li>Export data for spreadsheet analysis</li>
</ul>
<p>To get started, log in to your account at <a href="https://zeitgeist.business" style="color:#1D4ED8;">zeitgeist.business</a>.</p>
<p style="font-size:13px;color:#94A3B8;">If you did not expect this invitation, you can safely ignore this email.</p>
</td></tr>
<tr><td style="padding:24px 40px;text-align:center;font-size:12px;color:#94A3B8;border-top:1px solid #E2E8F0;">
&copy; ${new Date().getFullYear()} Zeitgeist Business Solutions
</td></tr>
</table></td></tr></table></body></html>`;

    await sendEmail(
      email.toLowerCase(),
      `Accountant Access Invitation — ${tenant?.name || 'ZBS'}`,
      emailHtml
    );

    return NextResponse.json({
      success: true,
      message: `Accountant invitation sent to ${email}`,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: 'accountant',
      tenantId,
    });
  } catch (error: any) {
    console.error('[accountant] POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE — Remove Accountant Access
// ═══════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  let data: any;
  try { data = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { userId } = data;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    // ─── Find and remove the membership ───
    const membership = await db.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    if (membership.role !== 'accountant') {
      return NextResponse.json(
        { error: 'Cannot remove non-accountant roles via this endpoint' },
        { status: 400 }
      );
    }

    await db.tenantMembership.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({
      success: true,
      message: `Accountant access removed for user ${userId}`,
      userId,
      tenantId,
    });
  } catch (error: any) {
    console.error('[accountant] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
