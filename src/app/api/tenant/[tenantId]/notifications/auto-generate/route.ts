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
    const created: any[] = [];
    const now = new Date();

    // 1. Check for overdue rent payments
    const overduePayments = await db.rentPayment.findMany({
      where: {
        tenantId,
        dueDate: { lt: now },
        status: { in: ['pending', 'overdue'] },
      },
      include: { unit: { include: { property: true } }, lease: true },
    });

    for (const p of overduePayments) {
      // Check if notification already exists for this payment
      const exists = await db.notification.findFirst({
        where: { tenantId, category: 'payment', metadata: { contains: p.id } },
      });
      if (!exists) {
        const n = await db.notification.create({
          data: {
            tenantId,
            title: 'Renta Vencida',
            message: `El pago de renta de ${p.unit?.property?.name || 'Propiedad'} - Unidad ${p.unit?.unitNumber || ''} por ${p.amountDue} está vencido desde ${p.dueDate?.toLocaleDateString()}.`,
            type: 'error',
            category: 'payment',
            link: 'pm-rent-payments',
            metadata: JSON.stringify({ paymentId: p.id, unitId: p.unitId }),
          },
        });
        created.push(n);
      }
    }

    // 2. Check for leases expiring within 30 days
    const thirtyDays = new Date(now.getTime() + 30 * 86400000);
    const expiringLeases = await db.lease.findMany({
      where: {
        tenantId,
        status: 'active',
        endDate: { gte: now, lte: thirtyDays },
      },
      include: { unit: { include: { property: true } } },
    });

    for (const l of expiringLeases) {
      const exists = await db.notification.findFirst({
        where: { tenantId, category: 'lease', metadata: { contains: l.id } },
      });
      if (!exists) {
        const daysLeft = Math.ceil((new Date(l.endDate).getTime() - now.getTime()) / 86400000);
        const n = await db.notification.create({
          data: {
            tenantId,
            title: 'Contrato por Vencer',
            message: `El contrato de ${l.unit?.property?.name || 'Propiedad'} - Unidad ${l.unit?.unitNumber || ''} vence en ${daysLeft} días (${l.endDate?.toLocaleDateString()}).`,
            type: daysLeft <= 7 ? 'error' : 'warning',
            category: 'lease',
            link: 'pm-lease-renewal',
            metadata: JSON.stringify({ leaseId: l.id, daysLeft }),
          },
        });
        created.push(n);
      }
    }

    // 3. Check for newly resolved maintenance (resolved in last 24h)
    const oneDayAgo = new Date(now.getTime() - 86400000);
    const resolvedMaint = await db.maintenanceRequest.findMany({
      where: {
        tenantId,
        status: { in: ['resolved', 'closed'] },
        resolvedAt: { gte: oneDayAgo },
      },
      include: { unit: { include: { property: true } } },
    });

    for (const m of resolvedMaint) {
      const exists = await db.notification.findFirst({
        where: { tenantId, category: 'maintenance', metadata: { contains: m.id } },
      });
      if (!exists) {
        const n = await db.notification.create({
          data: {
            tenantId,
            title: 'Mantenimiento Completado',
            message: `La solicitud "${m.title}" de ${m.unit?.property?.name || 'Propiedad'} - Unidad ${m.unit?.unitNumber || ''} ha sido resuelta.`,
            type: 'success',
            category: 'maintenance',
            link: 'pm-maintenance',
            metadata: JSON.stringify({ requestId: m.id }),
          },
        });
        created.push(n);
      }
    }

    return NextResponse.json({
      generated: created.length,
      notifications: created,
      summary: {
        overduePayments: overduePayments.length,
        expiringLeases: expiringLeases.length,
        resolvedMaintenance: resolvedMaint.length,
      },
    });
  } catch (error: any) {
    console.error('Auto-generate notifications error:', error);
    return NextResponse.json({ error: 'Error generando notificaciones' }, { status: 500 });
  }
}
