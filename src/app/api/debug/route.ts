import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

export async function GET() {
  const results: Record<string, any> = {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? `SET (${process.env.DATABASE_URL.substring(0, 50)}...)` : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `SET (${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...)` : 'NOT SET',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'SET' : 'NOT SET',
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV || 'NOT SET',
    },
    prisma: { status: 'not tested', error: null },
    supabase: { configured: !!process.env.DATABASE_URL, status: 'not tested', error: null },
  };

  // Test Prisma
  try {
    const count = await db.platformUser.count();
    results.prisma = { status: 'connected', userCount: count };
  } catch (err: any) {
    results.prisma = { status: 'failed', error: err.message || String(err) };
  }

  // Test Supabase Management API
  if (process.env.DATABASE_URL) {
    try {
      const rows = await pgQuery('SELECT count(*)::int as total FROM "PlatformUser"');
      results.supabase = { status: 'connected', userCount: rows[0]?.total || 0 };
    } catch (err: any) {
      results.supabase = { status: 'failed', error: err.message || String(err) };
    }
  }

  return NextResponse.json(results);
}
