import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const users = await db.platformUser.findMany({ orderBy: { createdAt: 'desc' }, include: { tenantMemberships: { include: { tenant: true } } } });
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const user = await db.platformUser.create({
      data: { email: data.email, password: data.password, fullName: data.fullName, role: data.role || 'tenant_admin', isActive: true }
    });
    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
