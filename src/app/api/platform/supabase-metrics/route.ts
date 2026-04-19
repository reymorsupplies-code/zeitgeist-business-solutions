import { NextResponse } from 'next/server';

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_REF || 'lvgmgdggaiwqjbctnqqm';
const ORG_ID = process.env.SUPABASE_ORG_ID || 'isaxktqtxryhuazzehry';
const BASE = 'https://api.supabase.com';

// In-memory snapshot ring buffer for growth projection (max 72 entries = 36h at 30s intervals)
const SNAPSHOT_BUFFER_SIZE = 72;
const snapshotBuffer: { ts: string; bytes: number; tables: number }[] = [];

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

    // DB metrics via SQL — original + new advanced queries
    const [
      dbSize, connections, uptime, cacheHit, tableStats, rowCounts,
      lockStats, txStats, storageBreakdown, bloatStats, indexStats,
      deadTupleStats, walStats
    ]: any[] = await Promise.all([
      // 1. Total database size
      queryDB(`SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes`),
      // 2. Connection pool status
      queryDB(`SELECT count(*) as total, count(*) FILTER (WHERE state = 'active') as active, count(*) FILTER (WHERE state = 'idle') as idle, count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting, (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections FROM pg_stat_activity`),
      // 3. Uptime and version
      queryDB(`SELECT pg_postmaster_start_time() as started, now() - pg_postmaster_start_time() as uptime, version() as version`),
      // 4. Cache hit ratio
      queryDB(`SELECT round(sum(blks_hit)::numeric / nullif(sum(blks_hit) + sum(blks_read), 0) * 100, 2) as cache_hit_pct FROM pg_stat_database WHERE datname = current_database()`),
      // 5. Table stats (top 20 by size) with index and toast breakdown
      queryDB(`SELECT
        t.tablename,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) as total_size,
        pg_total_relation_size(quote_ident(t.tablename)::regclass) as total_bytes,
        pg_size_pretty(pg_relation_size(quote_ident(t.tablename)::regclass)) as table_size,
        pg_relation_size(quote_ident(t.tablename)::regclass) as table_bytes,
        pg_size_pretty(pg_indexes_size(quote_ident(t.tablename)::regclass)) as index_size,
        pg_indexes_size(quote_ident(t.tablename)::regclass) as index_bytes,
        COALESCE(pg_total_relation_size(quote_ident(t.tablename)::regclass) -
          pg_relation_size(quote_ident(t.tablename)::regclass) -
          pg_indexes_size(quote_ident(t.tablename)::regclass), 0) as toast_bytes,
        pg_size_pretty(COALESCE(pg_total_relation_size(quote_ident(t.tablename)::regclass) -
          pg_relation_size(quote_ident(t.tablename)::regclass) -
          pg_indexes_size(quote_ident(t.tablename)::regclass), 0)) as toast_size
      FROM pg_tables t WHERE t.schemaname = 'public' ORDER BY total_bytes DESC LIMIT 20`),
      // 6. Row counts for major tables
      queryDB(`SELECT 'PlatformUser' as tbl, count(*)::int as rows FROM "PlatformUser" UNION ALL SELECT 'Tenant', count(*)::int FROM "Tenant" UNION ALL SELECT 'Plan', count(*)::int FROM "Plan" UNION ALL SELECT 'Industry', count(*)::int FROM "Industry" UNION ALL SELECT '"Order"', count(*)::int FROM "Order" UNION ALL SELECT 'Invoice', count(*)::int FROM "Invoice" UNION ALL SELECT 'Client', count(*)::int FROM "Client" UNION ALL SELECT 'Payment', count(*)::int FROM "Payment" UNION ALL SELECT 'Expense', count(*)::int FROM "Expense" UNION ALL SELECT 'CatalogItem', count(*)::int FROM "CatalogItem" UNION ALL SELECT 'TenantMembership', count(*)::int FROM "TenantMembership" UNION ALL SELECT 'TenantSubscription', count(*)::int FROM "TenantSubscription" UNION ALL SELECT 'Appointment', count(*)::int FROM "Appointment" UNION ALL SELECT 'Quotation', count(*)::int FROM "Quotation"`),
      // 7. Blocked queries
      queryDB(`SELECT count(*)::int as blocked_queries FROM pg_locks WHERE granted = false`),
      // 8. Transaction stats
      queryDB(`SELECT sum(xact_commit)::int as commits, sum(xact_rollback)::int as rollbacks FROM pg_stat_database WHERE datname = current_database()`),
      // 9. Storage breakdown: total tables vs total indexes vs total TOAST
      queryDB(`SELECT
        (SELECT sum(pg_relation_size(quote_ident(t.tablename)::regclass)) FROM pg_tables t WHERE t.schemaname = 'public') as tables_bytes,
        (SELECT sum(pg_indexes_size(quote_ident(t.tablename)::regclass)) FROM pg_tables t WHERE t.schemaname = 'public') as indexes_bytes,
        (SELECT sum(COALESCE(pg_total_relation_size(quote_ident(t.tablename)::regclass) - pg_relation_size(quote_ident(t.tablename)::regclass) - pg_indexes_size(quote_ident(t.tablename)::regclass), 0)) FROM pg_tables t WHERE t.schemaname = 'public') as toast_bytes,
        (SELECT pg_database_size(current_database())) as total_bytes`),
      // 10. Bloat stats: top 5 tables by dead tuples
      queryDB(`SELECT
        relname as table_name,
        n_dead_tup as dead_tuples,
        n_live_tup as live_tuples,
        ROUND(CASE WHEN n_live_tup > 0 THEN (n_dead_tup::numeric / (n_dead_tup + n_live_tup)) * 100 ELSE 0 END, 2) as bloat_pct,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 0
      ORDER BY n_dead_tup DESC LIMIT 10`),
      // 11. Unused/wasted indexes (index size but few scans)
      queryDB(`SELECT
        schemaname || '.' || relname as table_name,
        indexrelname as index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        idx_scan as index_scans,
        CASE WHEN idx_scan = 0 THEN 'UNUSED' WHEN idx_scan < 5 THEN 'RARELY_USED' ELSE 'OK' END as status
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC LIMIT 10`),
      // 12. WAL (Write-Ahead Log) stats for write activity
      queryDB(`SELECT
        pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')) as wal_position,
        (SELECT count(*) FROM pg_stat_wal) as wal_senders,
        (SELECT pg_size_pretty(sum(size)) FROM pg_ls_waldir()) as wal_disk_size`),
    ]);

    const dbSizeData = dbSize?.[0] || {};
    const connData = connections?.[0] || {};
    const uptimeData = uptime?.[0] || {};
    const cacheData = cacheHit?.[0] || {};
    const lockData = lockStats?.[0] || {};
    const txData = txStats?.[0] || {};
    const storageData = storageBreakdown?.[0] || {};
    const walData: any = walStats?.[0] || {};

    // Plan limits — supports Free, Pro, Team
    const PLAN_LIMITS: Record<string, { database: { size_gb: number; max_connections: number; bandwidth_gb: number }; auth: { max_users: number }; storage: { size_gb: number } }> = {
      free:  { database: { size_gb: 0.5, max_connections: 60, bandwidth_gb: 5 }, auth: { max_users: 50000 }, storage: { size_gb: 1 } },
      pro:   { database: { size_gb: 8,   max_connections: 500, bandwidth_gb: 250 }, auth: { max_users: 100000 }, storage: { size_gb: 100 } },
      team:  { database: { size_gb: 8,   max_connections: 500, bandwidth_gb: 250 }, auth: { max_users: 100000 }, storage: { size_gb: 100 } },
    };

    const currentPlan = orgInfo?.plan || 'free';
    const limits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
    const dbLimitGB = limits.database.size_gb;

    const dbBytes = dbSizeData.bytes || 0;
    const dbSizeGB = dbBytes / (1024 * 1024 * 1024);
    const dbUsedPct = Math.min((dbSizeGB / dbLimitGB) * 100, 100);
    const dbRemainingBytes = Math.max((dbLimitGB * 1024 * 1024 * 1024) - dbBytes, 0);
    const dbRemainingMB = dbRemainingBytes / (1024 * 1024);
    const connUsedPct = connData.total ? Math.min((connData.total / connData.max_connections) * 100, 100) : 0;

    // Storage breakdown percentages
    const tablesBytes = storageData.tables_bytes || 0;
    const indexesBytes = storageData.indexes_bytes || 0;
    const toastBytes = storageData.toast_bytes || 0;
    const storageTotal = tablesBytes + indexesBytes + toastBytes;
    const storageBreakdownPct = {
      tables: storageTotal > 0 ? Math.round((tablesBytes / storageTotal) * 1000) / 10 : 0,
      indexes: storageTotal > 0 ? Math.round((indexesBytes / storageTotal) * 1000) / 10 : 0,
      toast: storageTotal > 0 ? Math.round((toastBytes / storageTotal) * 1000) / 10 : 0,
    };

    // ── Growth Projection ──
    // Store snapshot
    const now = new Date().toISOString();
    const tableCount = (tableStats || []).length;
    snapshotBuffer.push({ ts: now, bytes: dbBytes, tables: tableCount });
    if (snapshotBuffer.length > SNAPSHOT_BUFFER_SIZE) snapshotBuffer.shift();

    // Calculate growth rate from snapshots (bytes per hour)
    let growthBytesPerHour: number | null = null;
    let growthProjectionDays: number | null = null;
    let growthRateLabel = 'Calculating...';

    if (snapshotBuffer.length >= 4) {
      const oldest = snapshotBuffer[0];
      const newest = snapshotBuffer[snapshotBuffer.length - 1];
      const hoursDiff = (new Date(newest.ts).getTime() - new Date(oldest.ts).getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 0.05) { // At least ~3 minutes of data
        const bytesGrown = newest.bytes - oldest.bytes;
        growthBytesPerHour = bytesGrown / hoursDiff;

        if (growthBytesPerHour > 0 && dbRemainingBytes > 0) {
          const hoursRemaining = dbRemainingBytes / growthBytesPerHour;
          growthProjectionDays = Math.round(hoursRemaining / 24 * 10) / 10;

          if (growthProjectionDays < 1) growthRateLabel = `~${Math.round(hoursRemaining)}h remaining at current rate`;
          else if (growthProjectionDays < 30) growthRateLabel = `~${Math.round(growthProjectionDays)}d remaining at current rate`;
          else if (growthProjectionDays < 365) growthRateLabel = `~${Math.round(growthProjectionDays)}d remaining`;
          else growthRateLabel = `~${Math.round(growthProjectionDays / 30)} months remaining`;
        } else if (growthBytesPerHour <= 0) {
          growthRateLabel = 'Stable — no significant growth detected';
          growthBytesPerHour = 0;
        }
      }
    }

    // Snapshot history for mini chart (last 20 points)
    const chartData = snapshotBuffer.slice(-20).map(s => ({
      ts: s.ts,
      bytes: s.bytes,
      mb: Math.round(s.bytes / (1024 * 1024) * 100) / 100,
    }));

    // Format bytes helper
    const fmtBytes = (b: number) => {
      if (b < 1024) return `${b} B`;
      if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
      if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
      return `${(b / (1024 * 1024 * 1024)).toFixed(3)} GB`;
    };

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
        plan: currentPlan,
      },
      database: {
        size: dbSizeData.size || '0 MB',
        sizeBytes: dbBytes,
        sizeGB: Math.round(dbSizeGB * 1000) / 1000,
        sizeUsedPct: Math.round(dbUsedPct * 10) / 10,
        remainingMB: Math.round(dbRemainingMB * 100) / 100,
        remainingBytes: dbRemainingBytes,
        limitGB: dbLimitGB,
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
      tables: (tableStats || []).map((t: any) => ({
        name: t.tablename,
        totalSize: t.total_size,
        totalBytes: t.total_bytes,
        tableSize: t.table_size,
        tableBytes: t.table_bytes,
        indexSize: t.index_size,
        indexBytes: t.index_bytes,
        toastSize: t.toast_size,
        toastBytes: t.toast_bytes,
      })),
      rowCounts: (rowCounts || []),
      backups: {
        enabled: backups?.walg_enabled || false,
        pitr: backups?.pitr_enabled || false,
        count: backups?.backups?.length || 0,
      },
      limits,
      // ── NEW: Storage breakdown ──
      storage: {
        tablesBytes,
        indexesBytes,
        toastBytes,
        totalBytes: storageData.total_bytes || dbBytes,
        pct: storageBreakdownPct,
        tablesLabel: fmtBytes(tablesBytes),
        indexesLabel: fmtBytes(indexesBytes),
        toastLabel: fmtBytes(toastBytes),
      },
      // ── NEW: Bloat analysis ──
      bloat: (bloatStats || []).map((b: any) => ({
        table: b.table_name,
        deadTuples: b.dead_tuples,
        liveTuples: b.live_tuples,
        bloatPct: b.bloat_pct,
        lastVacuum: b.last_vacuum,
        lastAutovacuum: b.last_autovacuum,
        needsVacuum: b.bloat_pct > 10,
      })),
      // ── NEW: Index health ──
      indexHealth: (indexStats || []).map((idx: any) => ({
        table: idx.table_name,
        index: idx.index_name,
        size: idx.index_size,
        scans: idx.index_scans,
        status: idx.status,
      })),
      // ── NEW: WAL activity ──
      wal: {
        position: walData.wal_position || 'Unknown',
        senders: walData.wal_senders || 0,
        diskSize: walData.wal_disk_size || 'Unknown',
      },
      // ── NEW: Growth projection ──
      growth: {
        bytesPerHour: growthBytesPerHour,
        projectionDays: growthProjectionDays,
        rateLabel: growthRateLabel,
        snapshotCount: snapshotBuffer.length,
        chartData,
      },
      recommendations: generateRecommendations({
        dbSizeGB, dbUsedPct, connUsedPct, cacheHitPct: cacheData.cache_hit_pct || 0,
        blockedQueries: lockData.blocked_queries || 0,
        uptime: uptimeData.uptime || '',
        rowCounts: rowCounts || [],
        currentPlan, dbLimitGB, dbRemainingMB, growthProjectionDays,
        growthBytesPerHour, bloatStats: bloatStats || [],
        indexStats: indexStats || [],
      }),
      fetchedAt: now,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateRecommendations(data: {
  dbSizeGB: number; dbUsedPct: number; connUsedPct: number;
  cacheHitPct: number; blockedQueries: number; uptime: string;
  rowCounts: any[]; currentPlan: string; dbLimitGB: number;
  dbRemainingMB: number; growthProjectionDays: number | null;
  growthBytesPerHour: number | null; bloatStats: any[]; indexStats: any[];
}) {
  const recs: { type: 'warning' | 'info' | 'success' | 'danger'; title: string; desc: string }[] = [];
  const planName = data.currentPlan === 'pro' ? 'Pro' : data.currentPlan === 'team' ? 'Team' : 'Free';

  // ── Space urgency ──
  if (data.dbUsedPct > 90) {
    recs.push({ type: 'danger', title: 'Database Almost Full', desc: `${data.dbSizeGB.toFixed(2)} GB / ${data.dbLimitGB} GB (${data.dbUsedPct.toFixed(1)}%). Only ${data.dbRemainingMB.toFixed(1)} MB remaining. Upgrade immediately to avoid data loss.` });
  } else if (data.dbUsedPct > 75) {
    recs.push({ type: 'danger', title: 'Database Space Critical', desc: `${data.dbUsedPct.toFixed(1)}% of ${data.dbLimitGB} GB used (${data.dbRemainingMB.toFixed(1)} MB left). Consider upgrading now to avoid disruption.` });
  } else if (data.dbUsedPct > 50) {
    recs.push({ type: 'warning', title: 'Database Over Half Full', desc: `${data.dbUsedPct.toFixed(1)}% of ${data.dbLimitGB} GB used. ${data.dbRemainingMB.toFixed(1)} MB remaining. Plan your upgrade strategy.` });
  } else {
    recs.push({ type: 'success', title: 'Database Space Healthy', desc: `Using ${data.dbUsedPct.toFixed(1)}% of ${data.dbLimitGB} GB. ${data.dbRemainingMB.toFixed(1)} MB remaining. No action needed.` });
  }

  // ── Growth projection ──
  if (data.growthProjectionDays !== null && data.growthProjectionDays < 30 && data.growthBytesPerHour && data.growthBytesPerHour > 0) {
    recs.push({ type: 'danger', title: 'Capacity Running Out Soon', desc: `At current growth rate (${(data.growthBytesPerHour * 24 / (1024*1024)).toFixed(1)} MB/day), you have approximately ${Math.round(data.growthProjectionDays)} days before hitting your ${data.dbLimitGB} GB limit.` });
  } else if (data.growthProjectionDays !== null && data.growthProjectionDays !== null && data.growthProjectionDays < 90 && data.growthBytesPerHour && data.growthBytesPerHour > 0) {
    recs.push({ type: 'warning', title: 'Monitor Growth Rate', desc: `Growing at ${(data.growthBytesPerHour * 24 / (1024*1024)).toFixed(1)} MB/day. Estimated ${Math.round(data.growthProjectionDays)} days until capacity limit. Consider upgrading within the next month.` });
  }

  // ── Connections ──
  if (data.connUsedPct > 80) {
    recs.push({ type: 'warning', title: 'Connection Pool Busy', desc: `${data.connUsedPct.toFixed(1)}% of connections used. Pro plan gives you 500 connections (pooler: 60 to 500).` });
  } else {
    recs.push({ type: 'success', title: 'Connections OK', desc: `${data.connUsedPct.toFixed(1)}% of available connections in use.` });
  }

  // ── Blocked queries ──
  if (data.blockedQueries > 0) {
    recs.push({ type: 'warning', title: 'Blocked Queries Detected', desc: `${data.blockedQueries} queries waiting on locks. Check for long-running transactions.` });
  }

  // ── Bloat warnings ──
  const highBloat = (data.bloatStats || []).filter((b: any) => b.bloat_pct > 15);
  if (highBloat.length > 0) {
    recs.push({ type: 'warning', title: 'Table Bloat Detected', desc: `${highBloat.length} table(s) have significant bloat (>15% dead tuples). A VACUUM or VACUUM FULL can reclaim space. Most affected: ${highBloat[0].table_name} (${highBloat[0].bloat_pct}%).` });
  }

  // ── Unused indexes ──
  const unusedIndexes = (data.indexStats || []).filter((idx: any) => idx.status === 'UNUSED');
  if (unusedIndexes.length > 0) {
    const wastedSize = unusedIndexes.map((idx: any) => idx.index_size).join(', ');
    recs.push({ type: 'info', title: 'Unused Indexes Found', desc: `${unusedIndexes.length} index(es) with zero scans. Sizes: ${wastedSize}. Consider dropping them to reclaim space.` });
  }

  // ── Cache hit ──
  if (data.cacheHitPct < 95) {
    recs.push({ type: 'info', title: 'Cache Hit Ratio Below Target', desc: `${data.cacheHitPct}% cache hit (target: 95%+). May indicate need for more memory (available on Pro plan).` });
  }

  // ── Uptime ──
  if (data.uptime && data.uptime.startsWith('00:')) {
    recs.push({ type: 'info', title: 'Recently Restored', desc: 'Database was recently restored from pause. Monitor for stability.' });
  }

  // ── Auto-pause (Free tier only) ──
  if (data.currentPlan === 'free') {
    recs.push({ type: 'info', title: 'Free Tier Auto-Pause', desc: 'Database auto-pauses after 7 days of inactivity. Upgrade to Pro ($25/mo) for always-on availability.' });
  }

  return recs;
}
