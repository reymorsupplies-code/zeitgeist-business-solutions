import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const users = await db.platformUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, isActive: true, lastActiveAt: true, lastLogin: true, country: true, timezone: true, createdAt: true, updatedAt: true, tenantMemberships: { include: { tenant: { select: { id: true, name: true, slug: true, status: true } } } } },
    });
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data.email || !data.password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (data.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const hashedPassword = await hashPassword(data.password);
    const user = await db.platformUser.create({
      data: { email: data.email.toLowerCase().trim(), password: hashedPassword, fullName: data.fullName, role: data.role || 'tenant_admin', isActive: true }
    });
    // Never return password in response
    const { password: _pw, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
