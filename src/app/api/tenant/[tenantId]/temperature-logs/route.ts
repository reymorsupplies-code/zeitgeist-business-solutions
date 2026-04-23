import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

// ── Temperature Monitoring Log API ──
// T&T Public Health (Food Safety) Regulations - Temperature Control

// ── Safe temperature ranges by equipment type (T&T regulations) ──
const EQUIPMENT_RANGES: Record<string, { min: number; max: number; unit: string; description: string }> = {
  fridge:          { min: 0,   max: 4,    unit: '°C', description: 'Cold storage - refrigeration units' },
  freezer:         { min: -25, max: -18,  unit: '°C', description: 'Frozen storage - freezer units' },
  oven:            { min: 63, max: 260,  unit: '°C', description: 'Cooking equipment (depends on product - minimum 63°C for hot holding)' },
  display_case:    { min: 0,   max: 4,    unit: '°C', description: 'Display case - chilled display units (max 4°C per T&T food safety)' },
  hot_hold:        { min: 63, max: 90,   unit: '°C', description: 'Hot holding equipment - minimum 63°C per food safety regulations' },
  proofer:         { min: 24, max: 38,   unit: '°C', description: 'Dough proofer / fermentation cabinet' },
  blast_chiller:   { min: -5, max: 3,    unit: '°C', description: 'Blast chiller - rapid cooling unit' },
};

// ── Helper: Ensure table exists ──
async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "TemperatureLog" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "equipmentId" TEXT,
      "equipmentName" TEXT NOT NULL,
      "equipmentType" TEXT NOT NULL,
      "temperature" DOUBLE PRECISION NOT NULL,
      "minSafe" DOUBLE PRECISION DEFAULT 0,
      "maxSafe" DOUBLE PRECISION DEFAULT 4,
      "isWithinRange" BOOLEAN DEFAULT true,
      "loggedBy" TEXT,
      "notes" TEXT,
      "isDeleted" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_temp_tenant" ON "TemperatureLog"("tenantId");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_temp_type" ON "TemperatureLog"("equipmentType");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_temp_range" ON "TemperatureLog"("isWithinRange");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_temp_created" ON "TemperatureLog"("createdAt");`);
}

// ── GET: List logs / alerts / daily-summary / equipment-setup ──
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
    const equipmentType = searchParams.get('equipmentType') || '';
    const isWithinRange = searchParams.get('isWithinRange');
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const date = searchParams.get('date') || '';

    // ── /equipment-setup ──
    if (action === 'equipment-setup') {
      return NextResponse.json({
        equipmentTypes: Object.entries(EQUIPMENT_RANGES).map(([key, val]) => ({
          type: key,
          ...val,
        })),
      });
    }

    // ── /daily-summary ──
    if (action === 'daily-summary') {
      if (!date) {
        return NextResponse.json({ error: 'date parameter is required (YYYY-MM-DD)' }, { status: 400 });
      }

      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;

      const logs = await pgQuery(
        `SELECT * FROM "TemperatureLog"
         WHERE "tenantId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3 AND COALESCE("isDeleted", false) = false
         ORDER BY "equipmentType", "createdAt"`,
        [tenantId, dayStart, dayEnd]
      );

      // Group by equipment
      const byEquipment: Record<string, any> = {};
      for (const log of logs) {
        const key = `${log.equipmentType}:${log.equipmentName}`;
        if (!byEquipment[key]) {
          byEquipment[key] = {
            equipmentType: log.equipmentType,
            equipmentName: log.equipmentName,
            equipmentId: log.equipmentId,
            readings: [],
            min: Infinity,
            max: -Infinity,
            avg: 0,
            totalReadings: 0,
            outOfRangeCount: 0,
          };
        }
        const group = byEquipment[key];
        group.readings.push({ temperature: log.temperature, time: log.createdAt, isWithinRange: log.isWithinRange });
        group.min = Math.min(group.min, log.temperature);
        group.max = Math.max(group.max, log.temperature);
        group.totalReadings++;
        group.avg += log.temperature;
        if (!log.isWithinRange) group.outOfRangeCount++;
      }

      for (const key of Object.keys(byEquipment)) {
        byEquipment[key].avg = Math.round((byEquipment[key].avg / byEquipment[key].totalReadings) * 10) / 10;
      }

      return NextResponse.json({
        date,
        totalReadings: logs.length,
        totalOutOfRange: logs.filter((l: any) => !l.isWithinRange).length,
        byEquipment: Object.values(byEquipment),
      });
    }

    // ── /alerts ──
    if (action === 'alerts') {
      const conditions: string[] = [`"tenantId" = $1`, `"isWithinRange" = false`, `COALESCE("isDeleted", false) = false`];
      const params: any[] = [tenantId];

      if (equipmentType) {
        conditions.push(`"equipmentType" = $2`);
        params.push(equipmentType);
      }
      if (startDate) {
        conditions.push(`"createdAt" >= $${params.length + 1}`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`"createdAt" <= $${params.length + 1}`);
        params.push(endDate);
      }

      const alerts = await pgQuery(
        `SELECT * FROM "TemperatureLog" WHERE ${conditions.join(' AND ')} ORDER BY "createdAt" DESC LIMIT 200`,
        params
      );

      // Group by equipment
      const byEquipment: Record<string, any> = {};
      for (const alert of alerts) {
        const key = alert.equipmentType;
        if (!byEquipment[key]) {
          byEquipment[key] = { equipmentType: key, alerts: [], count: 0 };
        }
        byEquipment[key].alerts.push(alert);
        byEquipment[key].count++;
      }

      return NextResponse.json({
        alerts,
        totalAlerts: alerts.length,
        groupedByEquipment: byEquipment,
      });
    }

    // ── List logs (default) ──
    const conditions: string[] = [`"tenantId" = $1`, `COALESCE("isDeleted", false) = false`];
    const params: any[] = [tenantId];
    let pIdx = 2;

    if (equipmentType) {
      conditions.push(`"equipmentType" = $${pIdx++}`);
      params.push(equipmentType);
    }
    if (isWithinRange === 'true') {
      conditions.push(`"isWithinRange" = true`);
    } else if (isWithinRange === 'false') {
      conditions.push(`"isWithinRange" = false`);
    }
    if (startDate) {
      conditions.push(`"createdAt" >= $${pIdx++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`"createdAt" <= $${pIdx++}`);
      params.push(endDate);
    }

    const logs = await pgQuery(
      `SELECT * FROM "TemperatureLog" WHERE ${conditions.join(' AND ')} ORDER BY "createdAt" DESC LIMIT 500`,
      params
    );
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Log temperature reading ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const data = await req.json();

    if (data.equipmentName === undefined || data.temperature === undefined || !data.equipmentType) {
      return NextResponse.json({ error: 'equipmentName, equipmentType, and temperature are required' }, { status: 400 });
    }

    // Auto-determine safe range from equipment type if not provided
    let minSafe = data.minSafe;
    let maxSafe = data.maxSafe;

    if (minSafe === undefined || maxSafe === undefined) {
      const range = EQUIPMENT_RANGES[data.equipmentType];
      if (range) {
        minSafe = minSafe !== undefined ? minSafe : range.min;
        maxSafe = maxSafe !== undefined ? maxSafe : range.max;
      } else {
        minSafe = minSafe ?? 0;
        maxSafe = maxSafe ?? 4;
      }
    }

    // Auto-evaluate isWithinRange
    const isWithinRange = data.temperature >= minSafe && data.temperature <= maxSafe;

    const result = await pgQuery(
      `INSERT INTO "TemperatureLog" ("tenantId", "equipmentId", "equipmentName", "equipmentType", "temperature", "minSafe", "maxSafe", "isWithinRange", "loggedBy", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [tenantId, data.equipmentId || null, data.equipmentName,
       data.equipmentType, data.temperature, minSafe, maxSafe,
       isWithinRange, data.loggedBy || null, data.notes || null]
    );

    return NextResponse.json({
      ...result[0],
      alert: !isWithinRange ? {
        message: `Temperature ${data.temperature}°C is outside safe range (${minSafe}°C - ${maxSafe}°C) for ${data.equipmentType}: ${data.equipmentName}`,
        equipmentName: data.equipmentName,
        equipmentType: data.equipmentType,
        recordedTemp: data.temperature,
        safeRange: { min: minSafe, max: maxSafe },
      } : null,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH: Update a temperature log ──
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

    const allowedFields = ['equipmentName', 'equipmentType', 'temperature', 'minSafe', 'maxSafe', 'loggedBy', 'notes'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        setParts.push(`"${field}" = $${pIdx++}`);
        params.push(data[field]);
      }
    }

    // If temperature or range changed, re-evaluate
    if (data.temperature !== undefined || data.minSafe !== undefined || data.maxSafe !== undefined) {
      // Fetch existing to merge
      const existing = await pgQuery(
        `SELECT temperature, "minSafe", "maxSafe" FROM "TemperatureLog" WHERE id = $1 AND "tenantId" = $2`,
        [data.id, tenantId]
      );
      if (existing.length) {
        const temp = data.temperature !== undefined ? data.temperature : existing[0].temperature;
        const min = data.minSafe !== undefined ? data.minSafe : existing[0].minSafe;
        const max = data.maxSafe !== undefined ? data.maxSafe : existing[0].maxSafe;
        setParts.push(`"isWithinRange" = $${pIdx++}`);
        params.push(temp >= min && temp <= max);
      }
    }

    params.push(data.id, tenantId);

    const result = await pgQuery(
      `UPDATE "TemperatureLog" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx} RETURNING *`,
      params
    );
    if (!result.length) return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE ──
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Soft delete to preserve audit trail for food safety inspections
    const result = await pgQuery(
      `UPDATE "TemperatureLog" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2 RETURNING id`,
      [data.id, tenantId]
    );
    if (!result.length) return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
