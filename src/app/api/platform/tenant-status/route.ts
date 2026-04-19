import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// In-memory cache for online status (tenantId -> lastHeartbeat timestamp)
const heartbeatCache: Record<string, number> = {};
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantIds = searchParams.get('tenantIds');

    let ids: string[] = [];
    if (tenantIds) {
      ids = tenantIds.split(',').filter(Boolean);
    }

    if (ids.length === 0) {
      return NextResponse.json({});
    }

    // Fetch tenants with lastActivityAt from DB
    const tenants = await db.tenant.findMany({
      where: { id: { in: ids } },
      select: { id: true, lastActivityAt: true },
    });

    const now = Date.now();
    const statusMap: Record<string, { online: boolean; lastActivity: string | null; relativeTime: string }> = {};

    for (const t of tenants) {
      const cached = heartbeatCache[t.id];
      const lastTs = cached || (t.lastActivityAt ? new Date(t.lastActivityAt).getTime() : 0);
      const isOnline = (now - lastTs) < ONLINE_THRESHOLD_MS;

      let relativeTime = 'Never';
      if (lastTs > 0) {
        const diffMs = now - lastTs;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHrs / 24);

        if (diffMin < 1) relativeTime = 'Online now';
        else if (diffMin < 60) relativeTime = `${diffMin}m ago`;
        else if (diffHrs < 24) relativeTime = `${diffHrs}h ago`;
        else if (diffDays < 7) relativeTime = `${diffDays}d ago`;
        else relativeTime = `${Math.floor(diffDays / 7)}w ago`;
      }

      statusMap[t.id] = {
        online: isOnline,
        lastActivity: t.lastActivityAt?.toISOString() || null,
        relativeTime,
      };
    }

    return NextResponse.json(statusMap);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
