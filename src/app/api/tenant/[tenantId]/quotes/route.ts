import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

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

    if (action === 'summary') {
      const all = await db.quote.findMany({ where: { tenantId, isDeleted: false } });
      const byStatus: Record<string, number> = {};
      all.forEach((q: any) => {
        const s = q.status || 'draft';
        byStatus[s] = (byStatus[s] || 0) + 1;
      });
      return NextResponse.json({
        totalQuotes: all.length,
        byStatus,
      });
    }

    const items = await db.quote.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: { quoteLines: true, product: { select: { id: true, name: true, category: true } } },
    });
    return NextResponse.json(items);
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
    const item = await db.quote.create({ data: { ...data, tenantId } });
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

    if (action === 'convert' && id) {
      // Convert quote to policy
      const quote = await db.quote.findUnique({ where: { id, tenantId }, include: { quoteLines: true } });
      if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
      if (quote.status === 'converted') return NextResponse.json({ error: 'Quote already converted' }, { status: 400 });

      const policy = await db.policy.create({
        data: {
          tenantId,
          clientName: quote.insuredName || '',
          premium: quote.quotedPremium,
          coverage: quote.quotedCoverage,
          excessAmount: quote.excessAmount,
          deductibleAmount: quote.deductibleAmount,
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          productId: quote.productId,
          notes: `Converted from quote ${quote.quoteNumber || id}`,
        },
      });

      await db.quote.update({ where: { id }, data: { status: 'converted', convertedToPolicyId: policy.id } });

      return NextResponse.json({ policy, quote: { id: quote.id, status: 'converted', convertedToPolicyId: policy.id } });
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const item = await db.quote.update({ where: { id, tenantId }, data: updateData });
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
    await db.quote.update({ where: { id: data.id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
