import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

// ─── T&T Legal Notice Templates (shared with platform route) ───
const TANDT_NOTICE_TYPES = ['rent_increase', 'lease_renewal', 'lease_termination', 'eviction', 'late_payment', 'vacate_notice'] as const;
const TANDT_NOTICE_DAYS: Record<string, number> = {
  rent_increase: 30, lease_renewal: 30, lease_termination: 28, eviction: 28, late_payment: 7, vacate_notice: 28,
};

const TANDT_DEFAULT_SUBJECTS: Record<string, string> = {
  rent_increase: 'Notice of Rent Increase',
  lease_renewal: 'Notice of Lease Renewal',
  lease_termination: 'Notice of Lease Termination',
  eviction: 'Notice of Intended Eviction Proceedings',
  late_payment: 'Reminder: Overdue Rent Payment',
  vacate_notice: 'Move-Out Instructions and Vacate Notice',
};

// ─── GET: List notices for this tenant ───
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(_req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(_req.url);
    const leaseId = searchParams.get('leaseId');
    const propertyId = searchParams.get('propertyId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    const where: any = { tenantId };
    if (leaseId) where.leaseId = leaseId;
    if (propertyId) where.propertyId = propertyId;
    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;

    const notices = await db.legalNotice.findMany({
      where,
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true, unit: true, tenant: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notices);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── POST: Create notice from template or auto-generate ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();
    const { leaseId, propertyId, unitId, type, content, effectiveDate, generate } = body;

    // Auto-generate notices for expiring leases
    if (generate === true) {
      return handleAutoGenerate(tenantId, req);
    }

    if (!type || !TANDT_NOTICE_TYPES.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Valid: ${TANDT_NOTICE_TYPES.join(', ')}` }, { status: 400 });
    }

    // Verify property ownership if propertyId provided
    if (propertyId) {
      const prop = await db.property.findUnique({ where: { id: propertyId } });
      if (!prop || prop.tenantId !== tenantId) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
    }

    // Verify lease ownership if leaseId provided
    if (leaseId) {
      const lease = await db.lease.findUnique({
        where: { id: leaseId },
        include: { unit: { include: { property: true } }, tenant: true },
      });
      if (!lease || lease.unit?.property?.tenantId !== tenantId) {
        return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
      }
    }

    const noticeDays = TANDT_NOTICE_DAYS[type] || 28;
    const issuedDate = new Date();
    const effective = effectiveDate ? new Date(effectiveDate) : issuedDate;
    const expiry = new Date(issuedDate);
    expiry.setDate(expiry.getDate() + noticeDays);

    const notice = await db.legalNotice.create({
      data: {
        leaseId: leaseId || null,
        propertyId: propertyId || null,
        unitId: unitId || null,
        tenantId,
        type,
        status: 'draft',
        jurisdiction: 'TT',
        title: body.title || TANDT_DEFAULT_SUBJECTS[type] || type,
        content: content || `Legal notice type: ${type}`,
        templateSlug: type,
        effectiveDate: effective,
        expiresAt: expiry,
        sentMethod: body.sentMethod || null,
      },
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true, unit: true, tenant: true,
      },
    });

    return NextResponse.json(notice, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── Auto-generate notices for leases expiring within notice period ───
async function handleAutoGenerate(tenantId: string, req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const daysAhead = Number(searchParams.get('daysAhead')) || 60;
  const noticeType = searchParams.get('noticeType') || 'lease_renewal';

  if (!TANDT_NOTICE_TYPES.includes(noticeType as any)) {
    return NextResponse.json({ error: `Invalid notice type: ${noticeType}` }, { status: 400 });
  }

  const noticeDays = TANDT_NOTICE_DAYS[noticeType] || 28;
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() + noticeDays);
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + daysAhead);

  // Find expiring leases scoped to this tenant via unit -> property
  const expiringLeases = await db.lease.findMany({
    where: {
      status: 'active',
      endDate: { gte: windowStart, lte: windowEnd },
      unit: { property: { tenantId } },
    },
    include: { unit: { include: { property: true } }, tenant: true },
  });

  // Check for existing notices
  const existingNotices = await db.legalNotice.findMany({
    where: {
      type: noticeType,
      status: { in: ['draft', 'sent', 'acknowledged'] },
      leaseId: { in: expiringLeases.map((l) => l.id) },
    },
    select: { leaseId: true },
  });
  const existingLeaseIds = new Set(existingNotices.map((n) => n.leaseId));
  const leasesNeedingNotice = expiringLeases.filter((l) => !existingLeaseIds.has(l.id));

  const generatedNotices: any[] = [];
  for (const lease of leasesNeedingNotice) {
    const expiry = new Date(lease.endDate);
    expiry.setDate(expiry.getDate() - noticeDays);

    const notice = await db.legalNotice.create({
      data: {
        leaseId: lease.id,
        propertyId: lease.unit?.propertyId || '',
        unitId: lease.unitId,
        tenantId,
        type: noticeType,
        status: 'draft',
        jurisdiction: 'TT',
        title: TANDT_DEFAULT_SUBJECTS[noticeType] || noticeType,
        content: `Auto-generated ${noticeType.replace(/_/g, ' ')} notice for lease ending ${lease.endDate.toLocaleDateString()}. Property: ${lease.unit?.property?.name || 'N/A'}, Unit: ${lease.unit?.unitNumber || 'N/A'}.`,
        templateSlug: noticeType,
        effectiveDate: now,
        expiresAt: expiry,
      },
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true, unit: true, tenant: true,
      },
    });
    generatedNotices.push(notice);
  }

  return NextResponse.json({
    generated: generatedNotices.length,
    skipped: existingLeaseIds.size,
    totalChecked: expiringLeases.length,
    notices: generatedNotices,
  }, { status: 201 });
}

// ─── PATCH: Update notice status ───
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.legalNotice.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Legal notice not found' }, { status: 404 });
    }

    const body = await req.json();
    const data: any = {};

    const validStatuses = ['draft', 'sent', 'acknowledged', 'disputed', 'resolved', 'expired'];
    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
      }
      data.status = body.status;
      if (body.status === 'sent' && !existing.sentDate) data.sentDate = new Date();
    }

    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) data.content = body.content;
    if (body.sentMethod !== undefined) data.sentMethod = body.sentMethod;
    if (body.responseNotes !== undefined) data.responseNotes = body.responseNotes;
    if (body.responseDate !== undefined) data.responseDate = body.responseDate ? new Date(body.responseDate) : null;
    if (body.effectiveDate !== undefined) data.effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const notice = await db.legalNotice.update({
      where: { id },
      data,
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true, unit: true, tenant: true,
      },
    });

    return NextResponse.json(notice);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── DELETE: Delete notice ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.legalNotice.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Legal notice not found' }, { status: 404 });
    }

    await db.legalNotice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
