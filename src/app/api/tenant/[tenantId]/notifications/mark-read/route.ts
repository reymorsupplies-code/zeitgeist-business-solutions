import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();

    if (body.markAll) {
      // Mark all as read for this tenant
      await db.notification.updateMany({
        where: { tenantId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    } else if (body.id) {
      // Mark single as read
      await db.notification.update({
        where: { id: body.id, tenantId },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error marcando notificación' }, { status: 500 });
  }
}
