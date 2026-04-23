import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

// ─── Inspection Checklist Templates for T&T move_in / move_out ───
interface ChecklistItem {
  area: string;
  item: string;
  condition: string; // good, fair, poor, needs_repair, clean, dirty, n/a
  notes: string;
  photos: string[];
}

const INSPECTION_AREAS: Record<string, string[]> = {
  walls: [
    'General wall condition',
    'Paint condition',
    'Wallpaper/coverings',
    'Cracks or damage',
    'Scuff marks',
    'Mould or dampness',
  ],
  floors: [
    'Flooring type & condition',
    'Tiles/grout condition',
    'Carpet condition',
    'Floor damage (scratches, stains)',
    'Baseboards/trim',
  ],
  doors_windows: [
    'Front door condition & locks',
    'Interior doors',
    'Window frames & glass',
    'Window screens',
    'Curtains/blinds',
    'Door handles & hinges',
    'Weather stripping',
  ],
  kitchen: [
    'Countertops condition',
    'Cabinet doors & hardware',
    'Sink & faucet',
    'Stove/oven condition',
    'Refrigerator condition',
    'Exhaust fan/hood',
    'Backsplash',
    'Pest evidence',
  ],
  bathroom: [
    'Sink & faucet',
    'Toilet condition',
    'Shower/bathtub',
    'Tiles & grout',
    'Exhaust fan',
    'Water pressure',
    'Drainage',
    'Mould/mildew',
  ],
  electrical: [
    'Light switches',
    'Outlet condition',
    'Light fixtures',
    'Ceiling fan',
    'Circuit breaker panel',
    'Smoke detectors',
    'GFCI outlets',
  ],
  plumbing: [
    'Water heater',
    'Pipe condition',
    'Drains',
    'Water shut-off valve',
    'Gas connection',
    'Outdoor faucets',
  ],
  general: [
    'Overall cleanliness',
    'Pest evidence',
    'Smoke/CO detector',
    'Fire extinguisher',
    'Storage areas',
    'Balcony/patio',
    'Parking area',
    'Keys & access devices',
    'Meter readings (water/electric)',
  ],
};

function generateChecklistTemplate(type: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const [area, checklistItems] of Object.entries(INSPECTION_AREAS)) {
    for (const item of checklistItems) {
      items.push({
        area,
        item,
        condition: 'good',
        notes: '',
        photos: [],
      });
    }
  }
  return items;
}

// ─── GET: List inspections with filters ───
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const leaseId = searchParams.get('leaseId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const template = searchParams.get('template'); // 'move_in' or 'move_out' to get blank template

    // Return checklist template without creating an inspection
    if (template === 'move_in' || template === 'move_out') {
      const checklist = generateChecklistTemplate(template);
      return NextResponse.json({
        template,
        areas: Object.keys(INSPECTION_AREAS),
        items: checklist,
        areaMap: INSPECTION_AREAS,
      });
    }

    const where: any = {};
    if (propertyId) where.propertyId = propertyId;
    if (unitId) where.unitId = unitId;
    if (leaseId) where.leaseId = leaseId;
    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;

    // Date range filter on scheduledDate
    if (dateFrom || dateTo) {
      where.scheduledDate = {};
      if (dateFrom) where.scheduledDate.gte = new Date(dateFrom);
      if (dateTo) where.scheduledDate.lte = new Date(dateTo);
    }

    const inspections = await db.propertyInspection.findMany({
      where,
      include: {
        property: true,
        unit: true,
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        tenant: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(inspections);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── POST: Create inspection with checklist items ───
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const body = await req.json();
    const {
      propertyId,
      unitId,
      leaseId,
      tenantId,
      type,
      scheduledDate,
      inspectorName,
      checklistItems,
      notes,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    // ─── Auto-generate checklist for move_in / move_out ───
    let finalChecklist: ChecklistItem[] = [];
    if (type === 'move_in' || type === 'move_out') {
      const template = generateChecklistTemplate(type);
      // If custom checklist items provided, merge/override
      if (checklistItems && Array.isArray(checklistItems) && checklistItems.length > 0) {
        finalChecklist = template.map((tpl) => {
          const custom = checklistItems.find(
            (c: any) => c.area === tpl.area && c.item === tpl.item
          );
          return custom
            ? { ...tpl, condition: custom.condition || tpl.condition, notes: custom.notes || '', photos: custom.photos || [] }
            : tpl;
        });
      } else {
        finalChecklist = template;
      }
    } else if (checklistItems && Array.isArray(checklistItems)) {
      finalChecklist = checklistItems;
    }

    const inspection = await db.propertyInspection.create({
      data: {
        propertyId,
        unitId: unitId || null,
        leaseId: leaseId || null,
        tenantId: tenantId || null,
        type: type || 'routine',
        inspectedAt: scheduledDate ? new Date(scheduledDate) : new Date(),
        inspectorName: inspectorName || null,
        checklist: JSON.stringify(finalChecklist),
        scoreTotal: body.overallScore ? Number(body.overallScore) : 0,
        signedByTenant: false,
        signedByLandlord: false,
        notes: notes || null,
      },
      include: {
        property: true,
        unit: true,
        lease: true,
        tenant: true,
      },
    });

    return NextResponse.json(inspection, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── PATCH: Update inspection, sign-off by tenant/landlord ───
export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const existing = await db.propertyInspection.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data: any = {};

    // Handle status transitions
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === 'completed' && !existing.inspectedAt) {
        data.inspectedAt = new Date();
      }
    }

    // Handle scheduled date
    if (body.scheduledDate !== undefined) {
      data.scheduledDate = body.scheduledDate
        ? new Date(body.scheduledDate)
        : null;
    }

    // Handle inspector details
    if (body.inspectorName !== undefined) data.inspectorName = body.inspectorName;
    if (body.inspectorNotes !== undefined) data.inspectorNotes = body.inspectorNotes;

    // Handle checklist items update
    if (body.checklistItems !== undefined) {
      data.checklistItems =
        typeof body.checklistItems === 'string'
          ? body.checklistItems
          : JSON.stringify(body.checklistItems);
    }

    // Handle overall score
    if (body.overallScore !== undefined) {
      const score = Number(body.overallScore);
      if (score < 1 || score > 10) {
        return NextResponse.json(
          { error: 'overallScore must be between 1 and 10' },
          { status: 400 }
        );
      }
      data.overallScore = score;
    }

    // Handle photos
    if (body.photos !== undefined) {
      data.photos =
        typeof body.photos === 'string'
          ? body.photos
          : JSON.stringify(body.photos);
    }

    // ─── Tenant Sign-Off ───
    if (body.signedByTenant === true && !existing.signedByTenant) {
      data.signedByTenant = true;
    }

    // ─── Landlord Sign-Off ───
    if (body.signedByLandlord === true && !existing.signedByLandlord) {
      data.signedByLandlord = true;
    }

    // Handle notes
    if (body.notes !== undefined) data.notes = body.notes;

    // Auto-update status to 'signed' when both parties have signed off
    if (
      (body.signedByTenant === true || existing.signedByTenant) &&
      (body.signedByLandlord === true || existing.signedByLandlord) &&
      data.status !== 'signed'
    ) {
      data.status = 'signed';
    }

    const inspection = await db.propertyInspection.update({
      where: { id },
      data,
      include: {
        property: true,
        unit: true,
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        tenant: true,
      },
    });

    return NextResponse.json(inspection);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── DELETE: Delete inspection ───
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await db.propertyInspection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
