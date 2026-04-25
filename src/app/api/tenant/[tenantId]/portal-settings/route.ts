/**
 * Portal Settings API — CRUD operations for tenant portal customization.
 * GET: Fetch portal settings for a tenant (creates defaults if missing)
 * PUT: Update portal settings for a tenant
 * PATCH: Partial update (toggle features)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await import('@/lib/db');

    let settings = await db.portalSetting.findUnique({
      where: { tenantId },
    });

    // Auto-create defaults if not found
    if (!settings) {
      settings = await db.portalSetting.create({
        data: { tenantId },
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('[Portal Settings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch portal settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { db } = await import('@/lib/db');

    // Validate allowed fields
    const allowedFields = [
      'portalName', 'welcomeMsg', 'logoUrl', 'primaryColor', 'accentColor',
      'bgColor', 'fontFamily', 'showPayments', 'showMaintenance',
      'showDocuments', 'allowChat', 'enabled', 'customDomain',
    ];

    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Upsert: create or update
    const settings = await db.portalSetting.upsert({
      where: { tenantId },
      create: { tenantId, ...updateData },
      update: updateData,
    });

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('[Portal Settings] PUT error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Portal settings already exist' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update portal settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { db } = await import('@/lib/db');

    try {
      const settings = await db.portalSetting.update({
        where: { tenantId },
        data: body,
      });
      return NextResponse.json(settings);
    } catch (updateErr: any) {
      if (updateErr.code === 'P2025') {
        const settings = await db.portalSetting.create({
          data: { tenantId, ...body },
        });
        return NextResponse.json(settings, { status: 201 });
      }
      throw updateErr;
    }
  } catch (error: any) {
    console.error('[Portal Settings] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update portal settings' }, { status: 500 });
  }
}
