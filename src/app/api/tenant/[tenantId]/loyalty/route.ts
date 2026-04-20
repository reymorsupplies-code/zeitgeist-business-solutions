import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Loyalty / Points Program API ──

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureLoyaltyTables();

    const { searchParams } = new URL(_req.url);
    const clientPhone = searchParams.get('clientPhone');
    const clientId = searchParams.get('clientId');

    // Bonus: GET /tiers returns tier configuration
    const tiersParam = searchParams.get('tiers');
    if (tiersParam !== null) {
      return NextResponse.json({
        tiers: [
          {
            name: 'bronze',
            label: 'Bronze',
            minPoints: 0,
            maxPoints: 99,
            benefits: 'Earn 1 point per $1 spent. Birthday reward: 5 bonus points.',
            color: '#CD7F32',
          },
          {
            name: 'silver',
            label: 'Silver',
            minPoints: 100,
            maxPoints: 499,
            benefits: 'Earn 1.5x points per $1 spent. Birthday reward: 15 bonus points. Early access to new items.',
            color: '#C0C0C0',
          },
          {
            name: 'gold',
            label: 'Gold',
            minPoints: 500,
            maxPoints: 999,
            benefits: 'Earn 2x points per $1 spent. Birthday reward: 25 bonus points. 5% discount on every order.',
            color: '#FFD700',
          },
          {
            name: 'platinum',
            label: 'Platinum',
            minPoints: 1000,
            maxPoints: null,
            benefits: 'Earn 3x points per $1 spent. Birthday reward: 50 bonus points. 10% discount on every order. Free delivery.',
            color: '#E5E4E2',
          },
        ],
      });
    }

    // Filter by client phone
    if (clientPhone) {
      const member = await pgQueryOne(
        `SELECT * FROM "LoyaltyMember" WHERE "tenantId" = $1 AND "clientPhone" = $2`,
        [tenantId, clientPhone]
      );
      if (!member) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      // Also fetch recent transactions
      const transactions = await pgQuery(
        `SELECT * FROM "LoyaltyTransaction" WHERE "memberId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
        [member.id]
      );
      return NextResponse.json({ member, transactions });
    }

    // Filter by client id
    if (clientId) {
      const member = await pgQueryOne(
        `SELECT * FROM "LoyaltyMember" WHERE "tenantId" = $1 AND "clientId" = $2`,
        [tenantId, clientId]
      );
      if (!member) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      const transactions = await pgQuery(
        `SELECT * FROM "LoyaltyTransaction" WHERE "memberId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
        [member.id]
      );
      return NextResponse.json({ member, transactions });
    }

    // List all loyalty members
    const members = await pgQuery(
      `SELECT * FROM "LoyaltyMember" WHERE "tenantId" = $1 ORDER BY "points" DESC, "joinDate" ASC`,
      [tenantId]
    );
    return NextResponse.json({ members, total: members.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    await ensureLoyaltyTables();

    const data = await req.json();
    const { clientName, clientPhone, clientEmail, clientId } = data;

    if (!clientName || !clientPhone) {
      return NextResponse.json({ error: 'clientName and clientPhone are required' }, { status: 400 });
    }

    // Check if member already exists by phone
    const existing = await pgQueryOne(
      `SELECT * FROM "LoyaltyMember" WHERE "tenantId" = $1 AND "clientPhone" = $2`,
      [tenantId, clientPhone]
    );

    if (existing) {
      return NextResponse.json({ member: existing, existing: true });
    }

    // Create new member
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newMember = await pgQueryOne(
      `INSERT INTO "LoyaltyMember" (id, "tenantId", "clientId", "clientName", "clientPhone", "clientEmail", points, "totalSpent", "totalOrders", tier, "joinDate", "lastVisit", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        id,
        tenantId,
        clientId || null,
        clientName,
        clientPhone,
        clientEmail || '',
        0,
        0,
        0,
        'bronze',
        now,
        now,
        now,
      ]
    );

    return NextResponse.json({ member: newMember, existing: false }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await ensureLoyaltyTables();

    const member = await pgQueryOne(
      `SELECT * FROM "LoyaltyMember" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // ── Add Points Action ──
    if (fields.action === 'add_points') {
      const pointsToAdd = Math.max(0, fields.points || 0);
      const description = fields.description || 'Points earned';
      const totalSpent = fields.totalSpent !== undefined ? fields.totalSpent : member.totalSpent;
      const totalOrders = fields.totalOrders !== undefined ? fields.totalOrders : member.totalOrders;
      const now = new Date().toISOString();

      const newPoints = member.points + pointsToAdd;
      const newTier = calculateTier(newPoints);

      await pgQuery(
        `UPDATE "LoyaltyMember" SET points = $1, "totalSpent" = $2, "totalOrders" = $3, tier = $4, "lastVisit" = $5 WHERE id = $6 AND "tenantId" = $7`,
        [newPoints, totalSpent, totalOrders, newTier, now, id, tenantId]
      );

      // Record transaction
      await pgQuery(
        `INSERT INTO "LoyaltyTransaction" (id, "memberId", "tenantId", type, points, description, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), id, tenantId, 'earn', pointsToAdd, description, now]
      );

      const updated = await pgQueryOne(`SELECT * FROM "LoyaltyMember" WHERE id = $1`, [id]);
      return NextResponse.json({ member: updated });
    }

    // ── Redeem Points Action ──
    if (fields.action === 'redeem_points') {
      const pointsToRedeem = Math.max(0, fields.points || 0);
      const description = fields.description || 'Points redeemed';

      if (pointsToRedeem > member.points) {
        return NextResponse.json(
          { error: `Insufficient points. Available: ${member.points}, requested: ${pointsToRedeem}` },
          { status: 400 }
        );
      }

      const newPoints = member.points - pointsToRedeem;
      const newTier = calculateTier(newPoints);
      const now = new Date().toISOString();

      await pgQuery(
        `UPDATE "LoyaltyMember" SET points = $1, tier = $2, "lastVisit" = $3 WHERE id = $4 AND "tenantId" = $5`,
        [newPoints, newTier, now, id, tenantId]
      );

      // Record transaction
      await pgQuery(
        `INSERT INTO "LoyaltyTransaction" (id, "memberId", "tenantId", type, points, description, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), id, tenantId, 'redeem', -pointsToRedeem, description, now]
      );

      const updated = await pgQueryOne(`SELECT * FROM "LoyaltyMember" WHERE id = $1`, [id]);
      return NextResponse.json({ member: updated });
    }

    // ── Standard Info Update (clientName, clientEmail, tier) ──
    const allowedFields = ['clientName', 'clientEmail', 'tier'];
    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    for (const key of allowedFields) {
      if (fields[key] !== undefined) {
        setParts.push(`"${key}" = $${pIdx++}`);
        paramValues.push(fields[key]);
      }
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update. Allowed: clientName, clientEmail, tier' }, { status: 400 });
    }

    setParts.push(`"lastVisit" = $${pIdx++}`);
    paramValues.push(new Date().toISOString());

    await pgQuery(
      `UPDATE "LoyaltyMember" SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1}`,
      [...paramValues, id, tenantId]
    );

    const updated = await pgQueryOne(`SELECT * FROM "LoyaltyMember" WHERE id = $1`, [id]);
    return NextResponse.json({ member: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    await ensureLoyaltyTables();

    // Verify member exists and belongs to this tenant
    const member = await pgQueryOne(
      `SELECT * FROM "LoyaltyMember" WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId]
    );
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Delete transactions first (cascade), then member
    await pgQuery(`DELETE FROM "LoyaltyTransaction" WHERE "memberId" = $1 AND "tenantId" = $2`, [id, tenantId]);
    await pgQuery(`DELETE FROM "LoyaltyMember" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── Helpers ──

function calculateTier(points: number): string {
  if (points >= 1000) return 'platinum';
  if (points >= 500) return 'gold';
  if (points >= 100) return 'silver';
  return 'bronze';
}

async function ensureLoyaltyTables() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "LoyaltyMember" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "clientId" TEXT,
      "clientName" TEXT NOT NULL,
      "clientPhone" TEXT NOT NULL,
      "clientEmail" TEXT DEFAULT '',
      "points" INTEGER NOT NULL DEFAULT 0,
      "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalOrders" INTEGER NOT NULL DEFAULT 0,
      "tier" TEXT NOT NULL DEFAULT 'bronze',
      "joinDate" TEXT NOT NULL,
      "lastVisit" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    )
  `);

  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
      "id" TEXT PRIMARY KEY,
      "memberId" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "points" INTEGER NOT NULL,
      "description" TEXT DEFAULT '',
      "createdAt" TEXT NOT NULL
    )
  `);

  // Ensure unique constraint on (tenantId, clientPhone)
  try {
    await pgQuery(`
      ALTER TABLE "LoyaltyMember" ADD CONSTRAINT "LoyaltyMember_tenantId_clientPhone_key" UNIQUE ("tenantId", "clientPhone")
    `);
  } catch {
    // Constraint already exists, ignore
  }
}
