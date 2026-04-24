import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

// GET: List all maintenance requests for this tenant (filtered by property -> tenantId)
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
    let requests: any[] = [];
    try {
      requests = await db.maintenanceRequest.findMany({
        where: { property: { tenantId } },
        include: { property: true, unit: true, tenant: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // Fallback to pgQuery — replicate the include/join structure
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
         WHERE p."tenantId" = $1
         ORDER BY mr."createdAt" DESC`,
        [tenantId]
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

// POST: Create a new maintenance request (verify property belongs to this tenant)
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

    // Verify the property belongs to this tenant
    const property = await db.property.findUnique({ where: { id: data.propertyId } });
    if (!property || property.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 });
    }

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

// PUT: Update a maintenance request (verify ownership via property, handle resolvedAt)
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
      return NextResponse.json({ error: 'MaintenanceRequest ID required' }, { status: 400 });
    }

    // Verify the request's property belongs to this tenant
    const existing = await db.maintenanceRequest.findUnique({
      where: { id: data.id },
      include: { property: true },
    });
    if (!existing || !existing.property || existing.property.tenantId !== tenantId) {
      return NextResponse.json({ error: 'MaintenanceRequest not found' }, { status: 404 });
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
      // Fallback to pgQuery — parameterized query to prevent SQL injection
      const setClauses: string[] = [`"updatedAt" = NOW()`];
      const params: any[] = [];
      let pIdx = 1;
      if (data.title !== undefined) { setClauses.push(`"title" = $${pIdx++}`); params.push(data.title); }
      if (data.description !== undefined) {
        if (data.description === null) { setClauses.push(`"description" = NULL`); }
        else { setClauses.push(`"description" = $${pIdx++}`); params.push(data.description); }
      }
      if (data.category !== undefined) {
        if (data.category === null) { setClauses.push(`"category" = NULL`); }
        else { setClauses.push(`"category" = $${pIdx++}`); params.push(data.category); }
      }
      if (data.priority !== undefined) { setClauses.push(`"priority" = $${pIdx++}`); params.push(data.priority); }
      if (data.status !== undefined) { setClauses.push(`"status" = $${pIdx++}`); params.push(data.status); }
      if (data.cost !== undefined) { setClauses.push(`"cost" = $${pIdx++}`); params.push(data.cost); }
      if (data.vendor !== undefined) {
        if (data.vendor === null) { setClauses.push(`"vendor" = NULL`); }
        else { setClauses.push(`"vendor" = $${pIdx++}`); params.push(data.vendor); }
      }
      if (data.notes !== undefined) {
        if (data.notes === null) { setClauses.push(`"notes" = NULL`); }
        else { setClauses.push(`"notes" = $${pIdx++}`); params.push(data.notes); }
      }
      if (updateData.resolvedAt) setClauses.push(`"resolvedAt" = NOW()`);

      // WHERE includes tenantId via property join for ownership verification
      const sql = `UPDATE "MaintenanceRequest" mr SET ${setClauses.join(', ')}
        FROM "Property" p
        WHERE mr.id = $${pIdx++} AND mr."propertyId" = p.id AND p."tenantId" = $${pIdx}
        RETURNING mr.*`;
      params.push(data.id, tenantId);
      const rows = await pgQuery<any>(sql, params);
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

// DELETE: Delete a maintenance request (verify ownership via property)
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
      return NextResponse.json({ error: 'MaintenanceRequest ID required' }, { status: 400 });
    }

    // Verify the request's property belongs to this tenant
    const request = await db.maintenanceRequest.findUnique({
      where: { id: data.id },
      include: { property: true },
    });
    if (!request || !request.property || request.property.tenantId !== tenantId) {
      return NextResponse.json({ error: 'MaintenanceRequest not found' }, { status: 404 });
    }

    await db.maintenanceRequest.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
