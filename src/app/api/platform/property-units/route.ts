import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';
import { authenticateRequest } from '@/lib/auth';

// GET: List all property units with property and tenant
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    let units: any[] = [];
    try {
      units = await db.propertyUnit.findMany({
        include: { property: true, tenant: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // Fallback to Management API — replicate the include/join structure
      const rows = await pgQuery<any>(
        `SELECT pu.*,
           p.id AS "property_id", p.name AS "property_name", p.address AS "property_address",
           p.city AS "property_city", p.country AS "property_country", p.type AS "property_type",
           p."totalArea" AS "property_totalArea", p.units AS "property_units",
           p.status AS "property_status", p."imageUrl" AS "property_imageUrl",
           p."createdAt" AS "property_createdAt", p."updatedAt" AS "property_updatedAt",
           t.id AS "tenant_id", t.name AS "tenant_name", t.slug AS "tenant_slug",
           t.email AS "tenant_email", t.phone AS "tenant_phone", t.status AS "tenant_status"
         FROM "PropertyUnit" pu
         LEFT JOIN "Property" p ON p.id = pu."propertyId"
         LEFT JOIN "Tenant" t ON t.id = pu."tenantId"
         ORDER BY pu."createdAt" DESC`
      );

      // Compose unit objects to match Prisma's include shape
      units = rows.map((row: any) => ({
        id: row.id,
        propertyId: row.propertyId,
        unitNumber: row.unitNumber,
        floor: row.floor,
        area: row.area,
        baseRentTTD: row.baseRentTTD,
        baseRentUSD: row.baseRentUSD,
        tenantId: row.tenantId,
        status: row.status,
        amenities: row.amenities,
        notes: row.notes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        property: row.property_id ? {
          id: row.property_id,
          name: row.property_name,
          address: row.property_address,
          city: row.property_city,
          country: row.property_country,
          type: row.property_type,
          totalArea: row.property_totalArea,
          units: row.property_units,
          status: row.property_status,
          imageUrl: row.property_imageUrl,
          createdAt: row.property_createdAt,
          updatedAt: row.property_updatedAt,
        } : null,
        tenant: row.tenant_id ? {
          id: row.tenant_id,
          name: row.tenant_name,
          slug: row.tenant_slug,
          email: row.tenant_email,
          phone: row.tenant_phone,
          status: row.tenant_status,
        } : null,
      }));
    }
    return NextResponse.json(units);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new property unit
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();

    // If tenantId is provided, set status to "occupied"
    const unitStatus = data.tenantId ? 'occupied' : (data.status || 'vacant');

    const unit = await db.propertyUnit.create({
      data: {
        propertyId: data.propertyId,
        unitNumber: data.unitNumber,
        floor: data.floor || 1,
        area: data.area || null,
        baseRentTTD: data.baseRentTTD || 0,
        baseRentUSD: data.baseRentUSD || 0,
        tenantId: data.tenantId || null,
        status: unitStatus,
        amenities: typeof data.amenities === 'string' ? data.amenities : JSON.stringify(data.amenities || []),
        notes: data.notes || null,
      },
    });

    // If startDate and endDate provided, create a Lease
    if (data.tenantId && data.startDate && data.endDate) {
      await db.lease.create({
        data: {
          unitId: unit.id,
          tenantId: data.tenantId,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          rentAmount: data.rentAmount || data.baseRentTTD || 0,
          rentCurrency: data.rentCurrency || 'TTD',
          depositAmount: data.depositAmount || 0,
          status: 'active',
          terms: data.terms || null,
          notes: data.leaseNotes || null,
        },
      });
    }

    return NextResponse.json(unit);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update a property unit
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'PropertyUnit ID required' }, { status: 400 });
    }

    // If status changes to "vacant", clear tenantId
    const updateData: any = {};
    if (data.unitNumber !== undefined) updateData.unitNumber = data.unitNumber;
    if (data.floor !== undefined) updateData.floor = data.floor;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.baseRentTTD !== undefined) updateData.baseRentTTD = data.baseRentTTD;
    if (data.baseRentUSD !== undefined) updateData.baseRentUSD = data.baseRentUSD;
    if (data.amenities !== undefined) updateData.amenities = typeof data.amenities === 'string' ? data.amenities : JSON.stringify(data.amenities);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status === 'vacant') {
      updateData.status = 'vacant';
      updateData.tenantId = null;
    } else if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.tenantId !== undefined && data.status !== 'vacant') {
      updateData.tenantId = data.tenantId;
      if (data.tenantId) {
        updateData.status = 'occupied';
      }
    }

    let unit: any;
    try {
      unit = await db.propertyUnit.update({
        where: { id: data.id },
        data: updateData,
        include: { property: true, tenant: true },
      });
    } catch {
      // Fallback to Management API
      const setClauses: string[] = [`"updatedAt" = NOW()`];
      if (updateData.unitNumber !== undefined) setClauses.push(`"unitNumber" = '${updateData.unitNumber.replace(/'/g, "''")}'`);
      if (updateData.floor !== undefined) setClauses.push(`"floor" = ${updateData.floor}`);
      if (updateData.area !== undefined) setClauses.push(`"area" = ${updateData.area === null ? 'NULL' : updateData.area}`);
      if (updateData.baseRentTTD !== undefined) setClauses.push(`"baseRentTTD" = ${updateData.baseRentTTD}`);
      if (updateData.baseRentUSD !== undefined) setClauses.push(`"baseRentUSD" = ${updateData.baseRentUSD}`);
      if (updateData.status !== undefined) setClauses.push(`"status" = '${updateData.status}'`);
      if (updateData.tenantId !== undefined) setClauses.push(`"tenantId" = ${updateData.tenantId === null ? 'NULL' : `'${updateData.tenantId}'`}`);
      if (updateData.amenities !== undefined) setClauses.push(`"amenities" = '${updateData.amenities.replace(/'/g, "''")}'`);
      if (updateData.notes !== undefined) setClauses.push(`"notes" = ${updateData.notes === null ? 'NULL' : `'${updateData.notes.replace(/'/g, "''")}'`}`);

      const sql = `UPDATE "PropertyUnit" SET ${setClauses.join(', ')} WHERE id = '${data.id}' RETURNING *`;
      const rows = await pgQuery<any>(sql);
      unit = rows[0] || null;
    }

    if (!unit) {
      return NextResponse.json({ error: 'PropertyUnit not found' }, { status: 404 });
    }
    return NextResponse.json(unit);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a property unit
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'PropertyUnit ID required' }, { status: 400 });
    }

    const unit = await db.propertyUnit.findUnique({ where: { id: data.id } });
    if (!unit) {
      return NextResponse.json({ error: 'PropertyUnit not found' }, { status: 404 });
    }

    await db.lease.deleteMany({ where: { unitId: data.id } });
    await db.propertyUnit.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
