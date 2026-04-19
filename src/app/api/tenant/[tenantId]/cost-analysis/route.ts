import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

/**
 * Cost Analysis & Margins – CRUD
 * Table: CostAnalysis
 */

// ─── GET: List analyses (optional ?recipeId= filter) ───
export async function GET(
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
    const { searchParams } = new URL(req.url);
    const recipeId = searchParams.get('recipeId');

    let analyses;
    if (recipeId) {
      analyses = await pgQuery(
        `SELECT * FROM "CostAnalysis" WHERE "tenantId" = $1 AND "recipeId" = $2 ORDER BY "analysisDate" DESC`,
        [tenantId, recipeId]
      );
    } else {
      analyses = await pgQuery(
        `SELECT * FROM "CostAnalysis" WHERE "tenantId" = $1 ORDER BY "analysisDate" DESC`,
        [tenantId]
      );
    }

    return NextResponse.json(analyses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create analysis ───
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
      recipeName,
      totalCost,
      costPerServing,
      sellingPrice,
      profitMargin,
      foodCostPercent,
      suggestedPrice,
      laborCost,
      overheadCost,
      analysisDate,
      notes,
    } = body;

    if (!recipeId) {
      return NextResponse.json({ error: 'recipeId is required' }, { status: 400 });
    }

    const result = await pgQuery(
      `INSERT INTO "CostAnalysis" (
        "tenantId", "recipeId", "recipeName", "totalCost", "costPerServing",
        "sellingPrice", "profitMargin", "foodCostPercent", "suggestedPrice",
        "laborCost", "overheadCost", "analysisDate", "notes"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        tenantId,
        recipeId,
        recipeName || null,
        totalCost ?? 0,
        costPerServing ?? 0,
        sellingPrice ?? 0,
        profitMargin ?? 0,
        foodCostPercent ?? 0,
        suggestedPrice ?? 0,
        laborCost ?? 0,
        overheadCost ?? 0,
        analysisDate || new Date().toISOString(),
        notes || null,
      ]
    );

    return NextResponse.json(result[0] || result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PUT: Update analysis ───
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const allowedFields = [
      'recipeId', 'recipeName', 'totalCost', 'costPerServing', 'sellingPrice',
      'profitMargin', 'foodCostPercent', 'suggestedPrice', 'laborCost',
      'overheadCost', 'analysisDate', 'notes',
    ];

    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        setParts.push(`"${key}" = $${pIdx++}`);
        paramValues.push(value);
      }
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await pgQuery(
      `UPDATE "CostAnalysis" SET ${setParts.join(', ')} WHERE id = $${pIdx}`,
      [...paramValues, id]
    );

    const updated = await pgQuery(`SELECT * FROM "CostAnalysis" WHERE id = $1`, [id]);
    return NextResponse.json(updated[0] || updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Delete analysis ───
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pgQuery(`DELETE FROM "CostAnalysis" WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
