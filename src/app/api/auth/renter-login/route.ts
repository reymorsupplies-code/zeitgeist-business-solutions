import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { email, pin, tenantId } = await req.json();
    
    if (!email || !pin || !tenantId) {
      return NextResponse.json({ error: 'Email, PIN, and tenant ID are required' }, { status: 400 });
    }

    // Import db dynamically to avoid build issues
    const { db } = await import('@/lib/db');
    
    // Find the renter by email + tenantId
    const renter = await db.renter.findFirst({
      where: { email: email.toLowerCase().trim(), tenantId, status: 'active' },
      include: {
        property: true,
        unit: true,
        lease: true,
      },
    });

    if (!renter) {
      return NextResponse.json({ error: 'Credenciales inválidas o cuenta inactiva' }, { status: 401 });
    }

    // Simple PIN check (in production, use bcrypt - but PINs are simple 4-6 digits)
    // For now, store PIN as plain text since the auto-SQL init sets it
    // The PIN should be hashed when creating the renter
    const crypto = await import('crypto');
    const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
    
    if (renter.pin !== hashedPin && renter.pin !== pin) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
    }

    // Update last login
    await db.renter.update({
      where: { id: renter.id },
      data: { lastLoginAt: new Date() },
    });

    // Create a simple token (JWT-like but simpler for renter portal)
    const token = Buffer.from(JSON.stringify({
      renterId: renter.id,
      tenantId: renter.tenantId,
      propertyId: renter.propertyId,
      unitId: renter.unitId,
      leaseId: renter.leaseId,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24h expiry
    })).toString('base64');

    return NextResponse.json({
      token,
      renter: {
        id: renter.id,
        fullName: renter.fullName,
        email: renter.email,
        phone: renter.phone,
        property: renter.property ? { id: renter.property.id, name: renter.property.name, address: renter.property.address } : null,
        unit: renter.unit ? { id: renter.unit.id, unitNumber: renter.unit.unitNumber } : null,
        lease: renter.lease ? {
          id: renter.lease.id,
          startDate: renter.lease.startDate,
          endDate: renter.lease.endDate,
          rentAmount: renter.lease.rentAmount,
          rentCurrency: renter.lease.rentCurrency,
          status: renter.lease.status,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Renter login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
