import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { token, email, newPassword } = await req.json();

    if (!token || !email || !newPassword) {
      return NextResponse.json({ error: 'Token, email, and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Find user with matching reset token that hasn't expired
    const user = await pgQueryOne<any>(
      `SELECT id, email, "fullName", "resetTokenExpiry" FROM "PlatformUser"
       WHERE email = $1 AND "resetToken" = $2`,
      [email.toLowerCase().trim(), token]
    );

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Check if token has expired
    if (new Date(user.resetTokenExpiry) < new Date()) {
      return NextResponse.json({ error: 'Reset token has expired. Please request a new one.' }, { status: 400 });
    }

    // Hash new password and update user
    const hashedPassword = await hashPassword(newPassword);

    await pgQuery(
      `UPDATE "PlatformUser"
       SET password = $1, "resetToken" = NULL, "resetTokenExpiry" = NULL, "updatedAt" = NOW()
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    return NextResponse.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
