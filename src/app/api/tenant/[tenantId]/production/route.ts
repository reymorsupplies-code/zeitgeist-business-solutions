import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

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

    // Parameterized query to prevent SQL injection
    let where = [`"tenantId" = $1`, `"isDeleted" = false`];
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (status) { where.push(`"status" = $${paramIdx++}`); queryParams.push(status); }
    if (dateFrom) { where.push(`"scheduledDate" >= $${paramIdx++}`); queryParams.push(dateFrom); }
    if (dateTo) { where.push(`"scheduledDate" <= $${paramIdx++}`); queryParams.push(dateTo); }

    const batches = await pgQuery(
      `SELECT * FROM "ProductionBatch" WHERE ${where.join(' AND ')} ORDER BY "scheduledDate" DESC NULLS LAST, "createdAt" DESC`,
      queryParams
    );
    return NextResponse.json(batches);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const id = `pb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let recipeName = data.recipeName || '';
    let category = data.category || '';
    let ingredientNeeds: any[] = data.ingredientNeeds || [];
    let totalCost = data.totalCost || 0;

    // Auto from recipe (parameterized)
    if (data.recipeId && !data.recipeName) {
      const recipe = await pgQueryOne(`SELECT * FROM "Recipe" WHERE id = $1 AND "isDeleted" = false`, [data.recipeId]);
      if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });

      recipeName = recipe.name;
      category = recipe.category || '';

      // Parse recipe ingredients
      let recipeIngredients: any[] = [];
      try { recipeIngredients = typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : (recipe.ingredients || []); } catch { recipeIngredients = []; }

      const servings = recipe.servings || 1;
      const plannedQty = data.plannedQty || 1;
      const scaleFactor = plannedQty / servings;

      ingredientNeeds = recipeIngredients.map((ri: any) => ({
        ingredientId: ri.ingredientId || '',
        name: ri.name || '',
        quantity: (ri.quantity || 0) * scaleFactor,
        unit: ri.unit || '',
        costPerUnit: ri.costPerUnit || 0,
        total: (ri.quantity || 0) * scaleFactor * (ri.costPerUnit || 0),
      }));

      totalCost = ingredientNeeds.reduce((s, i) => s + i.total, 0);
    }

    // Generate batch number (parameterized)
    const countResult = await pgQueryOne(`SELECT COUNT(*)::int as cnt FROM "ProductionBatch" WHERE "tenantId" = $1`, [tenantId]);
    const batchCount = (countResult?.cnt || 0) + 1;
    const batchNumber = `BATCH-${String(batchCount).padStart(4, '0')}`;

    const batch = await pgQuery(
      `INSERT INTO "ProductionBatch" ("id", "tenantId", "batchNumber", "recipeId", "recipeName", "category", "plannedQty", "unit", "status", "scheduledDate", "assignedTo", "notes", "ingredientNeeds", "totalCost")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [id, tenantId, batchNumber, data.recipeId || null, recipeName, category, data.plannedQty || 0, data.unit || 'unidades', data.status || 'planned', data.scheduledDate || null, data.assignedTo || null, data.notes || null, JSON.stringify(ingredientNeeds), totalCost]
    );

    return NextResponse.json(batch[0] || batch);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    // Handle ingredientNeeds serialization
    const updates: any = { ...fields, updatedAt: new Date().toISOString() };
    if (updates.ingredientNeeds && typeof updates.ingredientNeeds !== 'string') {
      updates.ingredientNeeds = JSON.stringify(updates.ingredientNeeds);
    }

    // Use parameterized update via Prisma-style approach
    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined) {
        setParts.push(`"${k}" = NULL`);
      } else if (typeof v === 'string') {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      } else {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
    }
    setParts.push(`"updatedAt" = NOW()`);

    await pgQuery(`UPDATE "ProductionBatch" SET ${setParts.join(', ')} WHERE id = $${pIdx++}`, [...paramValues, id]);
    const updated = await pgQueryOne(`SELECT * FROM "ProductionBatch" WHERE id = $1`, [id]);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await pgQuery(`UPDATE "ProductionBatch" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
