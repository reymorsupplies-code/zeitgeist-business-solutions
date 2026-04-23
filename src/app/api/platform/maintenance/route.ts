import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';
import { authenticateRequest } from '@/lib/auth';

// GET: List all maintenance requests with property, unit, and tenant
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    let requests: any[] = [];
    try {
      requests = await db.maintenanceRequest.findMany({
        include: { property: true, unit: true, tenant: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // Fallback to Management API — replicate the include/join structure
      const rows = await pgQuery<any>(
        `SELECT mr.*,
           p.id AS "property_id", p.name AS "property_name", p.address AS "property_address",
           p.city AS "property_city", p.country AS "property_country", p.type AS "property_type",
           p.status AS "property_status",
           pu.id AS "unit_id", pu."unitNumber" AS "unit_unitNumber", pu.floor AS "unit_floor",
           pu.status AS "unit_status",
           t.id AS "tenant_id", t.name AS "tenant_name", t.slug AS "tenant_slug",
           t.email AS "tenant_email", t.phone AS "tenant_phone", t.status AS "tenant_status"
         FROM "MaintenanceRequest" mr
         LEFT JOIN "Property" p ON p.id = mr."propertyId"
         LEFT JOIN "PropertyUnit" pu ON pu.id = mr."unitId"
         LEFT JOIN "Tenant" t ON t.id = mr."tenantId"
         ORDER BY mr."createdAt" DESC`
      );

      // Compose request objects to match Prisma's include shape
      requests = rows.map((row: any) => ({
        id: row.id,
        propertyId: row.propertyId,
        unitId: row.unitId,
        tenantId: row.tenantId,
        title: row.title,
        description: row.description,
        category: row.category,
        priority: row.priority,
        status: row.status,
        requestedAt: row.requestedAt,
        resolvedAt: row.resolvedAt,
        cost: row.cost,
        vendor: row.vendor,
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
          status: row.property_status,
        } : null,
        unit: row.unit_id ? {
          id: row.unit_id,
          unitNumber: row.unit_unitNumber,
          floor: row.unit_floor,
          status: row.unit_status,
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
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new maintenance request
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();
    const request = await db.maintenanceRequest.create({
      data: {
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        tenantId: data.tenantId || null,
        title: data.title,
        description: data.description || null,
        category: data.category || null,
        priority: data.priority || 'medium',
        status: data.status || 'open',
        requestedAt: data.requestedAt ? new Date(data.requestedAt) : new Date(),
        resolvedAt: null,
        cost: data.cost || 0,
        vendor: data.vendor || null,
        notes: data.notes || null,
      },
    });
    return NextResponse.json(request);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update a maintenance request
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'MaintenanceRequest ID required' }, { status: 400 });
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.cost !== undefined) updateData.cost = data.cost;
    if (data.vendor !== undefined) updateData.vendor = data.vendor;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // If status changes to "resolved" or "closed", set resolvedAt to now()
    if (data.status === 'resolved' || data.status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    let request: any;
    try {
      request = await db.maintenanceRequest.update({
        where: { id: data.id },
        data: updateData,
        include: { property: true, unit: true, tenant: true },
      });
    } catch {
      // Fallback to Management API
      const setClauses: string[] = [`"updatedAt" = NOW()`];
      if (data.title !== undefined) setClauses.push(`"title" = '${data.title.replace(/'/g, "''")}'`);
      if (data.description !== undefined) setClauses.push(`"description" = ${data.description === null ? 'NULL' : `'${data.description.replace(/'/g, "''")}'`}`);
      if (data.category !== undefined) setClauses.push(`"category" = ${data.category === null ? 'NULL' : `'${data.category}'`}`);
      if (data.priority !== undefined) setClauses.push(`"priority" = '${data.priority}'`);
      if (data.status !== undefined) setClauses.push(`"status" = '${data.status}'`);
      if (data.cost !== undefined) setClauses.push(`"cost" = ${data.cost}`);
      if (data.vendor !== undefined) setClauses.push(`"vendor" = ${data.vendor === null ? 'NULL' : `'${data.vendor.replace(/'/g, "''")}'`}`);
      if (data.notes !== undefined) setClauses.push(`"notes" = ${data.notes === null ? 'NULL' : `'${data.notes.replace(/'/g, "''")}'`}`);
      if (updateData.resolvedAt) setClauses.push(`"resolvedAt" = NOW()`);

      const sql = `UPDATE "MaintenanceRequest" SET ${setClauses.join(', ')} WHERE id = '${data.id}' RETURNING *`;
      const rows = await pgQuery<any>(sql);
      request = rows[0] || null;
    }

    if (!request) {
      return NextResponse.json({ error: 'MaintenanceRequest not found' }, { status: 404 });
    }
    return NextResponse.json(request);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a maintenance request
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'MaintenanceRequest ID required' }, { status: 400 });
    }

    const request = await db.maintenanceRequest.findUnique({ where: { id: data.id } });
    if (!request) {
      return NextResponse.json({ error: 'MaintenanceRequest not found' }, { status: 404 });
    }

    await db.maintenanceRequest.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
