import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ── Orders API with Deposit & Installment Support ──

export async function GET(_req: NextRequest, {params }: { params: Promise<{ tenantId: string }> }) {
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
    // Ensure deposit columns exist (idempotent migration)
    await ensureDepositColumns();
    
    const orders = await db.order.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
    await ensureDepositColumns();
    const data = await req.json();
    const count = await db.order.count({ where: { tenantId } });
    
    // Calculate balance due
    const totalAmount = data.totalAmount || 0;
    const depositAmount = data.depositAmount || 0;
    const balanceDue = totalAmount - depositAmount;

    const order = await db.order.create({
      data: {
        tenantId,
        orderNumber: data.orderNumber || `ORD-${String(count + 1).padStart(3, '0')}`,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
        subtotal: data.subtotal || 0,
        taxAmount: data.taxAmount || 0,
        totalAmount: totalAmount,
        status: data.status || 'pending',
        orderType: data.orderType || 'custom',
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        deliveryAddress: data.deliveryAddress,
        notes: data.notes,
        // Deposit fields (stored via raw SQL fallback if Prisma doesn't know them)
      }
    });

    // If deposit fields exist, update them via raw SQL
    if (depositAmount > 0 || data.depositMethod || data.paymentSchedule) {
      const schedule = data.paymentSchedule ? JSON.stringify(data.paymentSchedule) : null;
      await pgQuery(
        `UPDATE "Order" SET 
          "depositAmount" = $1, 
          "depositPaid" = $2, 
          "depositMethod" = $3, 
          "depositDate" = $4, 
          "balanceDue" = $5,
          "paymentSchedule" = $6,
          "updatedAt" = NOW() 
         WHERE id = $7`,
        [
          depositAmount,
          data.depositPaid || depositAmount, // Assume paid if amount specified
          data.depositMethod || 'cash',
          data.depositDate ? new Date(data.depositDate).toISOString() : new Date().toISOString(),
          balanceDue,
          schedule,
          order.id
        ]
      );
    }

    const finalOrder = await pgQueryOne(`SELECT * FROM "Order" WHERE id = $1`, [order.id]);
    return NextResponse.json(finalOrder);
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
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await ensureDepositColumns();
    
    // Handle deposit payment recording
    if (fields.type === 'record_deposit_payment') {
      const paymentAmount = fields.paymentAmount || 0;
      const paymentMethod = fields.paymentMethod || 'cash';
      const { type, paymentAmount: _, paymentMethod: __, ...updateFields } = fields;
      
      // Get current order
      const order = await pgQueryOne(`SELECT * FROM "Order" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      
      const newDepositPaid = (order.depositPaid || 0) + paymentAmount;
      const newBalanceDue = (order.totalAmount || 0) - newDepositPaid;

      // Update payment schedule if exists
      let schedule = order.paymentSchedule ? JSON.parse(order.paymentSchedule) : null;
      if (schedule && Array.isArray(schedule)) {
        const nextPending = schedule.find((s: any) => s.status === 'pending');
        if (nextPending) {
          nextPending.status = 'paid';
          nextPending.paidDate = new Date().toISOString();
          nextPending.paidAmount = paymentAmount;
          nextPending.method = paymentMethod;
        }
      }

      await pgQuery(
        `UPDATE "Order" SET 
          "depositPaid" = $1, 
          "balanceDue" = $2, 
          "paymentSchedule" = $3,
          "status" = CASE WHEN $4 <= 0 THEN 'paid' ELSE "status" END,
          "updatedAt" = NOW() 
         WHERE id = $5 AND "tenantId" = $6`,
        [newDepositPaid, newBalanceDue > 0 ? newBalanceDue : 0, schedule ? JSON.stringify(schedule) : null, newBalanceDue, id, tenantId]
      );

      const updated = await pgQueryOne(`SELECT * FROM "Order" WHERE id = $1`, [id]);
      return NextResponse.json(updated);
    }

    // Handle status change
    if (fields.status) {
      // Recalculate balance due if total or deposit changed
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      
      for (const [k, v] of Object.entries(fields)) {
        if (k === 'paymentSchedule' && typeof v === 'object') {
          setParts.push(`"${k}" = ${pIdx++}`);
          paramValues.push(JSON.stringify(v));
        } else {
          setParts.push(`"${k}" = ${pIdx++}`);
          paramValues.push(v);
        }
      }
      
      if (fields.totalAmount !== undefined || fields.depositPaid !== undefined) {
        // Will be recalculated if needed
      }
      
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "Order" SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1}`, [...paramValues, id, tenantId]);
      const updated = await pgQueryOne(`SELECT * FROM "Order" WHERE id = $1`, [id]);
      return NextResponse.json(updated);
    }

    // Standard update (Prisma first, fallback to raw SQL)
    try {
      const updated = await db.order.update({ where: { id, tenantId: tenantId || '' }, data: fields });
      return NextResponse.json(updated);
    } catch {
      try {
        const setParts: string[] = [];
        const paramValues: any[] = [];
        let pIdx = 1;
        for (const [k, v] of Object.entries(fields)) {
          if (k === 'paymentSchedule' && typeof v === 'object') {
            setParts.push(`"${k}" = ${pIdx++}`);
            paramValues.push(JSON.stringify(v));
          } else {
            setParts.push(`"${k}" = ${pIdx++}`);
            paramValues.push(v);
          }
        }
        setParts.push(`"updatedAt" = NOW()`);
        await pgQuery(`UPDATE "Order" SET ${setParts.join(', ')} WHERE id = $${pIdx} AND "tenantId" = $${pIdx + 1}`, [...paramValues, id, tenantId]);
        const updated = await pgQueryOne(`SELECT * FROM "Order" WHERE id = $1`, [id]);
        return NextResponse.json(updated);
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }
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

  try {
    await db.order.update({ where: { id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "Order" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ── Helper: Ensure deposit columns exist ──
async function ensureDepositColumns() {
  const columns = [
    { col: '"depositAmount"', type: 'DOUBLE PRECISION DEFAULT 0' },
    { col: '"depositPaid"', type: 'DOUBLE PRECISION DEFAULT 0' },
    { col: '"depositMethod"', type: 'TEXT DEFAULT \'cash\'' },
    { col: '"depositDate"', type: 'TIMESTAMP WITH TIME ZONE' },
    { col: '"balanceDue"', type: 'DOUBLE PRECISION DEFAULT 0' },
    { col: '"paymentSchedule"', type: 'TEXT' }, // JSON string for installment plans
  ];
  
  for (const c of columns) {
    try {
      await pgQuery(
        `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS ${c.col} ${c.type}`
      );
    } catch {
      // Column may already exist, ignore
    }
  }
}
