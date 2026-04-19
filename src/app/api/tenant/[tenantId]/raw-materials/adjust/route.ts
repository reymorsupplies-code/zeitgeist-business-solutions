import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/pg-query';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';

// ─── POST: Adjust raw material stock quantity ───
// Body: { id, type: 'entry'|'exit'|'adjustment', quantity, reason?, reference?, batchNumber?, expiryDate?, method? }
// Creates a StockMovement record and updates the raw material quantity.
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth guard
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
    const { id, type, quantity, reason, reference, batchNumber, expiryDate, method } = body;

    if (!id || !type || quantity === undefined || quantity === null) {
      return NextResponse.json(
        { error: 'Raw material ID, type, and quantity are required' },
        { status: 400 }
      );
    }

    if (!['entry', 'exit', 'adjustment'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be one of: entry, exit, adjustment' },
        { status: 400 }
      );
    }

    // Fetch current raw material (parameterized)
    const materials = await pgQuery<any>(
      `SELECT * FROM "RawMaterial" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
      [id, tenantId]
    );

    if (!materials || materials.length === 0) {
      return NextResponse.json({ error: 'Raw material not found' }, { status: 404 });
    }

    const material = materials[0];
    const previousStock = material.quantity || 0;
    const absQuantity = Math.abs(quantity);
    let newStock = previousStock;

    if (type === 'entry') {
      newStock = previousStock + absQuantity;
    } else if (type === 'exit') {
      newStock = Math.max(0, previousStock - absQuantity);
    } else if (type === 'adjustment') {
      newStock = absQuantity;
    }

    // Create StockMovement record (parameterized)
    const movementId = `sm-${Date.now()}`;
    await pgQuery(
      `INSERT INTO "StockMovement" (
        id, "tenantId", "rawMaterialId", type, quantity, "previousStock", "newStock",
        "unitCost", reason, reference, "batchNumber", "expiryDate", method
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )`,
      [
        movementId,
        tenantId,
        id,
        type,
        absQuantity,
        previousStock,
        newStock,
        material.unitCost || 0,
        reason || null,
        reference || null,
        batchNumber || null,
        expiryDate || null,
        method || 'fifo',
      ]
    );

    // Update raw material quantity (parameterized)
    await pgQuery(
      `UPDATE "RawMaterial" SET quantity = $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`,
      [newStock, id, tenantId]
    );

    return NextResponse.json({
      id: movementId,
      rawMaterialId: id,
      rawMaterialName: material.name,
      type,
      quantity: absQuantity,
      previousStock,
      newStock,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
