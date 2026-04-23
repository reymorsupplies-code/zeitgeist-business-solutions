import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';
import { authenticateRequest } from '@/lib/auth';

// GET: List all leases with unit (with property) and tenant
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    let leases: any[] = [];
    try {
      leases = await db.lease.findMany({
        include: {
          unit: { include: { property: true } },
          tenant: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // Fallback to Management API — replicate the include/join structure
      const rows = await pgQuery<any>(
        `SELECT l.*,
           pu.id AS "unit_id", pu."unitNumber" AS "unit_unitNumber", pu.floor AS "unit_floor",
           pu.area AS "unit_area", pu."baseRentTTD" AS "unit_baseRentTTD", pu."baseRentUSD" AS "unit_baseRentUSD",
           pu."tenantId" AS "unit_tenantId", pu.status AS "unit_status",
           p.id AS "property_id", p.name AS "property_name", p.address AS "property_address",
           p.city AS "property_city", p.type AS "property_type",
           t.id AS "tenant_id", t.name AS "tenant_name", t.slug AS "tenant_slug",
           t.email AS "tenant_email", t.phone AS "tenant_phone", t.status AS "tenant_status"
         FROM "Lease" l
         LEFT JOIN "PropertyUnit" pu ON pu.id = l."unitId"
         LEFT JOIN "Property" p ON p.id = pu."propertyId"
         LEFT JOIN "Tenant" t ON t.id = l."tenantId"
         ORDER BY l."createdAt" DESC`
      );

      // Compose lease objects to match Prisma's include shape
      leases = rows.map((row: any) => ({
        id: row.id,
        unitId: row.unitId,
        tenantId: row.tenantId,
        startDate: row.startDate,
        endDate: row.endDate,
        rentAmount: row.rentAmount,
        rentCurrency: row.rentCurrency,
        depositAmount: row.depositAmount,
        status: row.status,
        terms: row.terms,
        notes: row.notes,
        autoRenew: row.autoRenew,
        renewalNoticeDays: row.renewalNoticeDays,
        rentIncreasePercent: row.rentIncreasePercent,
        lastRenewedAt: row.lastRenewedAt,
        renewalCount: row.renewalCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        unit: row.unit_id ? {
          id: row.unit_id,
          propertyId: row.propertyId || row.unit_propertyId,
          unitNumber: row.unit_unitNumber,
          floor: row.unit_floor,
          area: row.unit_area,
          baseRentTTD: row.unit_baseRentTTD,
          baseRentUSD: row.unit_baseRentUSD,
          tenantId: row.unit_tenantId,
          status: row.unit_status,
          property: row.property_id ? {
            id: row.property_id,
            name: row.property_name,
            address: row.property_address,
            city: row.property_city,
            type: row.property_type,
          } : null,
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
    return NextResponse.json(leases);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new lease
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();
    const lease = await db.lease.create({
      data: {
        unitId: data.unitId,
        tenantId: data.tenantId || null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        rentAmount: data.rentAmount || 0,
        rentCurrency: data.rentCurrency || 'TTD',
        depositAmount: data.depositAmount || 0,
        status: data.status || 'active',
        terms: data.terms || null,
        notes: data.notes || null,
        autoRenew: data.autoRenew || false,
        renewalNoticeDays: data.renewalNoticeDays || 30,
        rentIncreasePercent: data.rentIncreasePercent || 0,
      },
    });

    // Update the PropertyUnit status to "occupied" and set tenantId if provided
    if (data.tenantId) {
      await db.propertyUnit.update({
        where: { id: data.unitId },
        data: { status: 'occupied', tenantId: data.tenantId },
      });
    }

    return NextResponse.json(lease);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update a lease
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Lease ID required' }, { status: 400 });
    }

    let lease: any;
    try {
      lease = await db.lease.update({
        where: { id: data.id },
        data: {
          ...(data.tenantId !== undefined && { tenantId: data.tenantId }),
          ...(data.startDate && { startDate: new Date(data.startDate) }),
          ...(data.endDate && { endDate: new Date(data.endDate) }),
          ...(data.rentAmount !== undefined && { rentAmount: data.rentAmount }),
          ...(data.rentCurrency && { rentCurrency: data.rentCurrency }),
          ...(data.depositAmount !== undefined && { depositAmount: data.depositAmount }),
          ...(data.status && { status: data.status }),
          ...(data.terms !== undefined && { terms: data.terms }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.autoRenew !== undefined && { autoRenew: data.autoRenew }),
          ...(data.renewalNoticeDays !== undefined && { renewalNoticeDays: data.renewalNoticeDays }),
          ...(data.rentIncreasePercent !== undefined && { rentIncreasePercent: data.rentIncreasePercent }),
        },
        include: {
          unit: { include: { property: true } },
          tenant: true,
        },
      });
    } catch {
      // Fallback to Management API — parameterized query to prevent SQL injection
      const setClauses: string[] = [`"updatedAt" = NOW()`];
      const params: any[] = [];
      let pIdx = 1;
      if (data.tenantId !== undefined) {
        if (data.tenantId === null) { setClauses.push(`"tenantId" = NULL`); }
        else { setClauses.push(`"tenantId" = $${pIdx++}`); params.push(data.tenantId); }
      }
      if (data.startDate !== undefined) { setClauses.push(`"startDate" = $${pIdx++}`); params.push(new Date(data.startDate).toISOString()); }
      if (data.endDate !== undefined) { setClauses.push(`"endDate" = $${pIdx++}`); params.push(new Date(data.endDate).toISOString()); }
      if (data.rentAmount !== undefined) { setClauses.push(`"rentAmount" = $${pIdx++}`); params.push(data.rentAmount); }
      if (data.rentCurrency !== undefined) { setClauses.push(`"rentCurrency" = $${pIdx++}`); params.push(data.rentCurrency); }
      if (data.depositAmount !== undefined) { setClauses.push(`"depositAmount" = $${pIdx++}`); params.push(data.depositAmount); }
      if (data.status !== undefined) { setClauses.push(`"status" = $${pIdx++}`); params.push(data.status); }
      if (data.terms !== undefined) {
        if (data.terms === null) { setClauses.push(`"terms" = NULL`); }
        else { setClauses.push(`"terms" = $${pIdx++}`); params.push(data.terms); }
      }
      if (data.notes !== undefined) {
        if (data.notes === null) { setClauses.push(`"notes" = NULL`); }
        else { setClauses.push(`"notes" = $${pIdx++}`); params.push(data.notes); }
      }

      const sql = `UPDATE "Lease" SET ${setClauses.join(', ')} WHERE id = $${pIdx++}`;
      params.push(data.id);
      const rows = await pgQuery<any>(sql, params);
      lease = rows[0] || null;
    }

    if (!lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }
    return NextResponse.json(lease);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a lease
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Lease ID required' }, { status: 400 });
    }

    const lease = await db.lease.findUnique({ where: { id: data.id } });
    if (!lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    await db.lease.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
