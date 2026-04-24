import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

// GET: List all properties for this tenant with unit counts
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
    let properties: any[] = [];
    try {
      properties = await db.property.findMany({
        where: { tenantId },
        include: { propertyUnits: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // Fallback to pgQuery — replicate the include/join structure
      const rows = await pgQuery<any>(
        `SELECT p.*,
           pu.id AS "unit_id", pu."unitNumber" AS "unit_unitNumber", pu.floor AS "unit_floor",
           pu.area AS "unit_area", pu."baseRentTTD" AS "unit_baseRentTTD", pu."baseRentUSD" AS "unit_baseRentUSD",
           pu."tenantId" AS "unit_tenantId", pu.status AS "unit_status", pu.amenities AS "unit_amenities",
           pu.notes AS "unit_notes", pu."createdAt" AS "unit_createdAt", pu."updatedAt" AS "unit_updatedAt",
           pu."propertyId" AS "unit_propertyId"
         FROM "Property" p
         LEFT JOIN "PropertyUnit" pu ON pu."propertyId" = p.id
         WHERE p."tenantId" = $1
         ORDER BY p."createdAt" DESC`,
        [tenantId]
      );

      // Group propertyUnits by propertyId to match Prisma's include shape
      const unitsByProperty: Record<string, any[]> = {};
      for (const row of rows) {
        if (!unitsByProperty[row.id]) {
          unitsByProperty[row.id] = [];
        }
        if (row.unit_id) {
          unitsByProperty[row.id].push({
            id: row.unit_id,
            propertyId: row.unit_propertyId,
            unitNumber: row.unit_unitNumber,
            floor: row.unit_floor,
            area: row.unit_area,
            baseRentTTD: row.unit_baseRentTTD,
            baseRentUSD: row.unit_baseRentUSD,
            tenantId: row.unit_tenantId,
            status: row.unit_status,
            amenities: row.unit_amenities,
            notes: row.unit_notes,
            createdAt: row.unit_createdAt,
            updatedAt: row.unit_updatedAt,
          });
        }
      }

      // Deduplicate properties
      const seen = new Set<string>();
      properties = [];
      for (const row of rows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          properties.push({
            ...row,
            propertyUnits: unitsByProperty[row.id] || [],
          });
        }
      }
    }
    return NextResponse.json(properties);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new property scoped to this tenant
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
    const property = await db.property.create({
      data: {
        tenantId,
        name: data.name,
        address: data.address || null,
        city: data.city || null,
        country: data.country || 'TT',
        type: data.type || 'commercial',
        totalArea: data.totalArea || null,
        units: data.units || 1,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        status: data.status || 'active',
      },
    });
    return NextResponse.json(property);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update a property (verify it belongs to this tenant)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    if (!data.id) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    // Verify property belongs to this tenant
    const existing = await db.property.findUnique({ where: { id: data.id } });
    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    let property: any;
    try {
      property = await db.property.update({
        where: { id: data.id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.address !== undefined && { address: data.address }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.country && { country: data.country }),
          ...(data.type && { type: data.type }),
          ...(data.totalArea !== undefined && { totalArea: data.totalArea }),
          ...(data.units !== undefined && { units: data.units }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
          ...(data.status && { status: data.status }),
        },
      });
    } catch {
      // Fallback to pgQuery — parameterized query to prevent SQL injection
      const setClauses: string[] = [`"updatedAt" = NOW()`];
      const params: any[] = [];
      let pIdx = 1;
      if (data.name !== undefined) { setClauses.push(`"name" = $${pIdx++}`); params.push(data.name); }
      if (data.address !== undefined) {
        if (data.address === null) { setClauses.push(`"address" = NULL`); }
        else { setClauses.push(`"address" = $${pIdx++}`); params.push(data.address); }
      }
      if (data.city !== undefined) {
        if (data.city === null) { setClauses.push(`"city" = NULL`); }
        else { setClauses.push(`"city" = $${pIdx++}`); params.push(data.city); }
      }
      if (data.country !== undefined) { setClauses.push(`"country" = $${pIdx++}`); params.push(data.country); }
      if (data.type !== undefined) { setClauses.push(`"type" = $${pIdx++}`); params.push(data.type); }
      if (data.totalArea !== undefined) { setClauses.push(`"totalArea" = $${pIdx++}`); params.push(data.totalArea); }
      if (data.units !== undefined) { setClauses.push(`"units" = $${pIdx++}`); params.push(data.units); }
      if (data.description !== undefined) {
        if (data.description === null) { setClauses.push(`"description" = NULL`); }
        else { setClauses.push(`"description" = $${pIdx++}`); params.push(data.description); }
      }
      if (data.imageUrl !== undefined) {
        if (data.imageUrl === null) { setClauses.push(`"imageUrl" = NULL`); }
        else { setClauses.push(`"imageUrl" = $${pIdx++}`); params.push(data.imageUrl); }
      }
      if (data.status !== undefined) { setClauses.push(`"status" = $${pIdx++}`); params.push(data.status); }

      // WHERE includes tenantId for ownership verification
      const sql = `UPDATE "Property" SET ${setClauses.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`;
      params.push(data.id, tenantId);
      const rows = await pgQuery<any>(sql, params);
      property = rows[0] || null;
    }

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    return NextResponse.json(property);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a property (verify it belongs to this tenant)
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
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    // Verify property belongs to this tenant
    const property = await db.property.findUnique({ where: { id: data.id } });
    if (!property || property.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    await db.propertyUnit.deleteMany({ where: { propertyId: data.id } });
    await db.property.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
