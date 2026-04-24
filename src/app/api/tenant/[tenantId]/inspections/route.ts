import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

// ─── Inspection Checklist Templates for T&T move_in / move_out ───
interface ChecklistItem {
  area: string;
  item: string;
  condition: string;
  notes: string;
  photos: string[];
}

const INSPECTION_AREAS: Record<string, string[]> = {
  walls: ['General wall condition', 'Paint condition', 'Wallpaper/coverings', 'Cracks or damage', 'Scuff marks', 'Mould or dampness'],
  floors: ['Flooring type & condition', 'Tiles/grout condition', 'Carpet condition', 'Floor damage (scratches, stains)', 'Baseboards/trim'],
  doors_windows: ['Front door condition & locks', 'Interior doors', 'Window frames & glass', 'Window screens', 'Curtains/blinds', 'Door handles & hinges', 'Weather stripping'],
  kitchen: ['Countertops condition', 'Cabinet doors & hardware', 'Sink & faucet', 'Stove/oven condition', 'Refrigerator condition', 'Exhaust fan/hood', 'Backsplash', 'Pest evidence'],
  bathroom: ['Sink & faucet', 'Toilet condition', 'Shower/bathtub', 'Tiles & grout', 'Exhaust fan', 'Water pressure', 'Drainage', 'Mould/mildew'],
  electrical: ['Light switches', 'Outlet condition', 'Light fixtures', 'Ceiling fan', 'Circuit breaker panel', 'Smoke detectors', 'GFCI outlets'],
  plumbing: ['Water heater', 'Pipe condition', 'Drains', 'Water shut-off valve', 'Gas connection', 'Outdoor faucets'],
  general: ['Overall cleanliness', 'Pest evidence', 'Smoke/CO detector', 'Fire extinguisher', 'Storage areas', 'Balcony/patio', 'Parking area', 'Keys & access devices', 'Meter readings (water/electric)'],
};

function generateChecklistTemplate(type: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const [area, checklistItems] of Object.entries(INSPECTION_AREAS)) {
    for (const item of checklistItems) {
      items.push({ area, item, condition: 'good', notes: '', photos: [] });
    }
  }
  return items;
}

// ─── GET: List inspections for this tenant ───
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(_req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(_req.url);
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const leaseId = searchParams.get('leaseId');
    const type = searchParams.get('type');
    const template = searchParams.get('template');

    // Return blank template without DB call
    if (template === 'move_in' || template === 'move_out') {
      const checklist = generateChecklistTemplate(template);
      return NextResponse.json({ template, areas: Object.keys(INSPECTION_AREAS), items: checklist, areaMap: INSPECTION_AREAS });
    }

    const where: any = { tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (unitId) where.unitId = unitId;
    if (leaseId) where.leaseId = leaseId;
    if (type && type !== 'all') where.type = type;

    const inspections = await db.propertyInspection.findMany({
      where,
      include: { property: true, unit: true, lease: { include: { unit: { include: { property: true } }, tenant: true } }, tenant: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(inspections);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── POST: Create inspection with checklist ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const body = await req.json();
    const { propertyId, unitId, leaseId, type, scheduledDate, inspectorName, checklistItems, notes } = body;

    if (!propertyId) return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });

    // Verify property belongs to this tenant
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property || property.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Auto-generate checklist for move_in / move_out
    let finalChecklist: ChecklistItem[] = [];
    if (type === 'move_in' || type === 'move_out') {
      const tpl = generateChecklistTemplate(type);
      if (checklistItems && Array.isArray(checklistItems) && checklistItems.length > 0) {
        finalChecklist = tpl.map((t) => {
          const custom = checklistItems.find((c: any) => c.area === t.area && c.item === t.item);
          return custom ? { ...t, condition: custom.condition || t.condition, notes: custom.notes || '', photos: custom.photos || [] } : t;
        });
      } else {
        finalChecklist = tpl;
      }
    } else if (checklistItems && Array.isArray(checklistItems)) {
      finalChecklist = checklistItems;
    }

    const inspection = await db.propertyInspection.create({
      data: {
        propertyId, tenantId,
        unitId: unitId || null,
        leaseId: leaseId || null,
        type: type || 'routine',
        inspectedAt: scheduledDate ? new Date(scheduledDate) : new Date(),
        inspectorName: inspectorName || null,
        checklist: JSON.stringify(finalChecklist),
        scoreTotal: body.overallScore ? Number(body.overallScore) : 0,
        signedByTenant: false,
        signedByLandlord: false,
        notes: notes || null,
      },
      include: { property: true, unit: true, lease: true, tenant: true },
    });

    return NextResponse.json(inspection, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── PATCH: Update inspection, sign-off ───
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.propertyInspection.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    const body = await req.json();
    const data: any = {};

    if (body.status !== undefined) data.status = body.status;
    if (body.inspectorName !== undefined) data.inspectorName = body.inspectorName;
    if (body.checklist !== undefined) data.checklist = typeof body.checklist === 'string' ? body.checklist : JSON.stringify(body.checklist);
    if (body.scoreTotal !== undefined) data.scoreTotal = Number(body.scoreTotal);
    if (body.notes !== undefined) data.notes = body.notes;

    // Tenant sign-off
    if (body.signedByTenant === true && !existing.signedByTenant) data.signedByTenant = true;
    // Landlord sign-off
    if (body.signedByLandlord === true && !existing.signedByLandlord) data.signedByLandlord = true;

    // Auto-status 'signed' when both parties signed
    if ((body.signedByTenant === true || existing.signedByTenant) && (body.signedByLandlord === true || existing.signedByLandlord)) {
      data.status = 'signed';
    }

    const inspection = await db.propertyInspection.update({
      where: { id },
      data,
      include: { property: true, unit: true, lease: { include: { unit: { include: { property: true } }, tenant: true } }, tenant: true },
    });

    return NextResponse.json(inspection);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── DELETE: Delete inspection ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.propertyInspection.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    await db.propertyInspection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
