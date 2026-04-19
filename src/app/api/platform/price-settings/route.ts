import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const settings = await db.priceSetting.findMany();
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const setting = await db.priceSetting.upsert({
      where: { key: data.key },
      update: { valueUSD: data.valueUSD, valueTTD: data.valueTTD },
      create: { key: data.key, valueUSD: data.valueUSD, valueTTD: data.valueTTD, planId: data.planId }
    });
    return NextResponse.json(setting);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
