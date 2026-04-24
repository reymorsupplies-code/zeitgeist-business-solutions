import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, validateRequiredFields } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { calculateScreeningScore, ScreeningResult } from '@/lib/screening-scorer';

// ─── GET: List applications with filters + status counts ────────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    const status = searchParams.get('status') || null;
    const propertyId = searchParams.get('propertyId') || null;
    const unitId = searchParams.get('unitId') || null;
    const search = searchParams.get('search') || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clause
    const conditions: string[] = [`"tenantId" = $1`];
    const queryParams: any[] = [tenantId];
    let paramIdx = 2;

    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      queryParams.push(status);
    }
    if (propertyId) {
      conditions.push(`"propertyId" = $${paramIdx++}`);
      queryParams.push(propertyId);
    }
    if (unitId) {
      conditions.push(`"unitId" = $${paramIdx++}`);
      queryParams.push(unitId);
    }
    if (search) {
      conditions.push(`(
        "firstName" ILIKE $${paramIdx}
        OR "lastName" ILIKE $${paramIdx}
        OR email ILIKE $${paramIdx}
      )`);
      queryParams.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // Fetch applications
    const applications = await pgQuery<any>(
      `SELECT * FROM "TenantApplication"
       WHERE ${whereClause}
       ORDER BY "createdAt" DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...queryParams, limit, offset]
    );

    // Fetch total count
    const countResult = await pgQueryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "TenantApplication" WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult?.count || '0');

    // Fetch status counts for dashboard badges
    const statusCounts = await pgQuery<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
       FROM "TenantApplication"
       WHERE "tenantId" = $1
       GROUP BY status`,
      [tenantId]
    );

    const counts: Record<string, number> = {
      pending: 0,
      reviewing: 0,
      approved: 0,
      rejected: 0,
      withdrawn: 0,
      waitlisted: 0,
      total,
    };
    for (const row of statusCounts) {
      counts[row.status] = parseInt(row.count);
    }

    return NextResponse.json({
      applications,
      pagination: { page, limit, offset, total },
      counts,
    });
  } catch (error: any) {
    console.error('[Applications GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch applications' }, { status: 500 });
  }
}

// ─── POST: Create new application (landlord or self-submit) ─────────────────
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
    const body = await req.json();

    // Validate required fields
    const missing = validateRequiredFields(body, [
      'firstName', 'lastName', 'email',
    ]);
    if (missing) {
      return NextResponse.json({ error: `Missing required field: ${missing}` }, { status: 400 });
    }

    // Look up rent amount from unit if unitId provided
    let rentAmount: number | null = body.rentAmount || null;
    if (body.unitId && !rentAmount) {
      try {
        const unit = await db.propertyUnit.findUnique({
          where: { id: body.unitId },
          select: { baseRentTTD: true, baseRentUSD: true },
        });
        if (unit) {
          // Use TTD by default, fall back to USD
          rentAmount = parseFloat(unit.baseRentTTD.toString()) || parseFloat(unit.baseRentUSD.toString()) || null;
        }
      } catch {
        // If Prisma fails, try pgQuery
        const unit = await pgQueryOne<{ baseRentTTD: string }>(
          `SELECT "baseRentTTD" FROM "PropertyUnit" WHERE id = $1`,
          [body.unitId]
        );
        if (unit) rentAmount = parseFloat(unit.baseRentTTD) || null;
      }
    }

    // Calculate screening score
    const screening = calculateScreeningScore({
      monthlyIncome: body.monthlyIncome,
      rentAmount,
      employmentLength: body.employmentLength,
      reference1Name: body.reference1Name,
      reference2Name: body.reference2Name,
      idDocumentUrl: body.idDocumentUrl,
      incomeProofUrl: body.incomeProofUrl,
      employmentLetterUrl: body.employmentLetterUrl,
      previousAddress: body.previousAddress,
    });

    // Generate application ID
    const { v4: uuid } = await import('uuid');
    const applicationId = uuid();

    // Insert via pgQuery
    const rows = await pgQuery<any>(
      `INSERT INTO "TenantApplication" (
        id, "tenantId", "propertyId", "unitId", status,
        "firstName", "lastName", email, phone, "dateOfBirth", "nationalId",
        employer, "jobTitle", "monthlyIncome", "employmentLength",
        "previousAddress", "previousLandlordName", "previousLandlordPhone", "reasonForLeaving",
        "reference1Name", "reference1Phone", "reference1Email",
        "reference2Name", "reference2Phone", "reference2Email",
        "screeningScore", "riskLevel", "screeningNotes",
        "idDocumentUrl", "incomeProofUrl", "employmentLetterUrl",
        "desiredMoveInDate", "leaseTermPreference", "numberOfOccupants",
        "hasPets", "petDescription", notes
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22,
        $23, $24, $25,
        $26, $27, $28,
        $29, $30, $31,
        $32, $33, $34,
        $35, $36, $37
      ) RETURNING *`,
      [
        applicationId, tenantId, body.propertyId || null, body.unitId || null, 'pending',
        body.firstName.trim(), body.lastName.trim(), body.email.toLowerCase().trim(), body.phone?.trim() || null,
        body.dateOfBirth ? new Date(body.dateOfBirth).toISOString() : null,
        body.nationalId?.trim() || null,
        body.employer?.trim() || null, body.jobTitle?.trim() || null,
        body.monthlyIncome ? parseFloat(body.monthlyIncome) : null,
        body.employmentLength?.trim() || null,
        body.previousAddress?.trim() || null, body.previousLandlordName?.trim() || null,
        body.previousLandlordPhone?.trim() || null, body.reasonForLeaving?.trim() || null,
        body.reference1Name?.trim() || null, body.reference1Phone?.trim() || null,
        body.reference1Email?.trim() || null,
        body.reference2Name?.trim() || null, body.reference2Phone?.trim() || null,
        body.reference2Email?.trim() || null,
        screening.score, screening.riskLevel,
        JSON.stringify(screening.breakdown) as any,
        body.idDocumentUrl?.trim() || null, body.incomeProofUrl?.trim() || null,
        body.employmentLetterUrl?.trim() || null,
        body.desiredMoveInDate ? new Date(body.desiredMoveInDate).toISOString() : null,
        body.leaseTermPreference || null,
        body.numberOfOccupants || null,
        body.hasPets === true, body.petDescription?.trim() || null,
        body.notes?.trim() || null,
      ]
    );

    const application = rows[0] || null;

    return NextResponse.json({
      application,
      screening,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Applications POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to create application' }, { status: 500 });
  }
}

// ─── PUT: Update application status / approve with auto-create Renter+Lease ─
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
    const body = await req.json();

    if (!body.applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
    }

    // Verify the application belongs to this tenant
    const existing = await pgQueryOne<any>(
      `SELECT * FROM "TenantApplication" WHERE id = $1 AND "tenantId" = $2`,
      [body.applicationId, tenantId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const validStatuses = ['pending', 'reviewing', 'approved', 'rejected', 'withdrawn', 'waitlisted'];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Build SET clauses
    const setClauses: string[] = [`"updatedAt" = NOW()`];
    const queryParams: any[] = [];
    let pIdx = 1;

    if (body.status) {
      setClauses.push(`status = $${pIdx++}`);
      queryParams.push(body.status);
    }
    if (body.rejectionReason !== undefined) {
      setClauses.push(`"rejectionReason" = $${pIdx++}`);
      queryParams.push(body.rejectionReason);
    }
    if (body.notes !== undefined) {
      setClauses.push(`notes = $${pIdx++}`);
      queryParams.push(body.notes);
    }
    if (body.screeningNotes !== undefined) {
      setClauses.push(`"screeningNotes" = $${pIdx++}`);
      queryParams.push(body.screeningNotes);
    }
    if (body.backgroundCheckStatus) {
      setClauses.push(`"backgroundCheckStatus" = $${pIdx++}`);
      queryParams.push(body.backgroundCheckStatus);
    }

    // When status changes, record reviewer info
    if (body.status && body.status !== existing.status) {
      setClauses.push(`"reviewedBy" = $${pIdx++}`);
      queryParams.push(auth.payload?.userId || null);
      setClauses.push(`"reviewedAt" = NOW()`);
    }

    // WHERE clause
    queryParams.push(body.applicationId, tenantId);
    const sql = `UPDATE "TenantApplication"
      SET ${setClauses.join(', ')}
      WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}
      RETURNING *`;

    const rows = await pgQuery<any>(sql, queryParams);
    const application = rows[0] || null;

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // ─── Auto-create Renter + Lease when approving ───
    let renter: any = null;
    let lease: any = null;

    if (body.status === 'approved' && body.createRenter) {
      if (!body.unitId) {
        return NextResponse.json({
          error: 'unitId is required when createRenter is true',
          application,
        }, { status: 400 });
      }

      // Verify unit exists and belongs to this tenant's property
      try {
        const unit = await db.propertyUnit.findUnique({
          where: { id: body.unitId },
          include: { property: true },
        });
        if (!unit || unit.property?.tenantId !== tenantId) {
          return NextResponse.json({ error: 'Unit not found or access denied' }, { status: 404 });
        }
      } catch {
        const unit = await pgQueryOne<{ id: string }>(
          `SELECT pu.id FROM "PropertyUnit" pu
           JOIN "Property" p ON p.id = pu."propertyId"
           WHERE pu.id = $1 AND p."tenantId" = $2`,
          [body.unitId, tenantId]
        );
        if (!unit) {
          return NextResponse.json({ error: 'Unit not found or access denied' }, { status: 404 });
        }
      }

      const { v4: uuid } = await import('uuid');
      const crypto = await import('crypto');

      // Generate a random 6-digit PIN
      const randomPin = String(Math.floor(100000 + Math.random() * 900000));
      const hashedPin = crypto.createHash('sha256').update(randomPin).digest('hex');

      // Create Renter
      try {
        renter = await db.renter.create({
          data: {
            id: uuid(),
            tenantId,
            fullName: `${application.firstName} ${application.lastName}`.trim(),
            email: application.email,
            phone: application.phone || null,
            idDocument: application.nationalId || application.idDocumentUrl || null,
            unitId: body.unitId,
            propertyId: body.propertyId || existing.propertyId || null,
            pin: hashedPin,
            status: 'active',
          },
        });
      } catch (prismaErr) {
        // Fallback via pgQuery
        const renterRows = await pgQuery<any>(
          `INSERT INTO "Renter" (id, "tenantId", "fullName", email, phone, "idDocument", "unitId", "propertyId", pin, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
           RETURNING *`,
          [
            uuid(), tenantId, `${application.firstName} ${application.lastName}`.trim(),
            application.email, application.phone || null,
            application.nationalId || application.idDocumentUrl || null,
            body.unitId, body.propertyId || existing.propertyId || null, hashedPin,
          ]
        );
        renter = renterRows[0] || null;
      }

      // Create Lease
      if (body.leaseStartDate && body.leaseEndDate) {
        try {
          lease = await db.lease.create({
            data: {
              unitId: body.unitId,
              tenantId,
              startDate: new Date(body.leaseStartDate),
              endDate: new Date(body.leaseEndDate),
              rentAmount: body.rentAmount || existing.monthlyIncome || 0,
              rentCurrency: body.rentCurrency || 'TTD',
              depositAmount: body.depositAmount || 0,
              status: 'active',
              notes: `Created from application ${application.id}`,
            },
          });

          // Update unit status to occupied
          await db.propertyUnit.update({
            where: { id: body.unitId },
            data: { status: 'occupied' },
          });
        } catch {
          const leaseRows = await pgQuery<any>(
            `INSERT INTO "Lease" ("unitId", "tenantId", "startDate", "endDate", "rentAmount", "rentCurrency", "depositAmount", status, notes)
             VALUES ($1, $2, $3, $4, $5, 'TTD', $6, 'active', $7)
             RETURNING *`,
            [
              body.unitId, tenantId,
              new Date(body.leaseStartDate).toISOString(),
              new Date(body.leaseEndDate).toISOString(),
              body.rentAmount || 0,
              body.depositAmount || 0,
              `Created from application ${application.id}`,
            ]
          );
          lease = leaseRows[0] || null;

          // Update unit status
          await pgQuery(
            `UPDATE "PropertyUnit" SET status = 'occupied', "updatedAt" = NOW() WHERE id = $1`,
            [body.unitId]
          );
        }

        // Link the renter to the lease if both created
        if (renter && lease) {
          try {
            await db.renter.update({
              where: { id: renter.id },
              data: { leaseId: lease.id },
            });
          } catch {
            await pgQuery(
              `UPDATE "Renter" SET "leaseId" = $1, "updatedAt" = NOW() WHERE id = $2`,
              [lease.id, renter.id]
            );
          }
        }
      }

      // Update application with linked data
      await pgQuery(
        `UPDATE "TenantApplication" SET "updatedAt" = NOW() WHERE id = $1`,
        [application.id]
      );

      // Return renter WITHOUT the hashed pin
      if (renter) {
        const { pin: _, ...safeRenter } = renter as any;
        renter = { ...safeRenter, _pinSet: true, _generatedPin: randomPin };
      }
    }

    return NextResponse.json({
      application,
      renter,
      lease,
    });
  } catch (error: any) {
    console.error('[Applications PUT]', error);
    return NextResponse.json({ error: error.message || 'Failed to update application' }, { status: 500 });
  }
}
