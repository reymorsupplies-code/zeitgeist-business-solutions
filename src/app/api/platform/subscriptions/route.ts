import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const subscriptions = await db.tenantSubscription.findMany({
      include: { tenant: true, plan: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ subscriptions })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
