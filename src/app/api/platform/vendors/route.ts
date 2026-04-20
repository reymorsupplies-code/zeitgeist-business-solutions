import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List vendors
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const category = searchParams.get('category');

    const where: any = {};
    if (propertyId) where.propertyId = propertyId;
    if (category && category !== 'all') where.category = category;

    const vendors = await db.propertyVendor.findMany({
      where,
      include: { property: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(vendors);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST - Create vendor
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vendor = await db.propertyVendor.create({
      data: {
        propertyId: body.propertyId || null,
        name: body.name,
        category: body.category || null,
        contact: body.contact || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        rating: Number(body.rating) || 0,
        isActive: body.isActive !== false,
        notes: body.notes || null,
      },
      include: { property: true },
    });
    return NextResponse.json(vendor);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH - Update vendor
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.category !== undefined) data.category = body.category;
    if (body.contact !== undefined) data.contact = body.contact;
    if (body.email !== undefined) data.email = body.email;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.address !== undefined) data.address = body.address;
    if (body.rating !== undefined) data.rating = Number(body.rating);
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.propertyId !== undefined) data.propertyId = body.propertyId;

    const vendor = await db.propertyVendor.update({
      where: { id },
      data,
      include: { property: true },
    });
    return NextResponse.json(vendor);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE - Delete vendor
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.propertyVendor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
