import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptPII, maskNationalId, maskDateOfBirth, sanitizeInsuranceInput } from '@/lib/insurance-security';
import { auditLogger } from '@/lib/insurance-audit';

async function verifyPortalAccess(token: string, insuredId: string) {
  const portalToken = await db.portalToken.findFirst({
    where: {
      token, insuredId, isActive: true, isDeleted: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }
  });
  if (!portalToken) return null;
  return portalToken;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ insuredId: string }> }) {
  const { insuredId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const access = await verifyPortalAccess(token, insuredId);
    if (!access) return NextResponse.json({ error: 'Access denied' }, { status: 401 });

    const insured = await db.insured.findUnique({
      where: { id: insuredId, tenantId: access.tenantId, isDeleted: false }
    });
    if (!insured) return NextResponse.json({ error: 'Insured not found' }, { status: 404 });

    return NextResponse.json({
      id: insured.id,
      firstName: insured.firstName,
      lastName: insured.lastName,
      email: insured.email,
      phone: insured.phone,
      nationalId: insured.nationalId ? maskNationalId(decryptPII(insured.nationalId)) : null,
      dateOfBirth: insured.dateOfBirth ? maskDateOfBirth(decryptPII(insured.dateOfBirth)) : null,
      address: insured.address,
      city: insured.city,
      occupation: insured.occupation,
      employer: insured.employer,
      gender: insured.gender,
      idType: insured.idType,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ insuredId: string }> }) {
  const { insuredId } = await params;
  try {
    const data = await req.json();
    const { token } = data;
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const access = await verifyPortalAccess(token, insuredId);
    if (!access) return NextResponse.json({ error: 'Access denied' }, { status: 401 });

    // Only allow updating contact info fields (NOT nationalId or DOB)
    const allowedFields = ['email', 'phone', 'address', 'city', 'occupation', 'employer'];
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = typeof data[field] === 'string' ? sanitizeInsuranceInput(data[field]) : data[field];
      }
    }

    const insured = await db.insured.update({
      where: { id: insuredId, tenantId: access.tenantId },
      data: updateData
    });

    auditLogger.log({
      tenantId: access.tenantId,
      userId: `portal:${insuredId}`,
      action: 'update',
      entityType: 'insured',
      entityId: insuredId,
      changes: Object.keys(updateData).reduce((acc: any, key) => {
        acc[key] = { old: '[previous]', new: '[updated]' };
        return acc;
      }, {}),
      metadata: { source: 'portal' }
    });

    return NextResponse.json({ success: true, updatedFields: Object.keys(updateData) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
