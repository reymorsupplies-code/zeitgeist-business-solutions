import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const tenants = await db.tenant.findMany({
      include: { industry: true, plan: true, _count: { select: { orders: true, clients: true } } },
    })
    const byIndustry: Record<string, number> = {}
    const byPlan: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const t of tenants) {
      const ind = t.industry?.name || 'Unknown'
      byIndustry[ind] = (byIndustry[ind] || 0) + 1
      const plan = t.plan?.name || 'None'
      byPlan[plan] = (byPlan[plan] || 0) + 1
      byStatus[t.status] = (byStatus[t.status] || 0) + 1
    }
    return NextResponse.json({ byIndustry, byPlan, byStatus, totalTenants: tenants.length })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
