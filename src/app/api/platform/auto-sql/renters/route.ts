import { NextResponse } from 'next/server';

export async function POST() {
  // This is called by the init system to ensure Renter table exists
  return NextResponse.json({ message: 'Renter table managed by Prisma schema' });
}
