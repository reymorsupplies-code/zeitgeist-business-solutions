import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/pg-query';
import { sendEmail } from '@/lib/email';
import { trialExpiring, accountSuspended } from '@/lib/email/templates';

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('[CRON] CRON_SECRET environment variable is not configured. This endpoint is disabled.');
}

// This endpoint should be called by a scheduler (Vercel Cron or external)
// every 24 hours. It:
// 1. Suspends trials that have expired
// 2. Sends 3-day warning emails to trials about to expire

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET is configured
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured', code: 'NOT_CONFIGURED' }, { status: 503 });
  }
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { suspended: 0, warned: 0, errors: [] as string[] };

  try {
    // STEP 1: Suspend expired trials
    try {
      const expiredTrials = await pgQuery<any>(
        `SELECT t.id, t.name, t.email, t."trialEndsAt", t.status,
                u.email AS "user_email", u."fullName" AS "user_fullName"
         FROM "Tenant" t
         LEFT JOIN "TenantMembership" tm ON tm."tenantId" = t.id AND tm.role = 'admin'
         LEFT JOIN "PlatformUser" u ON u.id = tm."userId"
         WHERE t.status = 'trial' AND t."trialEndsAt" IS NOT NULL AND t."trialEndsAt" < NOW()`
      );

      for (const trial of expiredTrials) {
        try {
          await pgQuery(
            `UPDATE "Tenant" SET status = 'suspended', "updatedAt" = NOW() WHERE id = $1`,
            [trial.id]
          );

          await pgQuery(
            `INSERT INTO "AuditLog" (action, "tenantId", details, severity, "createdAt")
             VALUES ($1, $2, $3, $4, NOW())`,
            ['trial_expired_auto', trial.id, `Trial for "${trial.name}" expired and was auto-suspended.`, 'warning']
          );

          // Send suspension email
          const userEmail = trial.user_email || trial.email;
          if (userEmail) {
            sendEmail(
              userEmail,
              `Your ${trial.name} trial has expired`,
              accountSuspended({
                name: trial.user_fullName || trial.name,
                tenantName: trial.name,
                reason: `Your free trial expired on ${new Date(trial.trialEndsAt).toLocaleDateString()}. To reactivate your account, please contact us or subscribe to a plan.`,
              }),
            ).catch(() => {});
          }

          results.suspended++;
        } catch (err: any) {
          results.errors.push(`Failed to suspend ${trial.name}: ${err.message}`);
        }
      }
    } catch (err: any) {
      results.errors.push(`Step 1 error: ${err.message}`);
    }

    // STEP 2: Send 3-day warning emails
    try {
      const expiringTrials = await pgQuery<any>(
        `SELECT t.id, t.name, t.email, t."trialEndsAt", t."planName",
                u.email AS "user_email", u."fullName" AS "user_fullName"
         FROM "Tenant" t
         LEFT JOIN "TenantMembership" tm ON tm."tenantId" = t.id AND tm.role = 'admin'
         LEFT JOIN "PlatformUser" u ON u.id = tm."userId"
         WHERE t.status = 'trial'
           AND t."trialEndsAt" IS NOT NULL
           AND t."trialEndsAt" BETWEEN NOW() AND NOW() + INTERVAL '3 days'
           AND t."trialEndsAt" > NOW()`
      );

      for (const trial of expiringTrials) {
        try {
          const userEmail = trial.user_email || trial.email;
          if (userEmail) {
            sendEmail(
              userEmail,
              `Your ${trial.name} trial expires soon`,
              trialExpiring({
                name: trial.user_fullName || trial.name,
                tenantName: trial.name,
                expiryDate: new Date(trial.trialEndsAt).toLocaleDateString(),
                planName: trial.planName || 'Free Trial',
              }),
            ).catch(() => {});
          }
          results.warned++;
        } catch (err: any) {
          results.errors.push(`Failed to warn ${trial.name}: ${err.message}`);
        }
      }
    } catch (err: any) {
      results.errors.push(`Step 2 error: ${err.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Cron completed: ${results.suspended} suspended, ${results.warned} warned`,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, ...results }, { status: 500 });
  }
}
