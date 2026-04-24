import { NextRequest, NextResponse } from 'next/server';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: Public view of application status (no auth required) ─────────────
// Returns basic application info — NO screening notes or internal data.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;

  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
  }

  try {
    const application = await pgQueryOne<any>(
      `SELECT
        id, status, "createdAt", "updatedAt",
        "firstName", "lastName", email,
        "propertyId", "unitId",
        "desiredMoveInDate", "leaseTermPreference", "hasPets",
        "screeningScore", "riskLevel",
        "reviewedAt",
        "rejectionReason",
        "hasPets", "petDescription",
        "numberOfOccupants",
        -- Document availability flags (not URLs, for privacy)
        CASE WHEN "idDocumentUrl" IS NOT NULL THEN true ELSE false END AS "hasIdDocument",
        CASE WHEN "incomeProofUrl" IS NOT NULL THEN true ELSE false END AS "hasIncomeProof",
        CASE WHEN "employmentLetterUrl" IS NOT NULL THEN true ELSE false END AS "hasEmploymentLetter"
       FROM "TenantApplication"
       WHERE id = $1`,
      [applicationId]
    );

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json(application);
  } catch (error: any) {
    console.error('[Public Application GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch application' }, { status: 500 });
  }
}

// ─── POST: Applicant submits supporting documents ───────────────────────────
// Accepts FormData with files: idDocument, incomeProof, employmentLetter
// Converts files to base64 and stores in the application record.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;

  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
  }

  try {
    // Verify the application exists
    const existing = await pgQueryOne<any>(
      `SELECT id, status, email FROM "TenantApplication" WHERE id = $1`,
      [applicationId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Can only upload documents if application is pending or reviewing
    if (!['pending', 'reviewing'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot upload documents for application with status: ${existing.status}` },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const updates: string[] = [];
    const updateParams: any[] = [];
    let pIdx = 1;

    // Process each file field
    const fileFields = [
      { key: 'idDocument', column: 'idDocumentUrl' },
      { key: 'incomeProof', column: 'incomeProofUrl' },
      { key: 'employmentLetter', column: 'employmentLetterUrl' },
    ];

    for (const field of fileFields) {
      const file = formData.get(field.key) as File | null;
      if (file && file.size > 0) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: `${field.key}: File too large. Maximum size is 10MB.` },
            { status: 400 }
          );
        }

        // Validate file type
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (!allowedTypes.includes(file.type)) {
          return NextResponse.json(
            { error: `${field.key}: Unsupported file type ${file.type}. Use PDF, JPEG, PNG, or WebP.` },
            { status: 400 }
          );
        }

        // Convert to base64 data URL for storage
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${file.type};base64,${base64}`;

        updates.push(`"${field.column}" = $${pIdx++}`);
        updateParams.push(dataUrl);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No files provided. Use fields: idDocument, incomeProof, employmentLetter' }, { status: 400 });
    }

    // Update the application
    updateParams.push(applicationId);
    const sql = `UPDATE "TenantApplication"
      SET ${updates.join(', ')}, "updatedAt" = NOW()
      WHERE id = $${pIdx}
      RETURNING
        id, status,
        CASE WHEN "idDocumentUrl" IS NOT NULL THEN true ELSE false END AS "hasIdDocument",
        CASE WHEN "incomeProofUrl" IS NOT NULL THEN true ELSE false END AS "hasIncomeProof",
        CASE WHEN "employmentLetterUrl" IS NOT NULL THEN true ELSE false END AS "hasEmploymentLetter"`;

    const rows = await pgQuery<any>(sql, updateParams);
    const result = rows[0] || null;

    // Re-calculate screening score since documents changed
    // Fetch full application for recalculation
    const fullApp = await pgQueryOne<any>(
      `SELECT * FROM "TenantApplication" WHERE id = $1`,
      [applicationId]
    );

    if (fullApp) {
      // Get rent amount from unit if available
      let rentAmount: number | null = null;
      if (fullApp.unitId) {
        const unit = await pgQueryOne<{ baseRentTTD: string }>(
          `SELECT "baseRentTTD" FROM "PropertyUnit" WHERE id = $1`,
          [fullApp.unitId]
        );
        if (unit) rentAmount = parseFloat(unit.baseRentTTD) || null;
      }

      const { calculateScreeningScore } = await import('@/lib/screening-scorer');
      const screening = calculateScreeningScore({
        monthlyIncome: fullApp.monthlyIncome,
        rentAmount,
        employmentLength: fullApp.employmentLength,
        reference1Name: fullApp.reference1Name,
        reference2Name: fullApp.reference2Name,
        idDocumentUrl: fullApp.idDocumentUrl,
        incomeProofUrl: fullApp.incomeProofUrl,
        employmentLetterUrl: fullApp.employmentLetterUrl,
        previousAddress: fullApp.previousAddress,
      });

      // Update the score
      await pgQuery(
        `UPDATE "TenantApplication"
         SET "screeningScore" = $1, "riskLevel" = $2, "screeningNotes" = $3, "updatedAt" = NOW()
         WHERE id = $4`,
        [screening.score, screening.riskLevel, JSON.stringify(screening.breakdown), applicationId]
      );

      return NextResponse.json({
        ...result,
        screening,
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Public Application POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to upload documents' }, { status: 500 });
  }
}

// ─── PUT: Applicant withdraws their application ────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;

  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
  }

  try {
    const body = await req.json();

    // Only allow withdrawal
    if (body.status !== 'withdrawn') {
      return NextResponse.json(
        { error: 'Applicants can only withdraw applications. Set status to "withdrawn".' },
        { status: 400 }
      );
    }

    // Verify the application exists and is in a withdrawable state
    const existing = await pgQueryOne<any>(
      `SELECT id, status, email FROM "TenantApplication" WHERE id = $1`,
      [applicationId]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (!['pending', 'reviewing', 'waitlisted'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot withdraw application with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Optional: verify the requester is the applicant via email
    if (body.email && body.email.toLowerCase() !== existing.email.toLowerCase()) {
      return NextResponse.json({ error: 'Email does not match application' }, { status: 403 });
    }

    // Update status
    const rows = await pgQuery<any>(
      `UPDATE "TenantApplication"
       SET status = 'withdrawn', "updatedAt" = NOW(), "reviewedAt" = NOW()
       WHERE id = $1
       RETURNING id, status, "updatedAt"`,
      [applicationId]
    );

    const application = rows[0] || null;

    return NextResponse.json({
      application,
      message: 'Application withdrawn successfully',
    });
  } catch (error: any) {
    console.error('[Public Application PUT]', error);
    return NextResponse.json({ error: error.message || 'Failed to update application' }, { status: 500 });
  }
}
