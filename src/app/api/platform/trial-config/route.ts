import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    let enabledSetting = await db.priceSetting.findUnique({ where: { key: 'trial_enabled' } });
    let durationSetting = await db.priceSetting.findUnique({ where: { key: 'trial_duration_days' } });
    
    return NextResponse.json({
      enabled: enabledSetting ? (enabledSetting as any).valueUSD === 1 : true,
      durationDays: durationSetting ? Math.round((durationSetting as any).valueUSD) : 7,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (data.enabled !== undefined) {
      await db.priceSetting.upsert({
        where: { key: 'trial_enabled' },
        update: { valueUSD: data.enabled ? 1 : 0, valueTTD: data.enabled ? 1 : 0 },
        create: { key: 'trial_enabled', valueUSD: data.enabled ? 1 : 0, valueTTD: data.enabled ? 1 : 0 }
      });
    }
    
    if (data.durationDays !== undefined) {
      await db.priceSetting.upsert({
        where: { key: 'trial_duration_days' },
        update: { valueUSD: data.durationDays, valueTTD: data.durationDays },
        create: { key: 'trial_duration_days', valueUSD: data.durationDays, valueTTD: data.durationDays }
      });
    }

    // Kill switch: end all trials immediately
    if (data.killAllTrials) {
      const trialTenants = await db.tenant.findMany({ where: { status: 'trial' } });
      for (const t of trialTenants) {
        await db.tenant.update({
          where: { id: t.id },
          data: { status: 'suspended', trialEndsAt: new Date() }
        });
      }
      await db.auditLog.create({ data: { action: 'kill_all_trials', details: `All ${trialTenants.length} trials terminated`, severity: 'critical' } });
      return NextResponse.json({ success: true, terminatedCount: trialTenants.length });
    }

    await db.auditLog.create({ data: { action: 'trial_config_updated', details: `Trial config updated`, severity: 'info' } });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
