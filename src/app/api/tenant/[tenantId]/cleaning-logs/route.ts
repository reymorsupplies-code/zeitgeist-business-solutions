import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

// ── Cleaning & Sanitation Log API ──
// T&T Public Health (Food Establishment) Regulations - Sanitation

// ── Helper: Ensure table exists ──
async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "CleaningSanitationLog" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "area" TEXT NOT NULL,
      "task" TEXT NOT NULL,
      "frequency" TEXT DEFAULT 'daily',
      "status" TEXT DEFAULT 'completed',
      "completedBy" TEXT,
      "completedAt" TIMESTAMPTZ,
      "scheduledDate" TIMESTAMPTZ,
      "cleaningProducts" TEXT DEFAULT '[]',
      "supervisorSignOff" TEXT,
      "notes" TEXT,
      "isDeleted" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_clean_tenant" ON "CleaningSanitationLog"("tenantId");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_clean_area" ON "CleaningSanitationLog"("area");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_clean_freq" ON "CleaningSanitationLog"("frequency");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_clean_status" ON "CleaningSanitationLog"("status");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_clean_date" ON "CleaningSanitationLog"("scheduledDate");`);
}

// ── GET: List logs / schedule / compliance / daily-report ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || '';
    const area = searchParams.get('area') || '';
    const frequency = searchParams.get('frequency') || '';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const date = searchParams.get('date') || '';

    // ── /daily-report ──
    if (action === 'daily-report') {
      if (!date) {
        return NextResponse.json({ error: 'date parameter is required (YYYY-MM-DD)' }, { status: 400 });
      }

      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;

      // Get all unique area/frequency combos that exist
      const allTasks = await pgQuery(
        `SELECT DISTINCT area, task, frequency FROM "CleaningSanitationLog"
         WHERE "tenantId" = $1 AND "isDeleted" = false
         ORDER BY area, task`,
        [tenantId]
      );

      // Get completed and missed tasks for the day
      const dayLogs = await pgQuery(
        `SELECT * FROM "CleaningSanitationLog"
         WHERE "tenantId" = $1 AND "isDeleted" = false
         AND "scheduledDate" >= $2 AND "scheduledDate" <= $3`,
        [tenantId, dayStart, dayEnd]
      );

      const completed = dayLogs.filter((l: any) => l.status === 'completed');
      const missed = dayLogs.filter((l: any) => l.status === 'missed');
      const scheduled = dayLogs.filter((l: any) => l.status === 'scheduled');

      // Generate expected tasks based on frequency
      const dayOfWeek = new Date(date).getDay(); // 0=Sun, 6=Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayOfMonth = new Date(date).getDate();
      const isMonthStart = dayOfMonth <= 7;
      const isQuarterStart = [1, 4, 7, 10].includes(new Date(date).getMonth() + 1) && dayOfMonth <= 7;

      const scheduledTasks: Array<{ area: string; task: string; frequency: string }> = [];
      for (const t of allTasks) {
        let shouldSchedule = false;
        switch (t.frequency) {
          case 'daily': shouldSchedule = true; break;
          case 'weekly': shouldSchedule = !isWeekend; break;
          case 'monthly': shouldSchedule = isMonthStart; break;
          case 'quarterly': shouldSchedule = isQuarterStart; break;
          case 'as_needed': shouldSchedule = false; break;
        }
        if (shouldSchedule) {
          scheduledTasks.push({
            area: t.area,
            task: t.task,
            frequency: t.frequency,
          });
        }
      }

      return NextResponse.json({
        date,
        scheduledTasks,
        completedCount: completed.length,
        missedCount: missed.length,
        pendingCount: scheduled.length,
        completionRate: dayLogs.length > 0 ? Math.round((completed.length / dayLogs.length) * 100) : 0,
        tasks: dayLogs,
      });
    }

    // ── /compliance ──
    if (action === 'compliance') {
      const startDateFilter = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const logs = await pgQuery(
        `SELECT * FROM "CleaningSanitationLog"
         WHERE "tenantId" = $1 AND "isDeleted" = false
         AND "scheduledDate" >= $2
         ORDER BY area, "scheduledDate"`,
        [tenantId, `${startDateFilter}T00:00:00.000Z`]
      );

      // Group by area
      const areaStats: Record<string, { total: number; completed: number; missed: number; completionRate: number }> = {};
      for (const log of logs) {
        if (!areaStats[log.area]) {
          areaStats[log.area] = { total: 0, completed: 0, missed: 0, completionRate: 0 };
        }
        areaStats[log.area].total++;
        if (log.status === 'completed') areaStats[log.area].completed++;
        if (log.status === 'missed') areaStats[log.area].missed++;
      }

      // Calculate rates
      const missedTasks: any[] = [];
      for (const [area, stats] of Object.entries(areaStats)) {
        stats.completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

        // Highlight missed tasks
        if (stats.missed > 0) {
          missedTasks.push(...logs.filter((l: any) => l.area === area && l.status === 'missed'));
        }
      }

      const totalAll = logs.reduce((s: number, l: any) => s + 1, 0);
      const totalCompleted = logs.filter((l: any) => l.status === 'completed').length;
      const totalMissed = logs.filter((l: any) => l.status === 'missed').length;

      return NextResponse.json({
        period: { start: startDateFilter, end: new Date().toISOString().split('T')[0] },
        overall: {
          total: totalAll,
          completed: totalCompleted,
          missed: totalMissed,
          completionRate: totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0,
        },
        byArea: areaStats,
        missedTasks,
      });
    }

    // ── /schedule ──
    if (action === 'schedule') {
      const tasks = await pgQuery(
        `SELECT DISTINCT area, task, frequency FROM "CleaningSanitationLog"
         WHERE "tenantId" = $1 AND "isDeleted" = false
         ORDER BY frequency, area, task`,
        [tenantId]
      );

      // Build a weekly schedule
      const schedule: Record<string, any[]> = {
        daily: [],
        weekly: [],
        monthly: [],
        quarterly: [],
        as_needed: [],
      };

      for (const t of tasks) {
        if (schedule[t.frequency]) {
          schedule[t.frequency].push({ area: t.area, task: t.task });
        }
      }

      return NextResponse.json({
        schedule,
        totalUniqueTasks: tasks.length,
        dailyCount: schedule.daily.length,
        weeklyCount: schedule.weekly.length,
      });
    }

    // ── List logs (default) ──
    const conditions: string[] = [`"tenantId" = $1`, `"isDeleted" = false`];
    const params: any[] = [tenantId];
    let pIdx = 2;

    if (area) {
      conditions.push(`"area" = $${pIdx++}`);
      params.push(area);
    }
    if (frequency) {
      conditions.push(`"frequency" = $${pIdx++}`);
      params.push(frequency);
    }
    if (status) {
      conditions.push(`"status" = $${pIdx++}`);
      params.push(status);
    }
    if (startDate) {
      conditions.push(`"scheduledDate" >= $${pIdx++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`"scheduledDate" <= $${pIdx++}`);
      params.push(endDate);
    }

    const logs = await pgQuery(
      `SELECT * FROM "CleaningSanitationLog" WHERE ${conditions.join(' AND ')} ORDER BY "scheduledDate" DESC NULLS LAST, "createdAt" DESC LIMIT 500`,
      params
    );
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Log cleaning task completion ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const data = await req.json();

    if (!data.area || !data.task) {
      return NextResponse.json({ error: 'area and task are required' }, { status: 400 });
    }

    const cleaningProducts = typeof data.cleaningProducts === 'string'
      ? data.cleaningProducts
      : JSON.stringify(data.cleaningProducts || []);

    const result = await pgQuery(
      `INSERT INTO "CleaningSanitationLog" ("tenantId", "area", "task", "frequency", "status", "completedBy", "completedAt", "scheduledDate", "cleaningProducts", "supervisorSignOff", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [tenantId, data.area, data.task, data.frequency || 'daily',
       data.status || 'completed', data.completedBy || null,
       data.completedAt ? new Date(data.completedAt).toISOString() : new Date().toISOString(),
       data.scheduledDate ? new Date(data.scheduledDate).toISOString() : new Date().toISOString(),
       cleaningProducts, data.supervisorSignOff || null, data.notes || null]
    );
    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH: Update cleaning log ──
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const setParts: string[] = [`"updatedAt" = NOW()`];
    const params: any[] = [];
    let pIdx = 1;

    const allowedFields = ['area', 'task', 'frequency', 'status', 'completedBy', 'supervisorSignOff', 'notes'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        setParts.push(`"${field}" = $${pIdx++}`);
        params.push(data[field]);
      }
    }
    if (data.completedAt !== undefined) {
      setParts.push(`"completedAt" = $${pIdx++}`);
      params.push(new Date(data.completedAt).toISOString());
    }
    if (data.scheduledDate !== undefined) {
      setParts.push(`"scheduledDate" = $${pIdx++}`);
      params.push(new Date(data.scheduledDate).toISOString());
    }
    if (data.cleaningProducts !== undefined) {
      setParts.push(`"cleaningProducts" = $${pIdx++}`);
      params.push(typeof data.cleaningProducts === 'string' ? data.cleaningProducts : JSON.stringify(data.cleaningProducts));
    }

    params.push(data.id, tenantId);

    const result = await pgQuery(
      `UPDATE "CleaningSanitationLog" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx} RETURNING *`,
      params
    );
    if (!result.length) return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Soft-delete ──
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await pgQuery(
      `UPDATE "CleaningSanitationLog" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [data.id, tenantId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
