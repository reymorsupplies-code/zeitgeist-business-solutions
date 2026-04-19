import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';

export async function GET() {
  try {
    let industries: any[] = [];
    try {
      industries = await db.industry.findMany({ orderBy: { sortOrder: 'asc' } });
    } catch {
      // Fallback: direct pg query (parameterized, safe)
      industries = await pgQuery<any>(`SELECT * FROM "Industry" ORDER BY "sortOrder" ASC`);
    }
    return NextResponse.json(industries);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const industry = await db.industry.create({
      data: {
        name: data.name,
        slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: data.description,
        icon: data.icon,
        color: data.color,
        status: data.status || 'active',
        sortOrder: data.sortOrder || 0,
      }
    });
    return NextResponse.json(industry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Industry ID required' }, { status: 400 });
    }
    let industry: any;
    try {
      industry = await db.industry.update({
        where: { id: data.id },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.icon !== undefined && { icon: data.icon }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        }
      });
    } catch {
      // Fallback: parameterized pg query (safe, no SQL injection)
      const sets: string[] = ['"updatedAt" = NOW()'];
      const params: any[] = [];
      let paramIdx = 1;

      if (data.status !== undefined) { sets.push(`"status" = $${paramIdx++}`); params.push(data.status); }
      if (data.name !== undefined) { sets.push(`"name" = $${paramIdx++}`); params.push(data.name); }
      if (data.description !== undefined) { sets.push(`"description" = $${paramIdx++}`); params.push(data.description); }
      if (data.color !== undefined) { sets.push(`"color" = $${paramIdx++}`); params.push(data.color); }
      if (data.icon !== undefined) { sets.push(`"icon" = $${paramIdx++}`); params.push(data.icon); }
      if (data.sortOrder !== undefined) { sets.push(`"sortOrder" = $${paramIdx++}`); params.push(data.sortOrder); }

      params.push(data.id); // WHERE id = $N
      const sql = `UPDATE "Industry" SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
      const rows = await pgQuery<any>(sql, params);
      industry = rows[0] || null;
    }
    if (!industry) {
      return NextResponse.json({ error: 'Industry not found' }, { status: 404 });
    }
    return NextResponse.json(industry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
