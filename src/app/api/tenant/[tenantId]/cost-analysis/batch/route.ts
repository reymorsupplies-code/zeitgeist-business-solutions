import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

/**
 * Cost Analysis – Batch endpoint
 *
 * POST body: { recipeIds: string[], laborCost?: number, overheadCost?: number, targetFoodCostPercent?: number }
 *
 * Fetches recipes and their ingredient costs, calculates cost analysis
 * for all of them in one request. Useful for costing overview pages.
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
    const { recipeIds, laborCost, overheadCost, targetFoodCostPercent } = body;

    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      return NextResponse.json(
        { error: 'recipeIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (recipeIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 recipes per batch request' },
        { status: 400 }
      );
    }

    // ─── 1. Fetch all requested recipes ───
    // Build parameterized IN clause
    const recipePlaceholders = recipeIds.map((_, i) => `$${i + 2}`).join(', ');
    const recipes = await pgQuery(
      `SELECT * FROM "Recipe" WHERE "tenantId" = $1 AND id IN (${recipePlaceholders}) AND "isDeleted" = false`,
      [tenantId, ...recipeIds]
    );

    if (recipes.length === 0) {
      return NextResponse.json({ error: 'No recipes found' }, { status: 404 });
    }

    // ─── 2. Fetch all ingredient costs for this tenant ───
    const ingredients = await pgQuery(
      `SELECT * FROM "Ingredient" WHERE "tenantId" = $1 AND "isDeleted" = false`,
      [tenantId]
    );

    const ingMap: Record<string, number> = {};
    for (const ing of ingredients) {
      ingMap[ing.id] = ing.costPerUnit || 0;
    }

    // ─── 3. Calculate analysis for each recipe ───
    const globalLabor = laborCost ?? 0;
    const globalOverhead = overheadCost ?? 0;
    const globalTarget = targetFoodCostPercent ?? 0;

    const analyses: any[] = recipes.map((recipe: any) => {
      let recipeIngs: any[] = [];
      try {
        recipeIngs =
          typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : recipe.ingredients || [];
      } catch {
        recipeIngs = [];
      }

      const totalIngredientCost = recipeIngs.reduce(
        (sum: number, ri: any) => {
          const cpu = ri.costPerUnit ?? ingMap[ri.ingredientId] ?? 0;
          return sum + (ri.quantity || 0) * cpu;
        },
        0
      );

      const totalCost = totalIngredientCost + globalLabor + globalOverhead;
      const servings = Math.max(recipe.servings || 1, 1);
      const costPerServing = totalCost / servings;
      const price = recipe.sellingPrice || 0;

      const profitMargin =
        price > 0 ? ((price - costPerServing) / price) * 100 : 0;

      const foodCostPercent =
        price > 0 ? (costPerServing / price) * 100 : 0;

      const suggestedPrice =
        globalTarget > 0 ? costPerServing / (globalTarget / 100) : 0;

      return {
        recipeId: recipe.id,
        recipeName: recipe.name,
        totalCost,
        costPerServing,
        sellingPrice: price,
        profitMargin,
        foodCostPercent,
        suggestedPrice,
        laborCost: globalLabor,
        overheadCost: globalOverhead,
        servings,
        ingredientCount: recipeIngs.length,
      };
    });

    // ─── 4. Optionally persist batch analyses ───
    // We save each analysis individually for historical tracking
    if (analyses.length > 0) {
      const insertPromises = analyses.map((analysis) =>
        pgQuery(
          `INSERT INTO "CostAnalysis" (
            "tenantId", "recipeId", "recipeName", "totalCost", "costPerServing",
            "sellingPrice", "profitMargin", "foodCostPercent", "suggestedPrice",
            "laborCost", "overheadCost", "analysisDate"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
          [
            tenantId,
            analysis.recipeId,
            analysis.recipeName,
            analysis.totalCost,
            analysis.costPerServing,
            analysis.sellingPrice,
            analysis.profitMargin,
            analysis.foodCostPercent,
            analysis.suggestedPrice,
            analysis.laborCost,
            analysis.overheadCost,
            new Date().toISOString(),
          ]
        )
      );

      const savedResults = await Promise.all(insertPromises);
      // Merge saved IDs back into analyses
      for (let i = 0; i < analyses.length; i++) {
        const saved = savedResults[i]?.[0];
        if (saved) {
          analyses[i].id = saved.id;
          analyses[i].createdAt = saved.createdAt;
          analyses[i].analysisDate = saved.analysisDate;
        }
      }
    }

    // ─── 5. Return batch summary ───
    const totalRecipes = analyses.length;
    const avgFoodCost =
      analyses.reduce((sum: number, a: any) => sum + a.foodCostPercent, 0) / totalRecipes;
    const avgProfitMargin =
      analyses.reduce((sum: number, a: any) => sum + a.profitMargin, 0) / totalRecipes;

    return NextResponse.json({
      analyses,
      summary: {
        totalRecipes,
        avgFoodCostPercent: Math.round(avgFoodCost * 100) / 100,
        avgProfitMargin: Math.round(avgProfitMargin * 100) / 100,
        totalIngredientCosts: analyses.reduce((s: number, a: any) => s + a.totalCost, 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
