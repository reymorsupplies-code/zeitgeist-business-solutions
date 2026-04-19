import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const invoices = await db.platformInvoice.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ invoices })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
