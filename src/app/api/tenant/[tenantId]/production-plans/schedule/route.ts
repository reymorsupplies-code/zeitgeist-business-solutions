import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

/**
 * POST /api/tenant/[tenantId]/production-plans/schedule
 *
 * Takes a productionPlanId and scheduledDate, updates the plan status
 * to 'planned', and creates ProductionBatch records for each item.
 *
 * Body: { productionPlanId: string, scheduledDate: string }
 * Returns: updated plan with created batch IDs
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // ─── Auth check ───
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const body = await req.json();
    const { productionPlanId, scheduledDate } = body;

    if (!productionPlanId) {
      return NextResponse.json({ error: 'productionPlanId is required' }, { status: 400 });
    }
    if (!scheduledDate) {
      return NextResponse.json({ error: 'scheduledDate is required' }, { status: 400 });
    }

    // ─── 1. Fetch the production plan, scoped to tenant ───
    const plan = await pgQueryOne(
      `SELECT * FROM "ProductionPlan" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
      [productionPlanId, tenantId]
    );

    if (!plan) {
      return NextResponse.json({ error: 'Production plan not found' }, { status: 404 });
    }

    if (plan.status === 'completed') {
      return NextResponse.json({ error: 'Cannot schedule a completed production plan' }, { status: 400 });
    }

    // ─── 2. Parse plan items ───
    let planItems: any[] = [];
    try {
      planItems = typeof plan.items === 'string' ? JSON.parse(plan.items) : (plan.items || []);
    } catch {
      return NextResponse.json({ error: 'Failed to parse production plan items' }, { status: 500 });
    }

    if (planItems.length === 0) {
      return NextResponse.json({ error: 'Production plan has no items to schedule' }, { status: 400 });
    }

    // ─── 3. Get current batch count for batch number generation ───
    const countResult = await pgQueryOne(
      `SELECT COUNT(*)::int as cnt FROM "ProductionBatch" WHERE "tenantId" = $1`,
      [tenantId]
    );
    let batchCounter = countResult?.cnt || 0;

    // ─── 4. Create ProductionBatch records for each plan item ───
    const createdBatches: any[] = [];

    for (const item of planItems) {
      batchCounter++;
      const batchId = `pb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const batchNumber = `BATCH-${String(batchCounter).padStart(4, '0')}`;

      // Build ingredient needs for the batch from the recipe if available
      let ingredientNeeds: any[] = [];
      if (item.recipeId) {
        const recipe = await pgQueryOne(
          `SELECT * FROM "Recipe" WHERE id = $1 AND "isDeleted" = false`,
          [item.recipeId]
        );
        if (recipe) {
          let recipeIngredients: any[] = [];
          try {
            recipeIngredients = typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : (recipe.ingredients || []);
          } catch {
            recipeIngredients = [];
          }

          const servings = recipe.servings || 1;
          const scaleFactor = (item.plannedQty || 1) / servings;

          ingredientNeeds = recipeIngredients.map((ri: any) => ({
            ingredientId: ri.ingredientId || '',
            name: ri.name || '',
            quantity: (ri.quantity || 0) * scaleFactor,
            unit: ri.unit || '',
            costPerUnit: ri.costPerUnit || 0,
            total: (ri.quantity || 0) * scaleFactor * (ri.costPerUnit || 0),
          }));
        }
      }

      const totalBatchCost = ingredientNeeds.reduce((s: number, i: any) => s + (i.total || 0), 0);

      const batch = await pgQuery(
        `INSERT INTO "ProductionBatch" ("id", "tenantId", "batchNumber", "recipeId", "recipeName", "category", "plannedQty", "unit", "status", "scheduledDate", "assignedTo", "notes", "ingredientNeeds", "totalCost", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
         RETURNING *`,
        [
          batchId,
          tenantId,
          batchNumber,
          item.recipeId || null,
          item.recipeName || '',
          item.category || '',
          item.plannedQty || 0,
          item.unit || 'unidades',
          'planned',
          scheduledDate,
          item.assignedTo || plan.assignedTo || null,
          item.notes || null,
          JSON.stringify(ingredientNeeds),
          totalBatchCost,
        ]
      );

      if (batch[0]) {
        createdBatches.push(batch[0]);
      }
    }

    // ─── 5. Update the production plan status to 'planned' ───
    await pgQuery(
      `UPDATE "ProductionPlan" SET "status" = $1, "date" = $2, "updatedAt" = NOW() WHERE id = $3`,
      ['planned', scheduledDate, productionPlanId]
    );

    // Fetch updated plan
    const updatedPlan = await pgQueryOne(
      `SELECT * FROM "ProductionPlan" WHERE id = $1`,
      [productionPlanId]
    );

    // ─── 6. Return result ───
    return NextResponse.json({
      plan: updatedPlan,
      batchesCreated: createdBatches.length,
      batches: createdBatches,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
