import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

export async function GET() {
  try {
    let plans: any[] = [];
    try {
      plans = await db.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    } catch {
      // Fallback to Management API
      plans = await pgQuery<any>(
        `SELECT * FROM "Plan" ORDER BY "sortOrder" ASC`
      );
    }
    return NextResponse.json(plans);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const plan = await db.plan.create({
      data: {
        name: data.name,
        slug,
        tier: data.tier || 'custom',
        priceUSD: data.priceUSD || 0,
        priceTTD: data.priceTTD || 0,
        currency: data.currency || 'TTD',
        billingCycle: data.billingCycle || 'monthly',
        tagline: data.tagline,
        description: data.description,
        idealFor: data.idealFor,
        maxUsers: data.maxUsers || 3,
        maxBranches: data.maxBranches || 1,
        features: typeof data.features === 'string' ? data.features : JSON.stringify(data.features || []),
        excludedFeatures: typeof data.excludedFeatures === 'string' ? data.excludedFeatures : JSON.stringify(data.excludedFeatures || []),
        isPopular: data.isPopular || false,
        status: data.status || 'active',
        sortOrder: data.sortOrder || 0,
      }
    });
    return NextResponse.json(plan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Plan ID required' }, { status: 400 });
    }

    let plan: any;
    try {
      plan = await db.plan.update({
        where: { id: data.id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.priceUSD !== undefined && { priceUSD: data.priceUSD }),
          ...(data.priceTTD !== undefined && { priceTTD: data.priceTTD }),
          ...(data.tagline !== undefined && { tagline: data.tagline }),
          ...(data.maxUsers !== undefined && { maxUsers: data.maxUsers }),
          ...(data.maxBranches !== undefined && { maxBranches: data.maxBranches }),
          ...(data.features !== undefined && { features: typeof data.features === 'string' ? data.features : JSON.stringify(data.features) }),
          ...(data.isPopular !== undefined && { isPopular: data.isPopular }),
        }
      });
    } catch {
      // Fallback to Management API
      const setClauses: string[] = [`"updatedAt" = NOW()`];
      if (data.name !== undefined) setClauses.push(`"name" = '${data.name.replace(/'/g, "''")}'`);
      if (data.priceUSD !== undefined) setClauses.push(`"priceUSD" = ${data.priceUSD}`);
      if (data.priceTTD !== undefined) setClauses.push(`"priceTTD" = ${data.priceTTD}`);
      if (data.tagline !== undefined) setClauses.push(`"tagline" = ${data.tagline === null ? 'NULL' : `'${data.tagline.replace(/'/g, "''")}'`}`);
      if (data.maxUsers !== undefined) setClauses.push(`"maxUsers" = ${data.maxUsers}`);
      if (data.maxBranches !== undefined) setClauses.push(`"maxBranches" = ${data.maxBranches}`);
      if (data.features !== undefined) {
        const featuresStr = typeof data.features === 'string' ? data.features : JSON.stringify(data.features);
        setClauses.push(`"features" = '${featuresStr.replace(/'/g, "''")}'`);
      }
      if (data.isPopular !== undefined) setClauses.push(`"isPopular" = ${data.isPopular}`);

      const sql = `UPDATE "Plan" SET ${setClauses.join(', ')} WHERE id = '${data.id}' RETURNING *`;
      const rows = await pgQuery<any>(sql);
      plan = rows[0] || null;
    }

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
