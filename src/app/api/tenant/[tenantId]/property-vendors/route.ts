import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: List property vendors scoped to tenant ───
// Supports query params: ?propertyId=xxx&category=plumbing
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
    const propertyId = url.searchParams.get('propertyId');
    const category = url.searchParams.get('category');

    try {
      const where: Record<string, unknown> = { tenantId };
      if (propertyId) where.propertyId = propertyId;
      if (category) where.category = category;

      const vendors = await db.propertyVendor.findMany({
        where,
        include: { property: true },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(vendors);
    } catch {
      // Fallback to raw SQL
      let sql = `SELECT pv.*, p.name AS "propertyName", p.address AS "propertyAddress"
                 FROM "PropertyVendor" pv
                 LEFT JOIN "Property" p ON p.id = pv."propertyId"
                 WHERE pv."tenantId" = $1`;
      const queryParams: any[] = [tenantId];
      let paramIdx = 2;

      if (propertyId) {
        sql += ` AND pv."propertyId" = $${paramIdx++}`;
        queryParams.push(propertyId);
      }
      if (category) {
        sql += ` AND pv.category = $${paramIdx++}`;
        queryParams.push(category);
      }

      sql += ` ORDER BY pv."createdAt" DESC`;
      const vendors = await pgQuery<any>(sql, queryParams);
      return NextResponse.json(vendors);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create property vendor ───
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

    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
    }

    try {
      const vendor = await db.propertyVendor.create({
        data: {
          tenantId,
          propertyId: data.propertyId || null,
          name: data.name.trim(),
          category: data.category || null,
          contact: data.contact || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          rating: data.rating ?? 0,
          isActive: data.isActive ?? true,
          notes: data.notes || null,
        },
        include: { property: true },
      });
      return NextResponse.json(vendor, { status: 201 });
    } catch {
      const result = await pgQuery<any>(
        `INSERT INTO "PropertyVendor" (
          "tenantId", "propertyId", name, category, contact, email, phone, address,
          rating, "isActive", notes, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
        [
          tenantId,
          data.propertyId || null,
          data.name.trim(),
          data.category || null,
          data.contact || null,
          data.email || null,
          data.phone || null,
          data.address || null,
          data.rating ?? 0,
          data.isActive ?? true,
          data.notes || null,
        ]
      );
      return NextResponse.json(result[0], { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PATCH: Update property vendor ───
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    const { id, ...fields } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    // Verify vendor belongs to this tenant
    try {
      const existing = await db.propertyVendor.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Vendor not found or access denied' }, { status: 404 });
      }

      const allowedFields = [
        'propertyId', 'name', 'category', 'contact', 'email',
        'phone', 'address', 'rating', 'isActive', 'notes',
      ];

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (fields[field] !== undefined) {
          updateData[field] = fields[field];
        }
      }

      const updated = await db.propertyVendor.update({
        where: { id },
        data: updateData,
        include: { property: true },
      });
      return NextResponse.json(updated);
    } catch {
      // Verify ownership via raw SQL
      const existing = await pgQueryOne(
        `SELECT id FROM "PropertyVendor" WHERE id = $1 AND "tenantId" = $2`,
        [id, tenantId]
      );
      if (!existing) {
        return NextResponse.json({ error: 'Vendor not found or access denied' }, { status: 404 });
      }

      const allowedFields = [
        'propertyId', 'name', 'category', 'contact', 'email',
        'phone', 'address', 'rating', 'isActive', 'notes',
      ];

      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;

      for (const field of allowedFields) {
        if (fields[field] !== undefined) {
          setParts.push(`"${field}" = $${pIdx++}`);
          paramValues.push(fields[field]);
        }
      }

      if (setParts.length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
      }

      setParts.push(`"updatedAt" = NOW()`);
      paramValues.push(id);

      const sql = `UPDATE "PropertyVendor" SET ${setParts.join(', ')} WHERE id = $${pIdx}`;
      await pgQuery(sql, paramValues);

      const updated = await pgQueryOne(
        `SELECT pv.*, p.name AS "propertyName", p.address AS "propertyAddress"
         FROM "PropertyVendor" pv
         LEFT JOIN "Property" p ON p.id = pv."propertyId"
         WHERE pv.id = $1`,
        [id]
      );
      return NextResponse.json(updated);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Soft-delete property vendor ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    try {
      // Verify vendor belongs to this tenant
      const existing = await db.propertyVendor.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Vendor not found or access denied' }, { status: 404 });
      }

      await db.propertyVendor.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch {
      const existing = await pgQueryOne(
        `SELECT id FROM "PropertyVendor" WHERE id = $1 AND "tenantId" = $2`,
        [id, tenantId]
      );
      if (!existing) {
        return NextResponse.json({ error: 'Vendor not found or access denied' }, { status: 404 });
      }

      await pgQuery(`DELETE FROM "PropertyVendor" WHERE id = $1`, [id]);
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
