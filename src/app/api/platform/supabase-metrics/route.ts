import { NextResponse } from 'next/server';

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_REF || 'lvgmgdggaiwqjbctnqqm';
const ORG_ID = process.env.SUPABASE_ORG_ID || 'isaxktqtxryhuazzehry';
const BASE = 'https://api.supabase.com';

async function queryDB(sql: string) {
  const res = await fetch(`${BASE}/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const data = await res.json();
  if (data.error || data.message) return null;
  return Array.isArray(data) ? data : null;
}

async function apiGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  try {
    const [projectInfo, orgInfo, backups] = await Promise.all([
      apiGet(`/v1/projects/${PROJECT_REF}`),
      apiGet(`/v1/organizations/${ORG_ID}`),
      apiGet(`/v1/projects/${PROJECT_REF}/database/backups`),
    ]);

    // DB metrics via SQL
    const [dbSize, connections, uptime, cacheHit, tableStats, rowCounts, lockStats, txStats] = await Promise.all([
      queryDB(`SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes`),
      queryDB(`SELECT count(*) as total, count(*) FILTER (WHERE state = 'active') as active, count(*) FILTER (WHERE state = 'idle') as idle, count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting, (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections FROM pg_stat_activity`),
      queryDB(`SELECT pg_postmaster_start_time() as started, now() - pg_postmaster_start_time() as uptime, version() as version`),
      queryDB(`SELECT round(sum(blks_hit)::numeric / nullif(sum(blks_hit) + sum(blks_read), 0) * 100, 2) as cache_hit_pct FROM pg_stat_database WHERE datname = current_database()`),
      queryDB(`SELECT t.tablename, pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) as size, pg_total_relation_size(quote_ident(t.tablename)::regclass) as bytes FROM pg_tables t WHERE t.schemaname = 'public' ORDER BY bytes DESC LIMIT 15`),
      queryDB(`SELECT 'PlatformUser' as tbl, count(*)::int as rows FROM "PlatformUser" UNION ALL SELECT 'Tenant', count(*)::int FROM "Tenant" UNION ALL SELECT 'Plan', count(*)::int FROM "Plan" UNION ALL SELECT 'Industry', count(*)::int FROM "Industry" UNION ALL SELECT '"Order"', count(*)::int FROM "Order" UNION ALL SELECT 'Invoice', count(*)::int FROM "Invoice" UNION ALL SELECT 'Client', count(*)::int FROM "Client" UNION ALL SELECT 'Payment', count(*)::int FROM "Payment" UNION ALL SELECT 'Expense', count(*)::int FROM "Expense" UNION ALL SELECT 'CatalogItem', count(*)::int FROM "CatalogItem" UNION ALL SELECT 'TenantMembership', count(*)::int FROM "TenantMembership" UNION ALL SELECT 'TenantSubscription', count(*)::int FROM "TenantSubscription" UNION ALL SELECT 'Appointment', count(*)::int FROM "Appointment" UNION ALL SELECT 'Quotation', count(*)::int FROM "Quotation"`),
      queryDB(`SELECT count(*)::int as blocked_queries FROM pg_locks WHERE granted = false`),
      queryDB(`SELECT sum(xact_commit)::int as commits, sum(xact_rollback)::int as rollbacks FROM pg_stat_database WHERE datname = current_database()`),
    ]);

    const dbSizeData = dbSize?.[0] || {};
    const connData = connections?.[0] || {};
    const uptimeData = uptime?.[0] || {};
    const cacheData = cacheHit?.[0] || {};
    const lockData = lockStats?.[0] || {};
    const txData = txStats?.[0] || {};

    // Free tier limits
    const FREE_LIMITS = {
      database: { size_gb: 0.5, max_connections: 60, bandwidth_gb: 5, pausable: true },
      auth: { max_users: 50000 },
      storage: { size_gb: 1 },
      edge_functions: { max_invocations: 500000 },
      realtime: { max_connections: 200 },
    };

    const dbBytes = dbSizeData.bytes || 0;
    const dbSizeGB = dbBytes / (1024 * 1024 * 1024);
    const dbUsedPct = Math.min((dbSizeGB / FREE_LIMITS.database.size_gb) * 100, 100);
    const connUsedPct = connData.total ? Math.min((connData.total / connData.max_connections) * 100, 100) : 0;

    return NextResponse.json({
      project: {
        name: projectInfo?.name || 'ZBS',
        ref: PROJECT_REF,
        status: projectInfo?.status || 'unknown',
        region: projectInfo?.region || 'unknown',
        createdAt: projectInfo?.created_at || null,
      },
      organization: {
        name: orgInfo?.name || 'reymorsupplies',
        plan: orgInfo?.plan || 'free',
      },
      database: {
        size: dbSizeData.size || '0 MB',
        sizeBytes: dbBytes,
        sizeGB: Math.round(dbSizeGB * 1000) / 1000,
        sizeUsedPct: Math.round(dbUsedPct * 10) / 10,
        version: uptimeData.version || 'Unknown',
        uptime: uptimeData.uptime || 'Unknown',
        startedAt: uptimeData.started || null,
        cacheHitPct: cacheData.cache_hit_pct || 0,
        blockedQueries: lockData.blocked_queries || 0,
        transactions: { commits: txData.commits || 0, rollbacks: txData.rollbacks || 0 },
      },
      connections: {
        total: connData.total || 0,
        active: connData.active || 0,
        idle: connData.idle || 0,
        waiting: connData.waiting || 0,
        max: connData.max_connections || 60,
        usedPct: Math.round(connUsedPct * 10) / 10,
      },
      tables: (tableStats || []).map((t: any) => ({ name: t.tablename, size: t.size, bytes: t.bytes })),
      rowCounts: (rowCounts || []),
      backups: {
        enabled: backups?.walg_enabled || false,
        pitr: backups?.pitr_enabled || false,
        count: backups?.backups?.length || 0,
      },
      limits: FREE_LIMITS,
      recommendations: generateRecommendations({
        dbSizeGB, dbUsedPct, connUsedPct, cacheHitPct: cacheData.cache_hit_pct || 0,
        blockedQueries: lockData.blocked_queries || 0,
        uptime: uptimeData.uptime || '',
        rowCounts: rowCounts || [],
      }),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateRecommendations(data: { dbSizeGB: number; dbUsedPct: number; connUsedPct: number; cacheHitPct: number; blockedQueries: number; uptime: string; rowCounts: any[] }) {
  const recs: { type: 'warning' | 'info' | 'success' | 'danger'; title: string; desc: string }[] = [];

  if (data.dbUsedPct > 80) recs.push({ type: 'danger', title: 'Database Size Critical', desc: `${data.dbSizeGB.toFixed(2)} GB used. Free tier limit is 0.5 GB. Consider upgrading to Pro ($25/mo) for 8 GB.` });
  else if (data.dbUsedPct > 50) recs.push({ type: 'warning', title: 'Database Size Growing', desc: `${data.dbUsedPct.toFixed(1)}% of free tier used. Pro plan gives you 8 GB.` });
  else recs.push({ type: 'success', title: 'Database Size Healthy', desc: `Using ${data.dbUsedPct.toFixed(1)}% of your 0.5 GB free tier limit.` });

  if (data.connUsedPct > 80) recs.push({ type: 'warning', title: 'Connection Pool Busy', desc: `${data.connUsedPct.toFixed(1)}% of connections used. Pro plan gives you 500 connections (pooler: 60→500).` });
  else recs.push({ type: 'success', title: 'Connections OK', desc: `${data.connUsedPct.toFixed(1)}% of available connections in use.` });

  if (data.blockedQueries > 0) recs.push({ type: 'warning', title: 'Blocked Queries Detected', desc: `${data.blockedQueries} queries waiting on locks. Check for long-running transactions.` });

  if (data.cacheHitPct < 95) recs.push({ type: 'info', title: 'Cache Hit Ratio', desc: `${data.cacheHitPct}% cache hit. Below 95% may indicate need for more memory (available on Pro).` });

  if (data.uptime && data.uptime.startsWith('00:')) recs.push({ type: 'info', title: 'Recently Restored', desc: 'Database was recently restored from pause. Monitor for stability.' });

  recs.push({ type: 'info', title: 'Free Tier Auto-Pause', desc: 'Your database will auto-pause after 7 days of inactivity. Pro plan ($25/mo) removes this limit.' });

  return recs;
}
