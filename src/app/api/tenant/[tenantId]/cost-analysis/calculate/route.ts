import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

/**
 * Cost Analysis – Calculate endpoint
 *
 * POST body: { recipeId, servings, sellingPrice, laborCost, overheadCost, targetFoodCostPercent }
 *
 * Flow:
 * 1. Fetch recipe from Recipe table
 * 2. Fetch ingredient costs from Ingredient table
 * 3. Calculate totalCost, costPerServing, profitMargin, foodCostPercent, suggestedPrice
 * 4. Save CostAnalysis record
 * 5. Return full analysis
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
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
    const body = await req.json();
    const {
      recipeId,
      servings: inputServings,
      sellingPrice,
      laborCost,
      overheadCost,
      targetFoodCostPercent,
    } = body;

    if (!recipeId) {
      return NextResponse.json({ error: 'recipeId is required' }, { status: 400 });
    }

    // ─── 1. Fetch recipe ───
    const recipe = await pgQueryOne(
      `SELECT * FROM "Recipe" WHERE id = $1 AND "tenantId" = $2`,
      [recipeId, tenantId]
    );

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // ─── 2. Parse recipe ingredients ───
    let recipeIngs: any[] = [];
    try {
      recipeIngs =
        typeof recipe.ingredients === 'string'
          ? JSON.parse(recipe.ingredients)
          : recipe.ingredients || [];
    } catch {
      recipeIngs = [];
    }

    // ─── 3. Fetch all ingredient costs for this tenant ───
    const ingredients = await pgQuery(
      `SELECT * FROM "Ingredient" WHERE "tenantId" = $1 AND "isDeleted" = false`,
      [tenantId]
    );

    const ingMap: Record<string, number> = {};
    for (const ing of ingredients) {
      ingMap[ing.id] = ing.costPerUnit || 0;
    }

    // ─── 4. Calculate total ingredient cost ───
    const totalIngredientCost = recipeIngs.reduce(
      (sum: number, ri: any) => {
        const cpu = ri.costPerUnit ?? ingMap[ri.ingredientId] ?? 0;
        return sum + (ri.quantity || 0) * cpu;
      },
      0
    );

    // ─── 5. Calculate totals ───
    const labor = laborCost ?? 0;
    const overhead = overheadCost ?? 0;
    const totalCost = totalIngredientCost + labor + overhead;
    const servings = Math.max(inputServings ?? recipe.servings ?? 1, 1);
    const costPerServing = totalCost / servings;
    const price = sellingPrice ?? recipe.sellingPrice ?? 0;

    // profitMargin = ((sellingPrice - costPerServing) / sellingPrice) * 100
    const profitMargin =
      price > 0 ? ((price - costPerServing) / price) * 100 : 0;

    // foodCostPercent = (costPerServing / sellingPrice) * 100
    const foodCostPercent =
      price > 0 ? (costPerServing / price) * 100 : 0;

    // suggestedPrice = costPerServing / targetFoodCostPercent (if > 0)
    const target = targetFoodCostPercent ?? 0;
    const suggestedPrice =
      target > 0 ? costPerServing / (target / 100) : 0;

    // ─── 6. Save CostAnalysis record ───
    const result = await pgQuery(
      `INSERT INTO "CostAnalysis" (
        "tenantId", "recipeId", "recipeName", "totalCost", "costPerServing",
        "sellingPrice", "profitMargin", "foodCostPercent", "suggestedPrice",
        "laborCost", "overheadCost", "analysisDate"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        tenantId,
        recipeId,
        recipe.name || null,
        totalCost,
        costPerServing,
        price,
        profitMargin,
        foodCostPercent,
        suggestedPrice,
        labor,
        overhead,
        new Date().toISOString(),
      ]
    );

    const analysis = result[0] || result;

    // ─── 7. Return enriched analysis with breakdown ───
    return NextResponse.json({
      ...analysis,
      breakdown: {
        totalIngredientCost,
        laborCost: labor,
        overheadCost: overhead,
        totalCost,
        servings,
        costPerServing,
        sellingPrice: price,
        profitMargin,
        foodCostPercent,
        suggestedPrice,
        targetFoodCostPercent: target,
        ingredientCount: recipeIngs.length,
        ingredients: recipeIngs.map((ri: any) => ({
          ...ri,
          resolvedCostPerUnit: ri.costPerUnit ?? ingMap[ri.ingredientId] ?? 0,
          lineTotal: (ri.quantity || 0) * (ri.costPerUnit ?? ingMap[ri.ingredientId] ?? 0),
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
