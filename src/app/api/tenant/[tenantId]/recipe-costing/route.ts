import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

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
    // Parameterized queries to prevent SQL injection
    const recipes = await pgQuery(
      `SELECT * FROM "Recipe" WHERE "tenantId" = $1 AND "isDeleted" = false ORDER BY name ASC`,
      [tenantId]
    );

    const ingredients = await pgQuery(
      `SELECT * FROM "Ingredient" WHERE "tenantId" = $1 AND "isDeleted" = false`,
      [tenantId]
    );
    const ingMap: Record<string, number> = {};
    for (const ing of ingredients) {
      ingMap[ing.id] = ing.costPerUnit || 0;
    }

    const enriched = recipes.map((recipe: any) => {
      let recipeIngs: any[] = [];
      try { recipeIngs = typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : (recipe.ingredients || []); } catch { recipeIngs = []; }

      // Use DB costPerUnit if available, fallback to ingredient master data
      const totalCost = recipeIngs.reduce((sum: number, ri: any) => {
        const cpu = ri.costPerUnit || ingMap[ri.ingredientId] || 0;
        return sum + (ri.quantity || 0) * cpu;
      }, 0);

      const servings = Math.max(recipe.servings || 1, 1);
      const costPerServing = totalCost / servings;
      const sellingPrice = recipe.sellingPrice || 0;
      const foodCostPct = sellingPrice > 0 ? (costPerServing / sellingPrice) * 100 : 0;
      const marginPct = sellingPrice > 0 ? 100 - foodCostPct : 0;
      const suggestedPrice25 = costPerServing / 0.75;
      const suggestedPrice30 = costPerServing / 0.70;
      const suggestedPrice35 = costPerServing / 0.65;

      let status: 'excellent' | 'good' | 'low' | 'critical' = 'critical';
      if (marginPct > 70) status = 'excellent';
      else if (marginPct > 50) status = 'good';
      else if (marginPct > 30) status = 'low';

      return {
        ...recipe,
        ingredientDetails: recipeIngs,
        totalCost,
        costPerServing,
        foodCostPct,
        marginPct,
        suggestedPrice25,
        suggestedPrice30,
        suggestedPrice35,
        marginStatus: status,
      };
    });

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const { id, sellingPrice, costPerServing, ingredients } = await req.json();
  if (!id) return NextResponse.json({ error: 'Recipe ID required' }, { status: 400 });

  try {
    // Parameterized update to prevent SQL injection
    const setParts: string[] = [`"updatedAt" = NOW()`];
    const paramValues: any[] = [];
    let pIdx = 1;

    if (sellingPrice !== undefined) {
      setParts.push(`"sellingPrice" = $${pIdx++}`);
      paramValues.push(sellingPrice);
    }
    if (costPerServing !== undefined) {
      setParts.push(`"costPerServing" = $${pIdx++}`);
      paramValues.push(costPerServing);
    }
    if (ingredients !== undefined) {
      const ingsStr = typeof ingredients === 'string' ? ingredients : JSON.stringify(ingredients);
      setParts.push(`"ingredients" = $${pIdx++}`);
      paramValues.push(ingsStr);
    }

    await pgQuery(`UPDATE "Recipe" SET ${setParts.join(', ')} WHERE id = $${pIdx++}`, [...paramValues, id]);
    const updated = await pgQuery(`SELECT * FROM "Recipe" WHERE id = $1`, [id]);
    return NextResponse.json(updated[0] || updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
