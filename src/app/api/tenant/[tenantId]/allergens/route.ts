import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

// ── Allergen Declaration API ──
// T&T Public Health (Food Safety) Regulations - Allergen Labelling

const COMMON_ALLERGENS = [
  'milk', 'eggs', 'fish', 'crustaceans', 'molluscs', 'tree nuts', 'peanuts',
  'wheat', 'soybeans', 'sesame', 'celery', 'mustard', 'lupin', 'sulfites', 'gluten',
];

// ── Helper: Ensure table exists ──
async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "AllergenDeclaration" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "recipeId" TEXT,
      "ingredientId" TEXT,
      "ingredientName" TEXT NOT NULL,
      "allergenType" TEXT NOT NULL,
      "severity" TEXT DEFAULT 'medium',
      "declaration" TEXT DEFAULT '',
      "status" TEXT DEFAULT 'active',
      "reviewedBy" TEXT,
      "reviewedAt" TIMESTAMPTZ,
      "notes" TEXT,
      "isDeleted" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_allergen_tenant" ON "AllergenDeclaration"("tenantId");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_allergen_recipe" ON "AllergenDeclaration"("recipeId");`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS "idx_allergen_ingredient" ON "AllergenDeclaration"("ingredientId");`);
}

// ── GET: List allergen declarations / report / check-recipe ──
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
    const recipeId = searchParams.get('recipeId') || '';
    const ingredientId = searchParams.get('ingredientId') || '';
    const allergenType = searchParams.get('allergenType') || '';

    // ── /report: Allergen matrix (products vs allergens cross-reference) ──
    if (action === 'report') {
      const declarations = await pgQuery(
        `SELECT * FROM "AllergenDeclaration" WHERE "tenantId" = $1 AND "isDeleted" = false AND "status" = 'active'`,
        [tenantId]
      );

      // Build allergen type set
      const allergenTypes = [...new Set(declarations.map((d: any) => d.allergenType))].sort();

      // Group by recipeId
      const recipeMap: Record<string, Record<string, any>> = {};
      for (const d of declarations) {
        const key = d.recipeId || 'unassigned';
        if (!recipeMap[key]) recipeMap[key] = {};
        recipeMap[key][d.allergenType] = {
          ingredientName: d.ingredientName,
          severity: d.severity,
          declaration: d.declaration,
        };
      }

      // Build cross-reference table
      const matrix = allergenTypes.map((type) => {
        const row: Record<string, any> = { allergenType: type };
        for (const [recipe, allergens] of Object.entries(recipeMap)) {
          row[recipe] = allergens[type] ? `YES (${allergens[type].severity})` : '';
        }
        return row;
      });

      return NextResponse.json({
        allergenTypes,
        recipes: Object.keys(recipeMap),
        matrix,
        totalDeclarations: declarations.length,
        commonAllergens: COMMON_ALLERGENS,
      });
    }

    // ── /check-recipe: Check allergens for a specific recipe ──
    if (action === 'check-recipe') {
      if (!recipeId) {
        return NextResponse.json({ error: 'recipeId is required' }, { status: 400 });
      }

      const declarations = await pgQuery(
        `SELECT * FROM "AllergenDeclaration" WHERE "tenantId" = $1 AND "recipeId" = $2 AND "isDeleted" = false AND "status" = 'active'`,
        [tenantId, recipeId]
      );

      // Group allergens by type with severity
      const foundAllergens: Record<string, any> = {};
      for (const d of declarations) {
        foundAllergens[d.allergenType] = {
          ingredientName: d.ingredientName,
          ingredientId: d.ingredientId,
          severity: d.severity,
          declaration: d.declaration,
        };
      }

      const hasAllergens = Object.keys(foundAllergens).length > 0;
      const highSeverity = Object.values(foundAllergens).some((a: any) => a.severity === 'high' || a.severity === 'critical');

      return NextResponse.json({
        recipeId,
        hasAllergens,
        highRisk: highSeverity,
        allergens: foundAllergens,
        allergenCount: Object.keys(foundAllergens).length,
        labelDeclaration: declarations.map((d: any) => `Contains ${d.allergenType} (${d.ingredientName})`).join('. ') || 'No declared allergens.',
      });
    }

    // ── List declarations (default) ──
    const conditions: string[] = [`"tenantId" = $1`, `"isDeleted" = false`];
    const params: any[] = [tenantId];
    let pIdx = 2;

    if (recipeId) {
      conditions.push(`"recipeId" = $${pIdx++}`);
      params.push(recipeId);
    }
    if (ingredientId) {
      conditions.push(`"ingredientId" = $${pIdx++}`);
      params.push(ingredientId);
    }
    if (allergenType) {
      conditions.push(`"allergenType" = $${pIdx++}`);
      params.push(allergenType);
    }

    const declarations = await pgQuery(
      `SELECT * FROM "AllergenDeclaration" WHERE ${conditions.join(' AND ')} ORDER BY "allergenType" ASC, "createdAt" DESC LIMIT 500`,
      params
    );

    // Group by allergen type if requested
    if (searchParams.get('groupBy') === 'allergenType') {
      const grouped: Record<string, any[]> = {};
      for (const d of declarations) {
        if (!grouped[d.allergenType]) grouped[d.allergenType] = [];
        grouped[d.allergenType].push(d);
      }
      return NextResponse.json({ grouped, total: declarations.length });
    }

    return NextResponse.json(declarations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Create allergen declaration ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    await ensureTable();
    const data = await req.json();

    if (!data.ingredientName || !data.allergenType) {
      return NextResponse.json({ error: 'ingredientName and allergenType are required' }, { status: 400 });
    }

    // Validate allergen type
    const normalizedType = data.allergenType.toLowerCase();
    if (!COMMON_ALLERGENS.includes(normalizedType)) {
      return NextResponse.json({
        error: `Invalid allergen type. Must be one of: ${COMMON_ALLERGENS.join(', ')}`,
        validAllergens: COMMON_ALLERGENS,
      }, { status: 400 });
    }

    const result = await pgQuery(
      `INSERT INTO "AllergenDeclaration" ("tenantId", "recipeId", "ingredientId", "ingredientName", "allergenType", "severity", "declaration", "status", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, data.recipeId || null, data.ingredientId || null,
       data.ingredientName, normalizedType, data.severity || 'medium',
       data.declaration || '', data.status || 'active', data.notes || null]
    );
    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH: Update declaration / review ──
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

    // Review action
    if (data.action === 'review') {
      setParts.push(`"reviewedBy" = $${pIdx++}`);
      params.push(auth.payload?.userId || data.reviewedBy || null);
      setParts.push(`"reviewedAt" = NOW()`);
      if (data.status) {
        setParts.push(`"status" = $${pIdx++}`);
        params.push(data.status);
      }
    } else {
      const allowedFields = ['ingredientName', 'allergenType', 'severity', 'declaration', 'status', 'notes', 'recipeId', 'ingredientId'];
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          setParts.push(`"${field}" = $${pIdx++}`);
          params.push(data[field]);
        }
      }
    }

    params.push(data.id, tenantId);

    const result = await pgQuery(
      `UPDATE "AllergenDeclaration" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx} RETURNING *`,
      params
    );
    if (!result.length) return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
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
      `UPDATE "AllergenDeclaration" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
      [data.id, tenantId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
