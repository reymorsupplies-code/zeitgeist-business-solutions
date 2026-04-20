import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List journal entries with lines
export async function GET(req: NextRequest) {
  try {
    const entries = await db.journalEntry.findMany({
      include: { lines: true },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(entries);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST - Create journal entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, description, reference, status, lines } = body;

    // Validate double-entry: debits must equal credits
    const totalDebit = (lines || []).reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
    const totalCredit = (lines || []).reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: `Debits (${totalDebit}) must equal Credits (${totalCredit})` }, { status: 400 });
    }
    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: 'At least one line required' }, { status: 400 });
    }

    const entry = await db.journalEntry.create({
      data: {
        date: new Date(date),
        description: description || '',
        reference: reference || null,
        status: status || 'posted',
        lines: {
          create: lines.map((l: any) => ({
            accountCode: l.accountCode || l.code,
            accountName: l.accountName || l.name,
            accountType: l.accountType || l.type,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        },
      },
      include: { lines: true },
    });
    return NextResponse.json(entry);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE - Delete journal entry (and lines via cascade)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.journalEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
