import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: List production plans with optional filters ───
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const url = new URL(_req.url);
    const status = url.searchParams.get('status') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    // Build parameterized WHERE clause
    const where: string[] = [`"tenantId" = $1`, `"isDeleted" = false`];
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (status) {
      where.push(`"status" = $${paramIdx++}`);
      queryParams.push(status);
    }
    if (dateFrom) {
      where.push(`"date" >= $${paramIdx++}`);
      queryParams.push(dateFrom);
    }
    if (dateTo) {
      where.push(`"date" <= $${paramIdx++}`);
      queryParams.push(dateTo);
    }

    const plans = await pgQuery(
      `SELECT * FROM "ProductionPlan" WHERE ${where.join(' AND ')} ORDER BY "date" DESC NULLS LAST, "createdAt" DESC`,
      queryParams
    );

    return NextResponse.json(plans);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create a new production plan ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const data = await req.json();
    const id = `pp-${Date.now()}`;

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: 'Plan name is required' }, { status: 400 });
    }
    if (!data.date) {
      return NextResponse.json({ error: 'Plan date is required' }, { status: 400 });
    }

    // Parse and validate items
    let items: any[] = [];
    if (data.items && Array.isArray(data.items)) {
      items = data.items;
    } else if (typeof data.items === 'string') {
      try {
        items = JSON.parse(data.items);
      } catch {
        return NextResponse.json({ error: 'Invalid items JSON format' }, { status: 400 });
      }
    }

    // Validate each item has required fields
    const validStatuses = ['draft', 'planned', 'in_progress', 'completed'];
    const planStatus = data.status || 'draft';
    if (!validStatuses.includes(planStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Calculate total cost from items if not provided
    let totalCost = data.totalCost || 0;
    if (!totalCost && items.length > 0) {
      totalCost = items.reduce((sum: number, item: any) => sum + (item.estimatedCost || 0), 0);
    }

    const plan = await pgQuery(
      `INSERT INTO "ProductionPlan" ("id", "tenantId", "name", "date", "status", "items", "totalCost", "assignedTo", "notes", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        id,
        tenantId,
        data.name,
        data.date,
        planStatus,
        JSON.stringify(items),
        totalCost,
        data.assignedTo || null,
        data.notes || null,
      ]
    );

    return NextResponse.json(plan[0] || plan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PUT: Update a production plan ───
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const { id, ...fields } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    const updates: Record<string, any> = { ...fields };

    // Validate status if provided
    if (updates.status) {
      const validStatuses = ['draft', 'planned', 'in_progress', 'completed'];
      if (!validStatuses.includes(updates.status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }
    }

    // Serialize items if provided as array
    if (updates.items && typeof updates.items !== 'string') {
      updates.items = JSON.stringify(updates.items);
    }

    // Build parameterized SET clause
    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined) {
        setParts.push(`"${k}" = NULL`);
      } else {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
    }
    setParts.push(`"updatedAt" = NOW()`);

    await pgQuery(
      `UPDATE "ProductionPlan" SET ${setParts.join(', ')} WHERE id = $${pIdx}`,
      [...paramValues, id]
    );

    const updated = await pgQueryOne(`SELECT * FROM "ProductionPlan" WHERE id = $1`, [id]);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Soft delete a production plan ───
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    await pgQuery(
      `UPDATE "ProductionPlan" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1`,
      [id]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
