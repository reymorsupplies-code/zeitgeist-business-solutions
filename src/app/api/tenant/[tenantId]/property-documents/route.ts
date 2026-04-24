import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: List property documents scoped to tenant ───
// Supports query params: ?propertyId=xxx&type=lease_agreement&leaseId=xxx
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
    const type = url.searchParams.get('type');
    const leaseId = url.searchParams.get('leaseId');

    try {
      // PropertyDocument has tenantId field - use it directly for filtering
      const where: Record<string, unknown> = { tenantId };
      if (propertyId) where.propertyId = propertyId;
      if (type) where.type = type;
      if (leaseId) where.leaseId = leaseId;

      const documents = await db.propertyDocument.findMany({
        where,
        include: {
          property: { select: { id: true, name: true, address: true } },
          unit: { select: { id: true, unitNumber: true } },
          lease: { select: { id: true, startDate: true, endDate: true, status: true } },
          tenant: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(documents);
    } catch {
      // Fallback: filter via property tenantId relation
      let sql = `SELECT pd.*,
                        p.name AS "propertyName", p.address AS "propertyAddress",
                        pu."unitNumber" AS "unitUnitNumber",
                        l."startDate" AS "leaseStartDate", l."endDate" AS "leaseEndDate", l.status AS "leaseStatus",
                        t.name AS "tenantName"
                 FROM "PropertyDocument" pd
                 LEFT JOIN "Property" p ON p.id = pd."propertyId"
                 LEFT JOIN "PropertyUnit" pu ON pu.id = pd."unitId"
                 LEFT JOIN "Lease" l ON l.id = pd."leaseId"
                 LEFT JOIN "Tenant" t ON t.id = pd."tenantId"
                 WHERE pd."tenantId" = $1`;
      const queryParams: any[] = [tenantId];
      let paramIdx = 2;

      if (propertyId) {
        sql += ` AND pd."propertyId" = $${paramIdx++}`;
        queryParams.push(propertyId);
      }
      if (type) {
        sql += ` AND pd.type = $${paramIdx++}`;
        queryParams.push(type);
      }
      if (leaseId) {
        sql += ` AND pd."leaseId" = $${paramIdx++}`;
        queryParams.push(leaseId);
      }

      sql += ` ORDER BY pd."createdAt" DESC`;
      const documents = await pgQuery<any>(sql, queryParams);
      return NextResponse.json(documents);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create property document ───
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
      return NextResponse.json({ error: 'Document name is required' }, { status: 400 });
    }

    // Verify propertyId belongs to this tenant if provided
    if (data.propertyId) {
      try {
        const prop = await db.property.findFirst({
          where: { id: data.propertyId, tenantId },
        });
        if (!prop) {
          return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 });
        }
      } catch {
        const prop = await pgQueryOne(
          `SELECT id FROM "Property" WHERE id = $1 AND "tenantId" = $2`,
          [data.propertyId, tenantId]
        );
        if (!prop) {
          return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 });
        }
      }
    }

    try {
      const document = await db.propertyDocument.create({
        data: {
          tenantId,
          propertyId: data.propertyId || null,
          unitId: data.unitId || null,
          leaseId: data.leaseId || null,
          name: data.name.trim(),
          type: data.type || 'other',
          category: data.category || null,
          fileUrl: data.fileUrl || null,
          description: data.description || null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          status: data.status || 'active',
        },
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
          lease: { select: { id: true, status: true } },
          tenant: { select: { id: true, name: true } },
        },
      });
      return NextResponse.json(document, { status: 201 });
    } catch {
      const result = await pgQuery<any>(
        `INSERT INTO "PropertyDocument" (
          "tenantId", "propertyId", "unitId", "leaseId", name, type, category,
          "fileUrl", description, "expiresAt", status, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
        [
          tenantId,
          data.propertyId || null,
          data.unitId || null,
          data.leaseId || null,
          data.name.trim(),
          data.type || 'other',
          data.category || null,
          data.fileUrl || null,
          data.description || null,
          data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
          data.status || 'active',
        ]
      );
      return NextResponse.json(result[0], { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PATCH: Update property document ───
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
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Verify document's property (or direct tenantId) belongs to this tenant
    try {
      const existing = await db.propertyDocument.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
      }

      const allowedFields = [
        'propertyId', 'unitId', 'leaseId', 'name', 'type', 'category',
        'fileUrl', 'description', 'expiresAt', 'status',
      ];

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (fields[field] !== undefined) {
          if (field === 'expiresAt' && fields[field]) {
            updateData[field] = new Date(fields[field]);
          } else {
            updateData[field] = fields[field];
          }
        }
      }

      const updated = await db.propertyDocument.update({
        where: { id },
        data: updateData,
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
          lease: { select: { id: true, status: true } },
          tenant: { select: { id: true, name: true } },
        },
      });
      return NextResponse.json(updated);
    } catch {
      const existing = await pgQueryOne(
        `SELECT id FROM "PropertyDocument" WHERE id = $1 AND "tenantId" = $2`,
        [id, tenantId]
      );
      if (!existing) {
        return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
      }

      const allowedFields = [
        'propertyId', 'unitId', 'leaseId', 'name', 'type', 'category',
        'fileUrl', 'description', 'expiresAt', 'status',
      ];

      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;

      for (const field of allowedFields) {
        if (fields[field] !== undefined) {
          setParts.push(`"${field}" = $${pIdx++}`);
          if (field === 'expiresAt' && fields[field]) {
            paramValues.push(new Date(fields[field]).toISOString());
          } else {
            paramValues.push(fields[field]);
          }
        }
      }

      if (setParts.length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
      }

      setParts.push(`"updatedAt" = NOW()`);
      paramValues.push(id);

      const sql = `UPDATE "PropertyDocument" SET ${setParts.join(', ')} WHERE id = $${pIdx}`;
      await pgQuery(sql, paramValues);

      const updated = await pgQueryOne(
        `SELECT pd.*,
                p.name AS "propertyName",
                pu."unitNumber" AS "unitUnitNumber",
                l.status AS "leaseStatus",
                t.name AS "tenantName"
         FROM "PropertyDocument" pd
         LEFT JOIN "Property" p ON p.id = pd."propertyId"
         LEFT JOIN "PropertyUnit" pu ON pu.id = pd."unitId"
         LEFT JOIN "Lease" l ON l.id = pd."leaseId"
         LEFT JOIN "Tenant" t ON t.id = pd."tenantId"
         WHERE pd.id = $1`,
        [id]
      );
      return NextResponse.json(updated);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Delete property document ───
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
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    try {
      const existing = await db.propertyDocument.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
      }

      await db.propertyDocument.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch {
      const existing = await pgQueryOne(
        `SELECT id FROM "PropertyDocument" WHERE id = $1 AND "tenantId" = $2`,
        [id, tenantId]
      );
      if (!existing) {
        return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
      }

      await pgQuery(`DELETE FROM "PropertyDocument" WHERE id = $1`, [id]);
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
