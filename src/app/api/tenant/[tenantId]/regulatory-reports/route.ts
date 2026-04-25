import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { sanitizeInsuranceInput } from '@/lib/insurance-security';
import { auditLogger } from '@/lib/insurance-audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('reportType');
    const where: any = { tenantId, isDeleted: false };
    if (reportType) where.reportType = reportType;

    const reports = await db.regulatoryReport.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(reports);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { reportType, periodStart, periodEnd, data: reportData, notes } = data;
    if (!reportType) return NextResponse.json({ error: 'reportType is required' }, { status: 400 });

    const validTypes = ['quarterly_statistical', 'annual_returns', 'claims_register', 'solvency', 'premium_register'];
    if (!validTypes.includes(reportType)) {
      return NextResponse.json({ error: `Invalid reportType. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Auto-generate report data based on type
    let generatedData = reportData || {};
    if (!reportData || Object.keys(reportData).length === 0) {
      const now = new Date();
      const qStart = periodStart || new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const qEnd = periodEnd || new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59);

      const [policyCount, claimCount, premiumCollected] = await Promise.all([
        db.policy.count({ where: { tenantId, isDeleted: false, status: 'active' } }),
        db.claim.count({ where: { tenantId, isDeleted: false, createdAt: { gte: qStart, lte: qEnd } } }),
        db.premiumSchedule.aggregate({
          where: { tenantId, isDeleted: false, paidDate: { gte: qStart, lte: qEnd } },
          _sum: { paidAmount: true }
        }),
      ]);

      generatedData = {
        generatedAt: now.toISOString(),
        periodStart: qStart.toISOString(),
        periodEnd: qEnd.toISOString(),
        activePolicies: policyCount,
        claimsThisPeriod: claimCount,
        premiumCollected: Number(premiumCollected._sum.paidAmount || 0),
      };
    }

    const report = await db.regulatoryReport.create({
      data: {
        tenantId,
        reportType,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        data: JSON.stringify(generatedData),
        notes: notes ? sanitizeInsuranceInput(notes) : null,
      }
    });

    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'create',
      entityType: 'regulatory_report',
      entityId: report.id,
      metadata: { reportType }
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { id, status, submittedTo, notes, data: reportData } = data;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const updateData: any = {};
    if (status) updateData.status = status;
    if (submittedTo) updateData.submittedTo = submittedTo;
    if (notes !== undefined) updateData.notes = sanitizeInsuranceInput(notes);
    if (reportData) updateData.data = JSON.stringify(reportData);
    if (status === 'submitted') {
      updateData.submittedAt = new Date();
      updateData.submittedBy = auth.payload?.userId || auth.payload?.email || 'system';
    }

    const report = await db.regulatoryReport.update({ where: { id, tenantId }, data: updateData });
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'update',
      entityType: 'regulatory_report',
      entityId: id,
      metadata: { status }
    });
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.regulatoryReport.update({ where: { id: data.id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
