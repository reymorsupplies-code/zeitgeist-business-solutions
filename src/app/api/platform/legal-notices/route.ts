import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pgQuery } from '@/lib/pg-query';
import { authenticateRequest } from '@/lib/auth';

// ─── T&T Legal Notice Templates ───
interface NoticeTemplate {
  type: string;
  defaultSubject: string;
  defaultContent: string;
  legalReferences: { act: string; section: string; description: string }[];
  noticeDays: number;
}

const TANDT_NOTICE_TEMPLATES: Record<string, NoticeTemplate> = {
  rent_increase: {
    type: 'rent_increase',
    defaultSubject: 'Notice of Rent Increase',
    defaultContent: `NOTICE OF RENT INCREASE

Dear [Tenant Name],

Pursuant to the Rent Restriction Act of Trinidad and Tobago, you are hereby given notice that the monthly rent for the premises located at [Property Address], [Unit Number], will be increased as follows:

Current Monthly Rent: TTD [Current Amount]
New Monthly Rent: TTD [New Amount]
Effective Date: [Effective Date] (30 days from notice date)

This notice is served in accordance with the Rent Restriction Act, which requires a minimum of 30 days written notice for any rent adjustment. The increase has been determined based on [reason for increase, e.g., market conditions, property improvements, operational costs].

If you have any questions or wish to discuss this notice, please contact us at [Landlord Contact Information].

You have the right to dispute this increase by contacting the Rent Assessment Board of Trinidad and Tobago.

This notice is given on [Date].

Sincerely,
[Landlord Name/Property Manager]
[Contact Information]`,
    legalReferences: [
      {
        act: 'Rent Restriction Act',
        section: 'Chapter 59:51',
        description: 'Governs rent control and requires minimum 30 days notice for rent increases',
      },
    ],
    noticeDays: 30,
  },

  lease_renewal: {
    type: 'lease_renewal',
    defaultSubject: 'Notice of Lease Renewal',
    defaultContent: `NOTICE OF LEASE RENEWAL

Dear [Tenant Name],

In accordance with the Land Tenants Act of Trinidad and Tobago (Ch. 59:54), this notice serves to inform you of the following regarding your lease agreement for the premises at [Property Address], [Unit Number]:

Current Lease Period: [Start Date] to [End Date]
Renewal Terms Offered:
  - New Lease Period: [New Start Date] to [New End Date]
  - Monthly Rent: TTD [New Rent Amount]
  - Other Terms: [Any changes to terms]

Under the Land Tenants Act, you are entitled to a reasonable period within which to consider this renewal offer. Please indicate your acceptance or non-acceptance of these renewal terms no later than [Response Deadline].

If you do not respond by the specified date, it may be construed as a decision not to renew, and appropriate vacate notice procedures will follow.

For questions regarding your rights as a tenant under the Land Tenants Act, please contact the Rent Assessment Board.

This notice is given on [Date].

Sincerely,
[Landlord Name/Property Manager]
[Contact Information]`,
    legalReferences: [
      {
        act: 'Land Tenants Act',
        section: 'Chapter 59:54',
        description: 'Governs landlord-tenant relationships, lease renewals, and tenant protections',
      },
    ],
    noticeDays: 30,
  },

  lease_termination: {
    type: 'lease_termination',
    defaultSubject: 'Notice of Lease Termination',
    defaultContent: `NOTICE OF LEASE TERMINATION

Dear [Tenant Name],

This notice is to formally inform you that your lease agreement for the premises located at [Property Address], [Unit Number], will terminate on [Termination Date].

Lease Details:
  - Lease Start Date: [Start Date]
  - Lease End Date: [End Date]
  - Termination Effective Date: [Termination Date] (28 days from notice date)

As per the terms of your month-to-month tenancy arrangement under the laws of Trinidad and Tobago, a minimum of 28 days written notice is required for lease termination.

Please ensure that:
1. All rent and utility payments are settled up to the termination date
2. The premises are cleaned and returned in good condition
3. All keys and access devices are returned
4. A move-out inspection is scheduled
5. Your forwarding address is provided for security deposit return

Your security deposit of TTD [Deposit Amount] will be processed within 14 days of vacate, subject to any deductions for damages beyond normal wear and tear.

This notice is given on [Date].

Sincerely,
[Landlord Name/Property Manager]
[Contact Information]`,
    legalReferences: [
      {
        act: 'Land Tenants Act',
        section: 'Chapter 59:54',
        description: 'Governs termination notice requirements for month-to-month tenancies (minimum 28 days)',
      },
      {
        act: 'Common Law',
        section: 'Notice to Quit',
        description: '28 days notice required for monthly tenancy termination',
      },
    ],
    noticeDays: 28,
  },

  eviction: {
    type: 'eviction',
    defaultSubject: 'Notice of Eviction Proceedings',
    defaultContent: `NOTICE OF INTENDED EVICTION PROCEEDINGS

Dear [Tenant Name],

TAKE NOTICE that the landlord intends to apply to the court for an order for your possession of the premises located at [Property Address], [Unit Number].

Grounds for Eviction:
[Specific grounds, e.g., non-payment of rent, breach of lease terms, illegal activity]

IMPORTANT: This is a formal legal notice. Under the laws of Trinidad and Tobago, eviction can only be carried out by court order. You have the right to:

1. Respond to this notice within [Response Period] days
2. Appear before the court to present your case
3. Seek legal advice from an attorney-at-law
4. Contact the Rent Assessment Board for assistance

Court proceedings will commence on or after [Court Date]. You will be served with formal court documents at that time.

YOU ARE NOT REQUIRED TO VACATE THE PREMISES UNTIL A COURT ORDER IS OBTAINED.

Any attempt to forcibly remove you without a court order is unlawful.

This notice is given on [Date].

Sincerely,
[Landlord Name/Property Manager]
[Contact Information]
[Attorney Information, if applicable]`,
    legalReferences: [
      {
        act: 'Land Tenants Act',
        section: 'Chapter 59:54',
        description: 'Eviction procedures and tenant protections against unlawful eviction',
      },
      {
        act: 'Summary Courts Act',
        section: 'Civil Proceedings',
        description: 'Court process for obtaining possession orders',
      },
      {
        act: 'Constitution of Trinidad and Tobago',
        section: 'Section 4 - Right to Protection of the Law',
        description: 'Right to due process before any court-ordered eviction',
      },
    ],
    noticeDays: 28,
  },

  late_payment: {
    type: 'late_payment',
    defaultSubject: 'Reminder: Overdue Rent Payment',
    defaultContent: `LATE PAYMENT REMINDER

Dear [Tenant Name],

Our records indicate that your rent payment for the period [Billing Period] is overdue.

Payment Details:
  - Property: [Property Address], [Unit Number]
  - Amount Due: TTD [Amount Due]
  - Due Date: [Due Date]
  - Days Overdue: [Days Overdue]
  - Late Fee: TTD [Late Fee Amount]

Please remit payment in full within [Grace Period] days of this notice to avoid further action.

Accepted Payment Methods:
  - Bank Transfer: [Bank Details]
  - Cash/Cheque: At [Payment Location]
  - Online: [Payment Portal]

If you have already made this payment, please disregard this notice and provide proof of payment.

If you are experiencing financial difficulty, please contact us immediately to discuss payment arrangements. We are committed to working with you to find a reasonable solution.

Persistent non-payment may result in further action as permitted under the Land Tenants Act of Trinidad and Tobago.

This notice is given on [Date].

Sincerely,
[Landlord Name/Property Manager]
[Contact Information]`,
    legalReferences: [
      {
        act: 'Land Tenants Act',
        section: 'Chapter 59:54',
        description: 'Landlord remedies for non-payment of rent',
      },
      {
        act: 'Rent Restriction Act',
        section: 'Chapter 59:51',
        description: 'Late payment provisions and landlord rights',
      },
    ],
    noticeDays: 7,
  },

  vacate_notice: {
    type: 'vacate_notice',
    defaultSubject: 'Move-Out Instructions and Vacate Notice',
    defaultContent: `MOVE-OUT INSTRUCTIONS AND VACATE NOTICE

Dear [Tenant Name],

We have received confirmation that you will be vacating the premises at [Property Address], [Unit Number].

Vacate Date: [Vacate Date]

Please complete the following before your departure:

1. UTILITIES & ACCOUNTS
   - Arrange disconnection/transfer of all utilities
   - Provide final meter readings (water, electricity)
   - Settle all outstanding utility bills

2. CLEANING & CONDITION
   - Clean all rooms, including kitchen and bathroom
   - Remove all personal belongings and furniture
   - Defrost and clean the refrigerator
   - Ensure all garbage is removed
   - Repair any damage beyond normal wear and tear

3. KEYS & ACCESS
   - Return all keys (front door, mailbox, security gates, etc.)
   - Return any remote controls, access cards, or fobs
   - Return all original keys provided at move-in

4. INSPECTION
   - A move-out inspection will be scheduled for [Inspection Date]
   - Please be present during the inspection if possible
   - The inspection will document the property condition

5. FORWARDING ADDRESS
   - Please provide your new forwarding address for security deposit return
   - Your deposit of TTD [Deposit Amount] will be returned within 14 days

6. MAIL FORWARDING
   - Set up mail forwarding with TTPost

Security Deposit Return:
Your security deposit of TTD [Deposit Amount] will be processed within 14 days of vacate. Any deductions for damages beyond normal wear and tear will be itemized and communicated to you in writing.

Thank you for being a valued tenant. We wish you all the best.

Sincerely,
[Landlord Name/Property Manager]
[Contact Information]`,
    legalReferences: [
      {
        act: 'Land Tenants Act',
        section: 'Chapter 59:54',
        description: 'Security deposit return timeline and tenant obligations at vacate',
      },
      {
        act: 'Common Law',
        section: 'Landlord-Tenant Obligations',
        description: 'Reasonable wear and tear standard and deposit return requirements',
      },
    ],
    noticeDays: 28,
  },
};

// ─── GET: List notices with filters ───
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const leaseId = searchParams.get('leaseId');
    const propertyId = searchParams.get('propertyId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const jurisdiction = searchParams.get('jurisdiction');

    const where: any = {};
    if (leaseId) where.leaseId = leaseId;
    if (propertyId) where.propertyId = propertyId;
    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;
    if (jurisdiction) where.jurisdiction = jurisdiction;

    const notices = await db.legalNotice.findMany({
      where,
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true,
        unit: true,
        tenant: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notices);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── POST: Create notice from template or custom ───
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const body = await req.json();
    const {
      leaseId,
      propertyId,
      unitId,
      tenantId,
      type,
      recipientName,
      recipientEmail,
      recipientAddress,
      subject,
      content,
      customContent,
      sentVia,
      trackingRef,
      notes,
      generate, // If true, auto-generate content from template
      effectiveDate,
    } = body;

    // ─── Generate: auto-generate notices for expiring leases ───
    if (generate === true) {
      return handleAutoGenerate(req);
    }

    if (!type) {
      return NextResponse.json(
        { error: 'type is required (rent_increase, lease_renewal, lease_termination, eviction, late_payment, vacate_notice)' },
        { status: 400 }
      );
    }

    const template = TANDT_NOTICE_TEMPLATES[type];
    if (!template) {
      return NextResponse.json(
        {
          error: `Unknown notice type: ${type}. Valid types: ${Object.keys(TANDT_NOTICE_TEMPLATES).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Use provided content or fall back to template
    const noticeContent = customContent || content || template.defaultContent;
    const noticeSubject = subject || template.defaultSubject;

    // Calculate effective and expiry dates
    const issuedDate = new Date();
    const effective = effectiveDate ? new Date(effectiveDate) : new Date(issuedDate);
    const expiry = new Date(issuedDate);
    expiry.setDate(expiry.getDate() + template.noticeDays);

    // Populate recipient info from lease if not provided
    let finalRecipientName = recipientName;
    let finalRecipientEmail = recipientEmail;
    let finalRecipientAddress = recipientAddress;

    if (leaseId && (!recipientName || !recipientEmail)) {
      const lease = await db.lease.findUnique({
        where: { id: leaseId },
        include: {
          unit: { include: { property: true } },
          tenant: true,
        },
      });
      if (lease) {
        if (!finalRecipientName && lease.tenant) {
          finalRecipientName = lease.tenant.name;
        }
        if (!finalRecipientEmail && lease.tenant) {
          finalRecipientEmail = lease.tenant.email;
        }
        if (!finalRecipientAddress && lease.unit?.property) {
          finalRecipientAddress = lease.unit.property.address;
        }
        // Auto-fill propertyId and unitId from lease
        if (!propertyId) body.propertyId = lease.unit?.propertyId;
        if (!unitId) body.unitId = lease.unitId;
        if (!tenantId) body.tenantId = lease.tenantId;
      }
    }

    const notice = await db.legalNotice.create({
      data: {
        leaseId: leaseId || null,
        propertyId: propertyId || null,
        unitId: unitId || null,
        tenantId: tenantId || null,
        type,
        status: 'draft',
        jurisdiction: 'TT',
        title: noticeSubject,
        content: noticeContent,
        templateSlug: type,
        effectiveDate: effective,
        expiresAt: expiry,
        sentMethod: sentVia || null,
      },
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true,
        unit: true,
        tenant: true,
      },
    });

    return NextResponse.json(notice, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── Auto-generate notices for leases expiring within notice period ───
async function handleAutoGenerate(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysAhead = Number(searchParams.get('daysAhead')) || 60;
    const noticeType = searchParams.get('noticeType') || 'lease_renewal';

    const template = TANDT_NOTICE_TEMPLATES[noticeType];
    if (!template) {
      return NextResponse.json(
        {
          error: `Unknown notice type: ${noticeType}. Valid types: ${Object.keys(TANDT_NOTICE_TEMPLATES).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Find active leases expiring within the notice period
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + template.noticeDays);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + daysAhead);

    const expiringLeases = await db.lease.findMany({
      where: {
        status: 'active',
        endDate: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        unit: { include: { property: true } },
        tenant: true,
      },
    });

    // Check which leases already have pending notices of this type
    const existingNotices = await db.legalNotice.findMany({
      where: {
        type: noticeType,
        status: { in: ['draft', 'sent', 'acknowledged'] },
        leaseId: { in: expiringLeases.map((l) => l.id) },
      },
      select: { leaseId: true },
    });
    const existingLeaseIds = new Set(existingNotices.map((n) => n.leaseId));

    const leasesNeedingNotice = expiringLeases.filter(
      (l) => !existingLeaseIds.has(l.id)
    );

    // Generate notices for each lease
    const generatedNotices: any[] = [];
    for (const lease of leasesNeedingNotice) {
      const content = template.defaultContent
        .replace('[Tenant Name]', lease.tenant?.name || 'Tenant')
        .replace('[Property Address]', lease.unit?.property?.address || 'N/A')
        .replace('[Unit Number]', lease.unit?.unitNumber || 'N/A')
        .replace('[Current Amount]', lease.rentAmount.toNumber().toFixed(2))
        .replace('[New Amount]', lease.rentAmount.toNumber().toFixed(2))
        .replace('[Start Date]', lease.startDate.toLocaleDateString())
        .replace('[End Date]', lease.endDate.toLocaleDateString())
        .replace('[Date]', now.toLocaleDateString())
        .replace('[Landlord Name/Property Manager]', 'Property Management')
        .replace('[Contact Information]', '')
        .replace('[Response Deadline]', new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString());

      const expiry = new Date(lease.endDate);
      expiry.setDate(expiry.getDate() - template.noticeDays);

      const notice = await db.legalNotice.create({
        data: {
          leaseId: lease.id,
          propertyId: lease.unit?.propertyId || '',
          unitId: lease.unitId,
          tenantId: lease.tenantId || null,
          type: noticeType,
          status: 'draft',
          jurisdiction: 'TT',
          title: template.defaultSubject,
          content,
          templateSlug: noticeType,
          effectiveDate: now,
          expiresAt: expiry,
        },
        include: {
          lease: { include: { unit: { include: { property: true } }, tenant: true } },
          property: true,
          unit: true,
          tenant: true,
        },
      });

      generatedNotices.push(notice);
    }

    return NextResponse.json({
      generated: generatedNotices.length,
      skipped: existingLeaseIds.size,
      totalChecked: expiringLeases.length,
      notices: generatedNotices,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── PATCH: Update notice status, record response ───
export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const existing = await db.legalNotice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Legal notice not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data: any = {};

    // Handle status updates
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'sent', 'acknowledged', 'responded', 'expired', 'withdrawn'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Invalid status: ${body.status}. Valid statuses: ${validStatuses.join(', ')}`,
          },
          { status: 400 }
        );
      }
      data.status = body.status;

      // Auto-set issuedDate when notice is sent
      if (body.status === 'sent' && !existing.sentDate) {
        data.sentDate = new Date();
      }
    }

    // Handle recipient updates
    if (body.recipientName !== undefined) data.recipientName = body.recipientName;
    if (body.recipientEmail !== undefined) data.recipientEmail = body.recipientEmail;
    if (body.recipientAddress !== undefined) data.recipientAddress = body.recipientAddress;

    // Handle content updates
    if (body.subject !== undefined) data.subject = body.subject;
    if (body.content !== undefined) data.content = body.content;

    // Handle dates
    if (body.issuedDate !== undefined) {
      data.issuedDate = body.issuedDate ? new Date(body.issuedDate) : null;
    }
    if (body.effectiveDate !== undefined) {
      data.effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;
    }
    if (body.expiryDate !== undefined) {
      data.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
    }

    // Handle response recording
    if (body.response !== undefined) {
      data.response = body.response;
      data.responseDate = new Date();
      if (data.status === undefined) {
        data.status = 'responded';
      }
    }
    if (body.responseDate !== undefined) {
      data.responseDate = body.responseDate ? new Date(body.responseDate) : null;
    }

    // Handle delivery tracking
    if (body.sentVia !== undefined) data.sentVia = body.sentVia;
    if (body.trackingRef !== undefined) data.trackingRef = body.trackingRef;

    // Handle notes
    if (body.notes !== undefined) data.notes = body.notes;

    // Handle jurisdiction
    if (body.jurisdiction !== undefined) data.jurisdiction = body.jurisdiction;

    // Handle legal references
    if (body.legalReferences !== undefined) {
      data.legalReferences =
        typeof body.legalReferences === 'string'
          ? body.legalReferences
          : JSON.stringify(body.legalReferences);
    }

    const notice = await db.legalNotice.update({
      where: { id },
      data,
      include: {
        lease: { include: { unit: { include: { property: true } }, tenant: true } },
        property: true,
        unit: true,
        tenant: true,
      },
    });

    return NextResponse.json(notice);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── DELETE: Delete notice ───
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await db.legalNotice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
