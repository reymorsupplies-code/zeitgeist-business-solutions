import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const events = await db.systemEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return NextResponse.json({ events })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
