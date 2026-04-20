import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── GET: List purchase orders ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const where: any = { tenantId, isDeleted: false };
    if (status && status !== 'all') where.status = status;

    const orders = await db.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  } catch {
    try {
      let sql = `SELECT * FROM "PurchaseOrder" WHERE "tenantId" = $1 AND "isDeleted" = false`;
      const params: any[] = [tenantId];
      if (status && status !== 'all') { sql += ` AND status = $2`; params.push(status); }
      sql += ` ORDER BY "createdAt" DESC`;
      const orders = await pgQuery<any>(sql, params);
      return NextResponse.json(orders);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── POST: Create purchase order ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();

    const count = await db.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${String(count + 1).padStart(5, '0')}`;

    const po = await db.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        supplierId: data.supplierId || null,
        supplierName: data.supplierName || '',
        status: data.status || 'draft',
        items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
        totalAmount: data.totalAmount || 0,
        receivedAmount: 0,
        notes: data.notes || '',
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      },
    });
    return NextResponse.json(po);
  } catch {
    try {
      const data = await req.json();
      const count = await pgQuery<any>(`SELECT COUNT(*)::int as c FROM "PurchaseOrder" WHERE "tenantId" = $1`, [tenantId]);
      const cn = (count[0]?.c || 0) + 1;
      const poNumber = `PO-${String(cn).padStart(5, '0')}`;
      const itemsStr = typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []);
      const now = new Date().toISOString();

      await pgQuery(
        `INSERT INTO "PurchaseOrder" ("tenantId","poNumber","supplierId","supplierName","status","items","totalAmount","receivedAmount","notes","expectedDate","isDeleted","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12)`,
        [tenantId, poNumber, data.supplierId || null, data.supplierName || '', data.status || 'draft', itemsStr, data.totalAmount || 0, 0, data.notes || '', data.expectedDate ? new Date(data.expectedDate).toISOString() : null, now, now]
      );

      const created = await pgQueryOne(`SELECT * FROM "PurchaseOrder" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [tenantId]);
      return NextResponse.json(created);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── PUT: Update PO (status changes, edits) ───
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id, receiveItems, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    const updated = await db.purchaseOrder.update({
      where: { id, tenantId },
      data: whitelistFields('PurchaseOrder', fields),
    });

    // Handle receiving items against PO — adds stock to retail products
    if (receiveItems && Array.isArray(receiveItems) && receiveItems.length > 0) {
      const po = await db.purchaseOrder.findFirst({ where: { id, tenantId } });
      if (po) {
        const currentItems = typeof po.items === 'string' ? JSON.parse(po.items) : (po.items || []);
        let totalReceived = 0;

        for (const received of receiveItems) {
          const idx = currentItems.findIndex((it: any) => it.productId === received.productId);
          if (idx >= 0) {
            const prevReceived = currentItems[idx].receivedQty || 0;
            currentItems[idx].receivedQty = prevReceived + (received.qty || 0);
            totalReceived += (received.qty || 0) * (currentItems[idx].unitCost || 0);

            // Add stock to retail product
            if (received.productId) {
              try {
                const product = await db.retailProduct.findFirst({ where: { id: received.productId, tenantId } });
                if (product) {
                  await db.retailProduct.update({
                    where: { id: received.productId },
                    data: { quantity: product.quantity + (received.qty || 0) },
                  });
                }
              } catch { /* best-effort */ }
            }
          }
        }

        // Update received amount and items
        const newReceivedAmount = po.receivedAmount + totalReceived;
        const allReceived = currentItems.every((it: any) => it.receivedQty >= it.qty);
        await db.purchaseOrder.update({
          where: { id },
          data: {
            items: JSON.stringify(currentItems),
            receivedAmount: newReceivedAmount,
            status: allReceived ? 'received' : 'partial',
            receivedAt: allReceived ? new Date() : po.receivedAt,
          },
        });
      }
    }

    const final = await db.purchaseOrder.findFirst({ where: { id, tenantId } });
    return NextResponse.json(final);
  } catch {
    try {
      const setParts: string[] = [];
      const paramValues: any[] = [];
      let pIdx = 1;
      for (const [k, v] of Object.entries(fields)) {
        setParts.push(`"${k}" = $${pIdx++}`);
        paramValues.push(v);
      }
      setParts.push(`"updatedAt" = NOW()`);
      await pgQuery(`UPDATE "PurchaseOrder" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`, [...paramValues, id, tenantId]);

      // Receive items (pg fallback)
      if (receiveItems && Array.isArray(receiveItems) && receiveItems.length > 0) {
        const po = await pgQueryOne<any>(`SELECT * FROM "PurchaseOrder" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
        if (po) {
          const currentItems = typeof po.items === 'string' ? JSON.parse(po.items) : (po.items || []);
          let totalReceived = 0;
          for (const received of receiveItems) {
            const idx = currentItems.findIndex((it: any) => it.productId === received.productId);
            if (idx >= 0) {
              const prevReceived = currentItems[idx].receivedQty || 0;
              currentItems[idx].receivedQty = prevReceived + (received.qty || 0);
              totalReceived += (received.qty || 0) * (currentItems[idx].unitCost || 0);
              if (received.productId) {
                try { await pgQuery(`UPDATE "RetailProduct" SET quantity = quantity + $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`, [received.qty || 0, received.productId, tenantId]); } catch { /* best-effort */ }
              }
            }
          }
          const newReceivedAmt = (po.receivedAmount || 0) + totalReceived;
          const allReceived = currentItems.every((it: any) => it.receivedQty >= it.qty);
          await pgQuery(
            `UPDATE "PurchaseOrder" SET items = $1, "receivedAmount" = $2, status = $3, "receivedAt" = $4, "updatedAt" = NOW() WHERE id = $5 AND "tenantId" = $6`,
            [JSON.stringify(currentItems), newReceivedAmt, allReceived ? 'received' : 'partial', allReceived ? new Date().toISOString() : (po.receivedAt || null), id, tenantId]
          );
        }
      }

      const final = await pgQueryOne(`SELECT * FROM "PurchaseOrder" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json(final);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}

// ─── DELETE: Soft delete ───
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await db.purchaseOrder.update({ where: { id, tenantId }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch {
    try {
      await pgQuery(`UPDATE "PurchaseOrder" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
