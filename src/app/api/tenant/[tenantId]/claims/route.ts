import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth';
import { db } from '@/lib/db';
import { sanitizeInsuranceInput, isValidAmount } from '@/lib/insurance-security';
import { auditLogger } from '@/lib/insurance-audit';

export async function GET(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
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

    if (action === 'summary') {
      const all = await db.claim.findMany({ where: { tenantId, isDeleted: false } });
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      all.forEach((c: any) => {
        const s = c.status || 'submitted';
        byStatus[s] = (byStatus[s] || 0) + 1;
        const p = c.priority || 'medium';
        byPriority[p] = (byPriority[p] || 0) + 1;
      });
      const avgProcessingDays = (() => {
        const settled = all.filter((c: any) => c.status === 'settled' && c.dateReported && c.dateSettled);
        if (settled.length === 0) return 0;
        return Math.round(settled.reduce((sum: number, c: any) => {
          return sum + (new Date(c.dateSettled).getTime() - new Date(c.dateReported).getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / settled.length);
      })();
      return NextResponse.json({
        totalClaims: all.length,
        byStatus,
        byPriority,
        avgProcessingDays,
      });
    }

    if (action === 'kanban') {
      const all = await db.claim.findMany({
        where: { tenantId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
      // Group by status columns
      const columns: Record<string, any[]> = {
        submitted: [],
        acknowledged: [],
        under_review: [],
        assessment: [],
        approved: [],
        denied: [],
        partially_settled: [],
        settled: [],
        closed: [],
      };
      all.forEach((c: any) => {
        const col = c.status || 'submitted';
        if (columns[col]) {
          columns[col].push(c);
        } else {
          columns['submitted'].push(c);
        }
      });
      return NextResponse.json({ columns });
    }

    const items = await db.claim.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(items);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(req: NextRequest, {params}: { params: Promise<{ tenantId: string }> }) {
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

    // Validate claim amount
    if (data.amount !== undefined && !isValidAmount(data.amount)) {
      return NextResponse.json(
        { error: 'Invalid claim amount. Must be between 0 and 100,000,000.' },
        { status: 400 }
      );
    }

    // Validate reserve amount
    if (data.reserveAmount !== undefined && !isValidAmount(data.reserveAmount)) {
      return NextResponse.json(
        { error: 'Invalid reserve amount. Must be between 0 and 100,000,000.' },
        { status: 400 }
      );
    }

    // Sanitize free-text fields
    if (data.description) data.description = sanitizeInsuranceInput(data.description);
    if (data.location) data.location = sanitizeInsuranceInput(data.location);
    if (data.denialReason) data.denialReason = sanitizeInsuranceInput(data.denialReason);
    if (data.settlementNotes) data.settlementNotes = sanitizeInsuranceInput(data.settlementNotes);
    if (data.notes) data.notes = sanitizeInsuranceInput(data.notes);

    const item = await db.claim.create({ data: { ...data, tenantId } });

    // Log audit entry for claim creation
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'create',
      entityType: 'claim',
      entityId: item.id,
      metadata: {
        claimNumber: data.claimNumber,
        amount: data.amount,
        type: data.type,
      },
    });

    return NextResponse.json(item);
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
    const { id, tenantId: _, action, ...updateData } = data;

    if (action === 'update-status' && id) {
      const { status, ...remainingData } = updateData;
      if (!status) return NextResponse.json({ error: 'Status is required for update-status action' }, { status: 400 });

      const existing = await db.claim.findUnique({ where: { id, tenantId } });
      if (!existing) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

      const oldStatus = existing.status;

      // Sanitize any free-text fields in the update
      if (remainingData.denialReason) remainingData.denialReason = sanitizeInsuranceInput(remainingData.denialReason);
      if (remainingData.settlementNotes) remainingData.settlementNotes = sanitizeInsuranceInput(remainingData.settlementNotes);
      if (remainingData.notes) remainingData.notes = sanitizeInsuranceInput(remainingData.notes);

      // Validate amounts if being updated
      if (remainingData.amount !== undefined && !isValidAmount(remainingData.amount)) {
        return NextResponse.json(
          { error: 'Invalid claim amount. Must be between 0 and 100,000,000.' },
          { status: 400 }
        );
      }
      if (remainingData.reserveAmount !== undefined && !isValidAmount(remainingData.reserveAmount)) {
        return NextResponse.json(
          { error: 'Invalid reserve amount. Must be between 0 and 100,000,000.' },
          { status: 400 }
        );
      }

      const updatedClaim = await db.claim.update({
        where: { id, tenantId },
        data: {
          ...remainingData,
          status,
          ...(status === 'acknowledged' ? { dateAcknowledged: new Date() } : {}),
          ...(status === 'assessment' ? { dateAssessed: new Date() } : {}),
          ...(status === 'settled' || status === 'partially_settled' ? { dateSettled: new Date() } : {}),
        },
      });

      // Auto-create ClaimActivity entry
      await db.claimActivity.create({
        data: {
          tenantId,
          claimId: id,
          action: 'status_changed',
          performedBy: auth.payload?.userId || auth.payload?.email || 'system',
          description: `Status changed from "${oldStatus}" to "${status}"`,
          metadata: JSON.stringify({ oldStatus, newStatus: status }),
        },
      });

      // Log audit entry for status change
      auditLogger.log({
        tenantId,
        userId: auth.payload?.userId || auth.payload?.email || 'system',
        action: 'status_change',
        entityType: 'claim',
        entityId: id,
        changes: {
          status: { old: oldStatus, new: status },
        },
        metadata: { claimNumber: (existing as any).claimNumber },
      });

      return NextResponse.json(updatedClaim);
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Sanitize free-text fields on general update
    if (updateData.description) updateData.description = sanitizeInsuranceInput(updateData.description);
    if (updateData.location) updateData.location = sanitizeInsuranceInput(updateData.location);
    if (updateData.denialReason) updateData.denialReason = sanitizeInsuranceInput(updateData.denialReason);
    if (updateData.settlementNotes) updateData.settlementNotes = sanitizeInsuranceInput(updateData.settlementNotes);
    if (updateData.notes) updateData.notes = sanitizeInsuranceInput(updateData.notes);

    // Validate amounts if being updated
    if (updateData.amount !== undefined && !isValidAmount(updateData.amount)) {
      return NextResponse.json(
        { error: 'Invalid claim amount. Must be between 0 and 100,000,000.' },
        { status: 400 }
      );
    }
    if (updateData.reserveAmount !== undefined && !isValidAmount(updateData.reserveAmount)) {
      return NextResponse.json(
        { error: 'Invalid reserve amount. Must be between 0 and 100,000,000.' },
        { status: 400 }
      );
    }

    const item = await db.claim.update({ where: { id, tenantId }, data: updateData });

    // Log audit entry for general update
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'update',
      entityType: 'claim',
      entityId: id,
      changes: Object.keys(updateData).reduce((acc: Record<string, { old: any; new: any }>, key) => {
        acc[key] = { old: '[previous]', new: '[updated]' };
        return acc;
      }, {}),
    });

    return NextResponse.json(item);
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

    // Fetch claim info for audit trail before soft-delete
    const existing = await db.claim.findUnique({ where: { id: data.id, tenantId } });
    await db.claim.update({ where: { id: data.id, tenantId }, data: { isDeleted: true } });

    // Log audit entry for deletion
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'delete',
      entityType: 'claim',
      entityId: data.id,
      metadata: {
        claimNumber: (existing as any)?.claimNumber,
        amount: (existing as any)?.amount,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
