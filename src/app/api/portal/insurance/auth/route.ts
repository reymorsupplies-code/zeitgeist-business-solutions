import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptPII, maskNationalId, maskDateOfBirth } from '@/lib/insurance-security';
import { auditLogger } from '@/lib/insurance-audit';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

    // Find active, non-expired token
    const portalToken = await db.portalToken.findFirst({
      where: {
        token,
        isActive: true,
        isDeleted: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        insured: {
          where: { isDeleted: false, isActive: true }
        }
      }
    });

    if (!portalToken || !portalToken.insured) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Check usage limits
    if (portalToken.maxUses > 0 && portalToken.useCount >= portalToken.maxUses) {
      return NextResponse.json({ error: 'Token usage limit exceeded' }, { status: 401 });
    }

    // Update usage tracking
    await db.portalToken.update({
      where: { id: portalToken.id },
      data: {
        lastUsedAt: new Date(),
        useCount: { increment: 1 }
      }
    });

    const insured = portalToken.insured;

    auditLogger.log({
      tenantId: portalToken.tenantId,
      userId: 'portal:' + insured.id,
      action: 'portal_login',
      entityType: 'insured',
      entityId: insured.id,
      metadata: { tokenPurpose: portalToken.purpose }
    });

    return NextResponse.json({
      authenticated: true,
      insuredId: insured.id,
      tenantId: portalToken.tenantId,
      insured: {
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
        gender: insured.gender,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
