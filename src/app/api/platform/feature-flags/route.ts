import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const flags = await db.tenantFeatureFlag.findMany()
    return NextResponse.json({ flags })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const flag = await db.tenantFeatureFlag.upsert({
      where: { tenantId_featureSlug: { tenantId: data.tenantId, featureSlug: data.featureSlug } },
      update: { enabled: data.enabled },
      create: { tenantId: data.tenantId, featureSlug: data.featureSlug, enabled: data.enabled },
    })
    return NextResponse.json({ flag })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
