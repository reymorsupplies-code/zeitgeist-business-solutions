import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    if (!auth.success || !auth.payload) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: auth.status || 401 });
    }

    const user = await db.platformUser.findUnique({
      where: { id: auth.payload.userId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, avatarUrl: true, country: true, timezone: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
