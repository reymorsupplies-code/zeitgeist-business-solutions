import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { encryptPII, decryptPII, sanitizeInsuranceInput, isValidTTNationalId } from '@/lib/insurance-security';
import { auditLogger } from '@/lib/insurance-audit';

export async function GET(req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
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
    const action = searchParams.get('action');
    const search = searchParams.get('search');

    if (action === 'summary') {
      const all = await db.insured.findMany({ where: { tenantId, isDeleted: false } });
      const active = all.filter((i: any) => i.isActive);
      const withPolicies = all.filter((i: any) => {
        return db.policy.count({ where: { insuredId: i.id, tenantId, isDeleted: false } });
      });
      // Use a lighter approach: just count via id check
      const withPoliciesIds = new Set<string>();
      const policyInsuredLinks = await db.policy.findMany({
        where: { tenantId, isDeleted: false, insuredId: { not: null } },
        select: { insuredId: true },
        distinct: ['insuredId'],
      });
      policyInsuredLinks.forEach((p: any) => { if (p.insuredId) withPoliciesIds.add(p.insuredId); });

      return NextResponse.json({
        totalInsured: all.length,
        activeInsured: active.length,
        withPolicies: withPoliciesIds.size,
      });
    }

    const whereClause: any = { tenantId, isDeleted: false };

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await db.insured.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } });

    // Decrypt PII fields before returning
    const decryptedItems = items.map((item: any) => ({
      ...item,
      nationalId: item.nationalId ? decryptPII(item.nationalId) : null,
      dateOfBirth: item.dateOfBirth ? decryptPII(item.dateOfBirth) : null,
    }));

    return NextResponse.json(decryptedItems);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
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

    // Validate national ID format for Trinidad & Tobago
    if (data.nationalId && !isValidTTNationalId(data.nationalId)) {
      return NextResponse.json(
        { error: 'Invalid national ID format. Expected 8 digits.' },
        { status: 400 }
      );
    }

    // Sanitize free-text fields
    if (data.notes) data.notes = sanitizeInsuranceInput(data.notes);
    if (data.address) data.address = sanitizeInsuranceInput(data.address);
    if (data.occupation) data.occupation = sanitizeInsuranceInput(data.occupation);
    if (data.employer) data.employer = sanitizeInsuranceInput(data.employer);

    // Encrypt PII fields before saving
    if (data.nationalId) data.nationalId = encryptPII(data.nationalId);
    if (data.dateOfBirth) data.dateOfBirth = encryptPII(data.dateOfBirth);

    const item = await db.insured.create({ data: { ...data, tenantId } });

    // Log audit entry
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'create',
      entityType: 'insured',
      entityId: item.id,
      metadata: { firstName: data.firstName, lastName: data.lastName },
    });

    // Return with decrypted PII
    return NextResponse.json({
      ...item,
      nationalId: item.nationalId ? decryptPII(item.nationalId) : null,
      dateOfBirth: item.dateOfBirth ? decryptPII(item.dateOfBirth) : null,
    });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { id, tenantId: _, ...updateData } = data;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Validate national ID format if being updated
    if (updateData.nationalId && !isValidTTNationalId(updateData.nationalId)) {
      return NextResponse.json(
        { error: 'Invalid national ID format. Expected 8 digits.' },
        { status: 400 }
      );
    }

    // Sanitize free-text fields
    if (updateData.notes) updateData.notes = sanitizeInsuranceInput(updateData.notes);
    if (updateData.address) updateData.address = sanitizeInsuranceInput(updateData.address);
    if (updateData.occupation) updateData.occupation = sanitizeInsuranceInput(updateData.occupation);
    if (updateData.employer) updateData.employer = sanitizeInsuranceInput(updateData.employer);

    // Encrypt PII fields before saving
    if (updateData.nationalId) updateData.nationalId = encryptPII(updateData.nationalId);
    if (updateData.dateOfBirth) updateData.dateOfBirth = encryptPII(updateData.dateOfBirth);

    const item = await db.insured.update({ where: { id, tenantId }, data: updateData });

    // Log audit entry
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'update',
      entityType: 'insured',
      entityId: id,
      changes: Object.keys(updateData).reduce((acc: Record<string, { old: any; new: any }>, key) => {
        acc[key] = { old: '[previous]', new: '[updated]' };
        return acc;
      }, {}),
    });

    // Return with decrypted PII
    return NextResponse.json({
      ...item,
      nationalId: item.nationalId ? decryptPII(item.nationalId) : null,
      dateOfBirth: item.dateOfBirth ? decryptPII(item.dateOfBirth) : null,
    });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Fetch insured info for audit trail before soft-delete
    const existing = await db.insured.findUnique({ where: { id: data.id, tenantId } });
    await db.insured.update({ where: { id: data.id, tenantId }, data: { isDeleted: true } });

    // Log audit entry
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'delete',
      entityType: 'insured',
      entityId: data.id,
      metadata: {
        firstName: (existing as any)?.firstName,
        lastName: (existing as any)?.lastName,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
