import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

/**
 * POST /api/tenant/[tenantId]/production-plans/auto-generate
 *
 * Takes a list of order IDs, fetches their items, groups by product type,
 * looks up recipes, and calculates total ingredient needs.
 *
 * Body: { orderIds: string[] }
 * Returns: suggested production plan with ingredient needs
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
    const { orderIds } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds must be a non-empty array' }, { status: 400 });
    }

    // ─── 1. Fetch all orders by ID, scoped to tenant ───
    // Build parameterized IN clause
    const orderPlaceholders = orderIds.map((_, i) => `$${i + 2}`).join(', ');
    const queryParams: any[] = [tenantId, ...orderIds];

    const orders = await pgQuery(
      `SELECT * FROM "Order" WHERE "tenantId" = $1 AND id IN (${orderPlaceholders}) AND "isDeleted" = false`,
      queryParams
    );

    if (orders.length === 0) {
      return NextResponse.json({ error: 'No valid orders found for the given IDs' }, { status: 404 });
    }

    // ─── 2. Collect and group all order items by product ───
    const productQuantities: Record<string, { name: string; totalQty: number; unit: string }> = {};

    for (const order of orders) {
      let items: any[] = [];
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
      } catch {
        items = [];
      }

      for (const item of items) {
        // Use productId or product name as key for grouping
        const key = item.productId || item.recipeId || item.name || 'unknown';
        if (!productQuantities[key]) {
          productQuantities[key] = {
            name: item.name || item.productName || item.recipeName || key,
            totalQty: 0,
            unit: item.unit || 'unidades',
          };
        }
        productQuantities[key].totalQty += (item.quantity || item.qty || 0);
      }
    }

    // ─── 3. Look up recipes for each product and calculate ingredient needs ───
    const ingredientNeeds: Record<string, { ingredientId: string; name: string; quantity: number; unit: string; costPerUnit: number; total: number }> = {};
    const planItems: any[] = [];

    for (const productKey of Object.keys(productQuantities)) {
      const product = productQuantities[productKey];

      // Try to find a recipe by product name (case-insensitive match)
      const recipe = await pgQueryOne(
        `SELECT * FROM "Recipe" WHERE "tenantId" = $1 AND LOWER("name") = LOWER($2) AND "isDeleted" = false LIMIT 1`,
        [tenantId, product.name]
      );

      if (recipe) {
        // Parse recipe ingredients
        let recipeIngredients: any[] = [];
        try {
          recipeIngredients = typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : (recipe.ingredients || []);
        } catch {
          recipeIngredients = [];
        }

        // Calculate scale factor: how many recipe batches needed
        const servings = recipe.servings || 1;
        const scaleFactor = product.totalQty / servings;

        // Aggregate ingredient needs from this recipe
        for (const ri of recipeIngredients) {
          const ingKey = ri.ingredientId || ri.name || 'unknown';
          const scaledQty = (ri.quantity || 0) * scaleFactor;
          const scaledTotal = scaledQty * (ri.costPerUnit || 0);

          if (!ingredientNeeds[ingKey]) {
            ingredientNeeds[ingKey] = {
              ingredientId: ri.ingredientId || '',
              name: ri.name || '',
              quantity: 0,
              unit: ri.unit || '',
              costPerUnit: ri.costPerUnit || 0,
              total: 0,
            };
          }

          ingredientNeeds[ingKey].quantity += scaledQty;
          ingredientNeeds[ingKey].total += scaledTotal;

          // Keep unit from the ingredient with the largest quantity
          if (scaledQty > 0 && ingredientNeeds[ingKey].unit === '') {
            ingredientNeeds[ingKey].unit = ri.unit || '';
          }
        }

        // Calculate item cost from scaled recipe ingredients
        const itemCost = recipeIngredients.reduce((sum: number, ri: any) => {
          return sum + (ri.quantity || 0) * scaleFactor * (ri.costPerUnit || 0);
        }, 0);

        planItems.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          plannedQty: product.totalQty,
          unit: product.unit,
          estimatedCost: itemCost,
          servings: recipe.servings,
          scaleFactor: Math.round(scaleFactor * 1000) / 1000,
        });
      } else {
        // No recipe found – add as a plan item without ingredient detail
        planItems.push({
          recipeId: null,
          recipeName: product.name,
          plannedQty: product.totalQty,
          unit: product.unit,
          estimatedCost: 0,
          servings: null,
          scaleFactor: null,
          note: 'No matching recipe found',
        });
      }
    }

    // ─── 4. Calculate totals ───
    const totalIngredientCost = Object.values(ingredientNeeds).reduce((sum, ing) => sum + ing.total, 0);
    const totalPlanCost = planItems.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);

    // ─── 5. Return suggested plan ───
    const suggestedPlan = {
      sourceOrderIds: orderIds,
      orderCount: orders.length,
      items: planItems,
      ingredientNeeds: Object.values(ingredientNeeds),
      totalIngredientCost,
      totalPlanCost,
      generatedAt: new Date().toISOString(),
      status: 'draft',
    };

    return NextResponse.json(suggestedPlan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
