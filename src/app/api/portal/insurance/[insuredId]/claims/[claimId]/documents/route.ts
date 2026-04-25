import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeInsuranceInput } from '@/lib/insurance-security';
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ insuredId: string; claimId: string }> }) {
  const { insuredId, claimId } = await params;
  try {
    const formData = await req.formData();
    const token = formData.get('token') as string;
    const file = formData.get('file') as File;
    const category = formData.get('category') as string || 'other';
    const description = formData.get('description') as string;

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 });

    const access = await verifyPortalAccess(token, insuredId);
    if (!access) return NextResponse.json({ error: 'Access denied' }, { status: 401 });

    // Verify claim belongs to this insured's policy
    const policies = await db.policy.findMany({
      where: { insuredId, tenantId: access.tenantId, isDeleted: false },
      select: { id: true }
    });
    const claim = await db.claim.findFirst({
      where: { id: claimId, tenantId: access.tenantId, isDeleted: false, policyId: { in: policies.map((p: any) => p.id) } }
    });
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

    // Process file
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const fileUrl = `data:${file.type};base64,${base64}`;

    const doc = await db.claimDocument.create({
      data: {
        tenantId: access.tenantId,
        claimId,
        fileName: file.name,
        fileType: file.type.split('/').pop() || 'unknown',
        fileSize: file.size,
        fileUrl,
        category,
        description: description ? sanitizeInsuranceInput(description) : null,
        uploadedBy: `portal:${insuredId}`,
      }
    });

    await db.claimActivity.create({
      data: {
        tenantId: access.tenantId,
        claimId,
        action: 'document_uploaded',
        performedBy: `portal:${insuredId}`,
        description: `Document uploaded: ${file.name} (${category})`
      }
    });

    auditLogger.log({
      tenantId: access.tenantId,
      userId: `portal:${insuredId}`,
      action: 'document_upload',
      entityType: 'claim',
      entityId: claimId,
      metadata: { fileName: file.name, fileSize: file.size, category }
    });

    return NextResponse.json({ success: true, document: { id: doc.id, fileName: doc.fileName, category: doc.category } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
