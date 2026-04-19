import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import pg from 'pg';

export async function GET() {
  try {
    let plans: any[] = [];
    try {
      plans = await db.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    } catch {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      const result = await pool.query(`SELECT * FROM "Plan" ORDER BY "sortOrder" ASC`);
      plans = result.rows;
      await pool.end();
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

    // Validate ID format early
    if (!/^[a-zA-Z0-9_-]+$/.test(data.id)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
    }

    let plan: any;
    try {
      plan = await db.plan.update({
        where: { id: data.id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.priceUSD !== undefined && { priceUSD: Number(data.priceUSD) }),
          ...(data.priceTTD !== undefined && { priceTTD: Number(data.priceTTD) }),
          ...(data.tagline !== undefined && { tagline: data.tagline }),
          ...(data.maxUsers !== undefined && { maxUsers: Number(data.maxUsers) }),
          ...(data.maxBranches !== undefined && { maxBranches: Number(data.maxBranches) }),
          ...(data.features !== undefined && { features: typeof data.features === 'string' ? data.features : JSON.stringify(data.features) }),
          ...(data.isPopular !== undefined && { isPopular: Boolean(data.isPopular) }),
        }
      });
    } catch {
      // Fallback: parameterized query (no string interpolation)
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      const setClauses: string[] = [`"updatedAt" = NOW()`];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        setClauses.push(`"name" = $${paramIndex++}`);
        params.push(String(data.name));
      }
      if (data.priceUSD !== undefined) {
        setClauses.push(`"priceUSD" = $${paramIndex++}`);
        params.push(Number(data.priceUSD));
      }
      if (data.priceTTD !== undefined) {
        setClauses.push(`"priceTTD" = $${paramIndex++}`);
        params.push(Number(data.priceTTD));
      }
      if (data.tagline !== undefined) {
        setClauses.push(`"tagline" = $${paramIndex++}`);
        params.push(data.tagline === null ? null : String(data.tagline));
      }
      if (data.maxUsers !== undefined) {
        setClauses.push(`"maxUsers" = $${paramIndex++}`);
        params.push(Number(data.maxUsers));
      }
      if (data.maxBranches !== undefined) {
        setClauses.push(`"maxBranches" = $${paramIndex++}`);
        params.push(Number(data.maxBranches));
      }
      if (data.features !== undefined) {
        const featuresStr = typeof data.features === 'string' ? data.features : JSON.stringify(data.features);
        setClauses.push(`"features" = $${paramIndex++}`);
        params.push(featuresStr);
      }
      if (data.isPopular !== undefined) {
        setClauses.push(`"isPopular" = $${paramIndex++}`);
        params.push(Boolean(data.isPopular));
      }

      params.push(data.id);
      const sql = `UPDATE "Plan" SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await pool.query(sql, params);
      plan = result.rows[0] || null;
      await pool.end();
    }

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
