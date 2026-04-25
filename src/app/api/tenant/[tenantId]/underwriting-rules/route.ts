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
    const category = searchParams.get('productCategory');

    const where: any = { tenantId, isDeleted: false, isActive: true };
    if (category && category !== 'all') where.productCategory = category;

    const rules = await db.underwritingRule.findMany({
      where,
      orderBy: { priority: 'asc' }
    });
    return NextResponse.json(rules);
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
    const { name, description, productCategory, ruleType, field, operator, value, valueTo, action, actionValue, priority } = data;
    if (!name || !field || !operator) return NextResponse.json({ error: 'name, field, and operator are required' }, { status: 400 });

    const rule = await db.underwritingRule.create({
      data: {
        tenantId,
        name: sanitizeInsuranceInput(name),
        description: description ? sanitizeInsuranceInput(description) : null,
        productCategory: productCategory || 'all',
        ruleType: ruleType || 'threshold',
        field,
        operator: operator || 'gt',
        value: String(value),
        valueTo: valueTo ? String(valueTo) : null,
        action: action || 'refer',
        actionValue: actionValue || null,
        priority: priority || 100,
      }
    });

    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'create',
      entityType: 'underwriting_rule',
      entityId: rule.id,
      metadata: { name, field, operator, action }
    });

    return NextResponse.json(rule, { status: 201 });
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
    const { id, ...updateData } = data;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    if (updateData.name) updateData.name = sanitizeInsuranceInput(updateData.name);
    if (updateData.description) updateData.description = sanitizeInsuranceInput(updateData.description);

    const rule = await db.underwritingRule.update({ where: { id, tenantId }, data: updateData });
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'update',
      entityType: 'underwriting_rule',
      entityId: id,
      metadata: { updatedFields: Object.keys(updateData) }
    });
    return NextResponse.json(rule);
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
    await db.underwritingRule.update({ where: { id: data.id, tenantId }, data: { isDeleted: true } });
    auditLogger.log({
      tenantId,
      userId: auth.payload?.userId || auth.payload?.email || 'system',
      action: 'delete',
      entityType: 'underwriting_rule',
      entityId: data.id,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
