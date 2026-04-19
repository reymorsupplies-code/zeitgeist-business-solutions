import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

// GET: List all properties with unit counts
export async function GET() {
  try {
    let properties: any[] = [];
    try {
      properties = await db.property.findMany({
        include: { propertyUnits: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // Fallback to Management API — replicate the include/join structure
      const rows = await pgQuery<any>(
        `SELECT p.*,
           pu.id AS "unit_id", pu."unitNumber" AS "unit_unitNumber", pu.floor AS "unit_floor",
           pu.area AS "unit_area", pu."baseRentTTD" AS "unit_baseRentTTD", pu."baseRentUSD" AS "unit_baseRentUSD",
           pu."tenantId" AS "unit_tenantId", pu.status AS "unit_status", pu.amenities AS "unit_amenities",
           pu.notes AS "unit_notes", pu."createdAt" AS "unit_createdAt", pu."updatedAt" AS "unit_updatedAt",
           pu."propertyId" AS "unit_propertyId"
         FROM "Property" p
         LEFT JOIN "PropertyUnit" pu ON pu."propertyId" = p.id
         ORDER BY p."createdAt" DESC`
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

// POST: Create a new property
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const property = await db.property.create({
      data: {
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

// PUT: Update a property
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
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
      // Fallback to Management API
      const setClauses: string[] = [`"updatedAt" = NOW()`];
      if (data.name !== undefined) setClauses.push(`"name" = '${data.name.replace(/'/g, "''")}'`);
      if (data.address !== undefined) setClauses.push(`"address" = ${data.address === null ? 'NULL' : `'${data.address.replace(/'/g, "''")}'`}`);
      if (data.city !== undefined) setClauses.push(`"city" = ${data.city === null ? 'NULL' : `'${data.city.replace(/'/g, "''")}'`}`);
      if (data.country !== undefined) setClauses.push(`"country" = '${data.country}'`);
      if (data.type !== undefined) setClauses.push(`"type" = '${data.type}'`);
      if (data.totalArea !== undefined) setClauses.push(`"totalArea" = ${data.totalArea === null ? 'NULL' : data.totalArea}`);
      if (data.units !== undefined) setClauses.push(`"units" = ${data.units}`);
      if (data.description !== undefined) setClauses.push(`"description" = ${data.description === null ? 'NULL' : `'${data.description.replace(/'/g, "''")}'`}`);
      if (data.imageUrl !== undefined) setClauses.push(`"imageUrl" = ${data.imageUrl === null ? 'NULL' : `'${data.imageUrl.replace(/'/g, "''")}'`}`);
      if (data.status !== undefined) setClauses.push(`"status" = '${data.status}'`);

      const sql = `UPDATE "Property" SET ${setClauses.join(', ')} WHERE id = '${data.id}' RETURNING *`;
      const rows = await pgQuery<any>(sql);
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

// DELETE: Delete a property
export async function DELETE(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    const property = await db.property.findUnique({ where: { id: data.id } });
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    await db.propertyUnit.deleteMany({ where: { propertyId: data.id } });
    await db.property.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
