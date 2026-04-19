import { NextRequest, NextResponse } from 'next/server';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import { authenticateRequest, verifyTenantAccess, sanitizeString, isValidEmail, hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth + tenant verification
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    const members = await pgQuery<any[]>(
      `SELECT tm.id, tm."userId", tm.role, tm.status, tm."createdAt",
              pu.email, pu."fullName", pu.avatarUrl, pu."isActive", pu."lastActiveAt"
       FROM "TenantMembership" tm
       LEFT JOIN "PlatformUser" pu ON pu.id = tm."userId"
       WHERE tm."tenantId" = $1
       ORDER BY tm."createdAt" ASC`,
      [tenantId]
    );
    return NextResponse.json(members);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth + tenant verification
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  // Only owner/admin/manager can invite
  const userRole = auth.payload?.tenantRole || 'viewer';
  if (!['owner', 'admin', 'manager'].includes(userRole)) {
    return NextResponse.json({ error: 'Only owners, admins, and managers can invite team members' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { email, fullName, role } = body;

    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and full name are required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const validRoles = ['owner', 'admin', 'manager', 'baker', 'cashier', 'viewer'];
    const memberRole = validRoles.includes(role) ? role : 'viewer';

    // Non-owners cannot assign owner role
    if (memberRole === 'owner' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Only owners can assign the owner role' }, { status: 403 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists (parameterized!)
    const existingUser = await pgQueryOne<any>(
      `SELECT id FROM "PlatformUser" WHERE email = $1`,
      [normalizedEmail]
    );

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user with hashed random password
      userId = `usr-${Date.now()}`;
      const randomPass = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-8);
      const hashedPass = await hashPassword(randomPass);
      await pgQuery(
        `INSERT INTO "PlatformUser" (id, email, "fullName", password, role, "isActive")
         VALUES ($1, $2, $3, $4, 'team_member', true)`,
        [userId, normalizedEmail, sanitizeString(fullName), hashedPass]
      );
    }

    // Check if already a member (parameterized!)
    const existingMembership = await pgQueryOne<any>(
      `SELECT id FROM "TenantMembership" WHERE "userId" = $1 AND "tenantId" = $2`,
      [userId, tenantId]
    );
    if (existingMembership) {
      return NextResponse.json({ error: 'User is already a team member' }, { status: 409 });
    }

    // Create membership (parameterized!)
    const membershipId = `tm-${Date.now()}`;
    await pgQuery(
      `INSERT INTO "TenantMembership" (id, "userId", "tenantId", role, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [membershipId, userId, tenantId, memberRole]
    );

    const member = await pgQueryOne<any>(
      `SELECT tm.id, tm."userId", tm.role, tm.status, tm."createdAt",
              pu.email, pu."fullName", pu.avatarUrl
       FROM "TenantMembership" tm
       LEFT JOIN "PlatformUser" pu ON pu.id = tm."userId"
       WHERE tm.id = $1`,
      [membershipId]
    );

    return NextResponse.json(member);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth + tenant verification
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  const userRole = auth.payload?.tenantRole || 'viewer';
  if (!['owner', 'admin'].includes(userRole)) {
    return NextResponse.json({ error: 'Only owners and admins can change roles' }, { status: 403 });
  }

  const { id, role } = await req.json();
  if (!id || !role) {
    return NextResponse.json({ error: 'ID and role are required' }, { status: 400 });
  }

  try {
    const validRoles = ['owner', 'admin', 'manager', 'baker', 'cashier', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Non-owners cannot assign owner role
    if (role === 'owner' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Only owners can assign the owner role' }, { status: 403 });
    }

    // Parameterized update!
    await pgQuery(
      `UPDATE "TenantMembership" SET role = $1, "updatedAt" = NOW() WHERE id = $2`,
      [role, id]
    );

    const updated = await pgQueryOne<any>(
      `SELECT tm.id, tm."userId", tm.role, tm.status,
              pu.email, pu."fullName", pu.avatarUrl
       FROM "TenantMembership" tm
       LEFT JOIN "PlatformUser" pu ON pu.id = tm."userId"
       WHERE tm.id = $1`,
      [id]
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  // Auth + tenant verification
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  const userRole = auth.payload?.tenantRole || 'viewer';
  if (!['owner', 'admin'].includes(userRole)) {
    return NextResponse.json({ error: 'Only owners and admins can remove team members' }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    // Parameterized delete!
    await pgQuery(`DELETE FROM "TenantMembership" WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
