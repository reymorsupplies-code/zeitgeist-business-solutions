import { NextResponse } from 'next/server';
import { pgQueryOne } from '@/lib/pg-query';

/**
 * Seed route — uses only the Management API since Prisma can't connect
 * to Supabase (IPv6-only DNS, pooler not registered).
 *
 * Since the seed was already run manually via Management API,
 * this route just checks if the admin exists and returns "Already seeded" if so.
 */
export async function POST() {
  try {
    const admin = await pgQueryOne<any>(
      `SELECT id, email, role FROM "PlatformUser" WHERE email = 'admin@zeitgeist.com' LIMIT 1`
    );

    if (admin) {
      return NextResponse.json({ message: 'Already seeded' });
    }

    return NextResponse.json({ error: 'System not seeded. Run seed manually via Management API.' }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
