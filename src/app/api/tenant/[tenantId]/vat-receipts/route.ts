/**
 * VAT Receipts API — BIR-Compliant T&T VAT Invoice Generation
 *
 * GET  — Generate a BIR-compliant VAT receipt/invoice from an existing POS sale
 * POST — Create a new VAT receipt record from sale data with auto-assigned sequential number
 *
 * Receipt format complies with Trinidad & Tobago VAT Invoice Requirements:
 *   - Business name and address
 *   - BIR number, TIN, VAT Registration Number
 *   - Sequential receipt number (VR-YYYY-NNNNN)
 *   - Date of supply
 *   - Per-line item: description, quantity, unit price, VAT rate, VAT amount, line total
 *   - Category totals: standard (12.5%), exempt (0%), zero-rated (0%)
 *   - Subtotal (excl. VAT), Total VAT, Grand Total (incl. VAT)
 *   - Payment method
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess, checkRateLimit } from '@/lib/auth';
import { db } from '@/lib/db';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';

// ─── Constants ───

const VAT_RATE = 0.125; // 12.5%
const COUNTRY = 'Trinidad and Tobago';

// ─── Helpers ───

function parseJsonSafe(raw: any): any {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

/**
 * Ensure the VATReceipt table exists (idempotent).
 */
async function ensureVATReceiptTable(): Promise<void> {
  try {
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS "VATReceipt" (
        id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"            TEXT NOT NULL,
        "receiptNumber"       TEXT NOT NULL,
        "saleId"              TEXT,
        "saleNumber"          TEXT,
        status                TEXT NOT NULL DEFAULT 'issued',
        issuedAt              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "businessName"        TEXT NOT NULL DEFAULT '',
        "businessAddress"     TEXT NOT NULL DEFAULT '',
        "birNumber"           TEXT NOT NULL DEFAULT '',
        "tin"                 TEXT NOT NULL DEFAULT '',
        "vatRegistrationNumber" TEXT NOT NULL DEFAULT '',
        "customerName"        TEXT NOT NULL DEFAULT '',
        "paymentMethod"       TEXT NOT NULL DEFAULT 'cash',
        currency              TEXT NOT NULL DEFAULT 'TTD',
        items                 TEXT NOT NULL DEFAULT '[]',
        "subtotal"            NUMERIC(14,2) NOT NULL DEFAULT 0,
        "totalVAT"            NUMERIC(14,2) NOT NULL DEFAULT 0,
        "grandTotal"          NUMERIC(14,2) NOT NULL DEFAULT 0,
        "standardSubtotal"    NUMERIC(14,2) NOT NULL DEFAULT 0,
        "standardVAT"         NUMERIC(14,2) NOT NULL DEFAULT 0,
        "exemptSubtotal"      NUMERIC(14,2) NOT NULL DEFAULT 0,
        "zeroRatedSubtotal"   NUMERIC(14,2) NOT NULL DEFAULT 0,
        notes                 TEXT,
        "voidedAt"            TIMESTAMPTZ,
        "isDeleted"           BOOLEAN NOT NULL DEFAULT false,
        "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "VATReceipt_tenant_receipt_key" UNIQUE ("tenantId", "receiptNumber")
      );
    `);
    await pgQuery(`
      CREATE INDEX IF NOT EXISTS "idx_VATReceipt_tenantId" ON "VATReceipt"("tenantId");
    `);
    await pgQuery(`
      CREATE INDEX IF NOT EXISTS "idx_VATReceipt_saleId" ON "VATReceipt"("saleId");
    `);
  } catch (err: any) {
    console.error('[vat-receipts] Error creating VATReceipt table:', err.message);
  }
}

/**
 * Generate the next sequential VAT receipt number for a tenant.
 * Format: VR-YYYY-NNNNN (e.g., VR-2025-00001)
 */
async function generateReceiptNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();

  try {
    // Check if there's already a receipt for this year
    const result = await pgQueryOne<any>(
      `SELECT MAX("receiptNumber") as max_num FROM "VATReceipt"
       WHERE "tenantId" = $1 AND "receiptNumber" LIKE $2 AND "isDeleted" = false`,
      [tenantId, `VR-${year}-%`]
    );

    let nextSeq = 1;
    if (result?.max_num) {
      // Extract the sequence number from VR-YYYY-NNNNN
      const parts = result.max_num.split('-');
      if (parts.length === 3) {
        nextSeq = parseInt(parts[2], 10) + 1;
      }
    }

    return `VR-${year}-${String(nextSeq).padStart(5, '0')}`;
  } catch {
    // Fallback: count all receipts for this tenant+year
    try {
      const count = await pgQueryOne<any>(
        `SELECT COUNT(*)::int as c FROM "VATReceipt" WHERE "tenantId" = $1 AND "receiptNumber" LIKE $2 AND "isDeleted" = false`,
        [tenantId, `VR-${year}-%`]
      );
      const seq = (count?.c || 0) + 1;
      return `VR-${year}-${String(seq).padStart(5, '0')}`;
    } catch {
      // Absolute fallback
      return `VR-${year}-${String(Date.now()).slice(-5)}`;
    }
  }
}

/**
 * Look up the VAT category for a product.
 */
async function getProductVatCategory(productId: string, tenantId: string): Promise<string> {
  // Try pgQuery — reads 'settings' column if it exists (added via migration)
  try {
    const row = await pgQueryOne<any>(
      `SELECT settings FROM "RetailProduct" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
      [productId, tenantId]
    );
    if (row) {
      const settings = parseJsonSafe(row.settings);
      if (settings.vatCategory && ['standard', 'exempt', 'zero_rated'].includes(settings.vatCategory)) {
        return settings.vatCategory;
      }
    }
  } catch { /* fallback */ }

  return 'standard';
}

/**
 * Build the BIR-compliant receipt line items with VAT breakdown.
 */
async function buildReceiptLineItems(
  saleItems: any[],
  tenantId: string
): Promise<{
  lines: Array<{
    lineNumber: number;
    name: string;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    vatCategory: string;
    vatRate: number;
    lineSubtotal: number;
    vatAmount: number;
    lineTotal: number;
  }>;
  subtotal: number;
  totalVAT: number;
  grandTotal: number;
  standardSubtotal: number;
  standardVAT: number;
  exemptSubtotal: number;
  zeroRatedSubtotal: number;
}> {
  const lines: Array<{
    lineNumber: number;
    name: string;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    vatCategory: string;
    vatRate: number;
    lineSubtotal: number;
    vatAmount: number;
    lineTotal: number;
  }> = [];
  let subtotal = 0;
  let totalVAT = 0;
  let standardSubtotal = 0;
  let standardVAT = 0;
  let exemptSubtotal = 0;
  let zeroRatedSubtotal = 0;

  for (let i = 0; i < saleItems.length; i++) {
    const item = saleItems[i];
    const qty = item.qty || 1;
    const unitPrice = Number(item.price) || 0;
    const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;

    // Determine VAT category
    let vatCategory = 'standard';
    if (item.productId) {
      vatCategory = await getProductVatCategory(item.productId, tenantId);
    }
    if (item.vatCategory && ['standard', 'exempt', 'zero_rated'].includes(item.vatCategory)) {
      vatCategory = item.vatCategory;
    }

    const vatRate = vatCategory === 'standard' ? VAT_RATE : 0;
    const vatAmount = Math.round(lineSubtotal * vatRate * 100) / 100;
    const lineTotal = Math.round((lineSubtotal + vatAmount) * 100) / 100;

    subtotal += lineSubtotal;
    totalVAT += vatAmount;

    switch (vatCategory) {
      case 'standard':
        standardSubtotal += lineSubtotal;
        standardVAT += vatAmount;
        break;
      case 'exempt':
        exemptSubtotal += lineSubtotal;
        break;
      case 'zero_rated':
        zeroRatedSubtotal += lineSubtotal;
        break;
    }

    lines.push({
      lineNumber: i + 1,
      name: item.name || 'Unknown Item',
      sku: item.sku || null,
      quantity: qty,
      unitPrice,
      vatCategory,
      vatRate,
      lineSubtotal,
      vatAmount,
      lineTotal,
    });
  }

  return {
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    totalVAT: Math.round(totalVAT * 100) / 100,
    grandTotal: Math.round((subtotal + totalVAT) * 100) / 100,
    standardSubtotal: Math.round(standardSubtotal * 100) / 100,
    standardVAT: Math.round(standardVAT * 100) / 100,
    exemptSubtotal: Math.round(exemptSubtotal * 100) / 100,
    zeroRatedSubtotal: Math.round(zeroRatedSubtotal * 100) / 100,
  };
}

/**
 * Build the BIR-compliant receipt format.
 */
function formatReceipt(receipt: any, tenant: any, lines: any[]): any {
  const vatInfo = receipt._vatBreakdown || {};

  return {
    // ─── BIR Header ───
    header: {
      title: 'VAT INVOICE / RECEIPT',
      country: COUNTRY,
      businessName: receipt.businessName || tenant?.name || '',
      businessAddress: receipt.businessAddress || tenant?.address || '',
      birNumber: receipt.birNumber || '',
      tin: receipt.tin || '',
      vatRegistrationNumber: receipt.vatRegistrationNumber || '',
    },

    // ─── Receipt Identification ───
    receiptInfo: {
      receiptNumber: receipt.receiptNumber,
      saleNumber: receipt.saleNumber || null,
      issueDate: receipt.issuedAt || receipt.createdAt,
      status: receipt.status,
      currency: receipt.currency || 'TTD',
    },

    // ─── Customer ───
    customer: {
      name: receipt.customerName || '',
    },

    // ─── Line Items ───
    lineItems: lines,

    // ─── Category Breakdown ───
    categoryBreakdown: {
      standard: {
        label: 'Standard Rate (12.5%)',
        subtotal: vatInfo.standardSubtotal || 0,
        vat: vatInfo.standardVAT || 0,
        total: (vatInfo.standardSubtotal || 0) + (vatInfo.standardVAT || 0),
      },
      exempt: {
        label: 'Exempt (0%)',
        subtotal: vatInfo.exemptSubtotal || 0,
        vat: 0,
        total: vatInfo.exemptSubtotal || 0,
      },
      zeroRated: {
        label: 'Zero-Rated (0%)',
        subtotal: vatInfo.zeroRatedSubtotal || 0,
        vat: 0,
        total: vatInfo.zeroRatedSubtotal || 0,
      },
    },

    // ─── Totals ───
    totals: {
      subtotal: Number(receipt.subtotal) || 0,
      totalVAT: Number(receipt.totalVAT) || 0,
      grandTotal: Number(receipt.grandTotal) || 0,
      amountInWords: numberToWords(Number(receipt.grandTotal) || 0),
    },

    // ─── Payment ───
    payment: {
      method: receipt.paymentMethod || 'cash',
    },

    // ─── Footer / Disclaimer ───
    footer: {
      disclaimer: `This is a computer-generated VAT invoice. VAT is charged at 12.5% on standard-rated items in accordance with the Value Added Tax Act of Trinidad and Tobago.`,
      birNotice: 'Keep this receipt for your records. BIR may request to see this document.',
    },
  };
}

/**
 * Convert a number to English words for the receipt total.
 * Simple implementation for whole-dollar amounts and cents.
 */
function numberToWords(amount: number): string {
  if (amount === 0) return 'Zero Dollars and Zero Cents';

  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 1_000_000)
      return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 1_000_000_000)
      return convert(Math.floor(n / 1_000_000)) + ' Million' + (n % 1_000_000 ? ' ' + convert(n % 1_000_000) : '');
    return convert(Math.floor(n / 1_000_000_000)) + ' Billion' + (n % 1_000_000_000 ? ' ' + convert(n % 1_000_000_000) : '');
  }

  let result = convert(dollars) + (dollars === 1 ? ' Dollar' : ' Dollars');
  if (cents > 0) {
    result += ' and ' + convert(cents) + (cents === 1 ? ' Cent' : ' Cents');
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// GET — Generate BIR-Compliant VAT Receipt from Existing Sale
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const url = new URL(req.url);
  const saleId = url.searchParams.get('saleId');
  const saleNumber = url.searchParams.get('saleNumber');
  const receiptId = url.searchParams.get('receiptId');
  const receiptNumber = url.searchParams.get('receiptNumber');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const page = parseInt(url.searchParams.get('page') || '1');

  try {
    await ensureVATReceiptTable();

    // ─── Case 1: Retrieve an existing VAT receipt by ID or receipt number ───
    if (receiptId || receiptNumber) {
      let receipt: any;
      if (receiptId) {
        receipt = await pgQueryOne<any>(
          `SELECT * FROM "VATReceipt" WHERE id = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
          [receiptId, tenantId]
        );
      } else if (receiptNumber) {
        receipt = await pgQueryOne<any>(
          `SELECT * FROM "VATReceipt" WHERE "receiptNumber" = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
          [receiptNumber, tenantId]
        );
      }

      if (!receipt) {
        return NextResponse.json({ error: 'VAT receipt not found' }, { status: 404 });
      }

      // Fetch tenant for the formatted receipt
      const tenant = await db.tenant.findFirst({
        where: { id: tenantId },
        select: { name: true, address: true, settings: true },
      });
      const lines = parseJsonSafe(receipt.items);
      const formatted = formatReceipt(receipt, tenant, lines);

      return NextResponse.json({
        receipt,
        formatted,
      });
    }

    // ─── Case 2: Generate a VAT receipt from an existing POS sale ───
    if (saleId || saleNumber) {
      let sale: any;
      if (saleId) {
        sale = await db.pOSSale.findFirst({
          where: { id: saleId, tenantId, isDeleted: false },
        });
      } else {
        sale = await db.pOSSale.findFirst({
          where: { saleNumber: saleNumber!, tenantId, isDeleted: false },
        });
      }

      if (!sale) {
        return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
      }

      if (sale.status !== 'completed') {
        return NextResponse.json(
          { error: `Cannot generate VAT receipt for sale with status: ${sale.status}` },
          { status: 400 }
        );
      }

      // Fetch tenant settings
      const tenant = await db.tenant.findFirst({
        where: { id: tenantId },
        select: { name: true, address: true, settings: true, phone: true, email: true },
      });
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }

      const settings = parseJsonSafe(tenant.settings);
      const birNumber = settings.birNumber || '';
      const tin = settings.tin || '';
      const vatRegistrationNumber = settings.vatRegistrationNumber || '';

      // Check if a VAT receipt already exists for this sale
      const existingReceipt = await pgQueryOne<any>(
        `SELECT * FROM "VATReceipt" WHERE "saleId" = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
        [sale.id, tenantId]
      );

      if (existingReceipt) {
        const lines = parseJsonSafe(existingReceipt.items);
        const formatted = formatReceipt(existingReceipt, tenant, lines);
        return NextResponse.json({
          receipt: existingReceipt,
          formatted,
          _note: 'Existing VAT receipt found for this sale',
        });
      }

      // Build line items with VAT breakdown
      const saleItems = parseJsonSafe(sale.items);
      const vatResult = await buildReceiptLineItems(
        Array.isArray(saleItems) ? saleItems : [],
        tenantId
      );

      // Generate BIR-compliant receipt format (not persisted — just a preview)
      const receiptPreview = {
        tenantId,
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        businessName: tenant.name,
        businessAddress: tenant.address || '',
        birNumber,
        tin,
        vatRegistrationNumber,
        customerName: sale.customerName || '',
        paymentMethod: sale.paymentMethod || 'cash',
        currency: sale.currency || 'TTD',
        items: vatResult.lines,
        subtotal: vatResult.subtotal,
        totalVAT: vatResult.totalVAT,
        grandTotal: vatResult.grandTotal,
        _vatBreakdown: {
          standardSubtotal: vatResult.standardSubtotal,
          standardVAT: vatResult.standardVAT,
          exemptSubtotal: vatResult.exemptSubtotal,
          zeroRatedSubtotal: vatResult.zeroRatedSubtotal,
        },
        issuedAt: new Date().toISOString(),
      };

      const formatted = formatReceipt(receiptPreview, tenant, vatResult.lines);

      return NextResponse.json({
        receipt: receiptPreview,
        formatted,
        _note: 'Preview only — use POST to persist this VAT receipt',
      });
    }

    // ─── Case 3: List VAT receipts for the tenant ───
    const offset = (page - 1) * limit;
    const receipts = await pgQuery<any>(
      `SELECT id, "receiptNumber", "saleId", "saleNumber", status, "issuedAt",
              "businessName", "customerName", currency,
              subtotal, "totalVAT", "grandTotal", "paymentMethod"
       FROM "VATReceipt"
       WHERE "tenantId" = $1 AND "isDeleted" = false
       ORDER BY "issuedAt" DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );

    const totalResult = await pgQueryOne<any>(
      `SELECT COUNT(*)::int as c FROM "VATReceipt" WHERE "tenantId" = $1 AND "isDeleted" = false`,
      [tenantId]
    );

    return NextResponse.json({
      receipts,
      pagination: {
        page,
        limit,
        total: totalResult?.c || 0,
        totalPages: Math.ceil((totalResult?.c || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('[vat-receipts] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST — Create a New VAT Receipt
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  const rateLimitResult = checkRateLimit(
    `vat-receipts-post:${req.headers.get('x-forwarded-for') || 'unknown'}`,
    30,
    60_000
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let data: any;
  try { data = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    await ensureVATReceiptTable();

    // ─── Fetch tenant settings ───
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, address: true, settings: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const settings = parseJsonSafe(tenant.settings);
    const birNumber = settings.birNumber || '';
    const tin = settings.tin || '';
    const vatRegistrationNumber = settings.vatRegistrationNumber || '';

    // ─── Validate required BIR fields ───
    if (!birNumber || !tin || !vatRegistrationNumber) {
      return NextResponse.json({
        error: 'Incomplete tax configuration. BIR Number, TIN, and VAT Registration Number are required.',
        missing: {
          birNumber: !birNumber,
          tin: !tin,
          vatRegistrationNumber: !vatRegistrationNumber,
        },
      }, { status: 422 });
    }

    let sale: any = null;
    let saleItems: any[] = [];
    let customerName = '';
    let paymentMethod = 'cash';
    let currency = 'TTD';
    let saleNumber = '';

    // ─── Mode 1: Create from existing sale ───
    if (data.saleId) {
      sale = await db.pOSSale.findFirst({
        where: { id: data.saleId, tenantId, isDeleted: false, status: 'completed' },
      });
      if (!sale) {
        return NextResponse.json({ error: 'Completed sale not found for the given saleId' }, { status: 404 });
      }

      // Check if a VAT receipt already exists for this sale
      const existing = await pgQueryOne<any>(
        `SELECT id, "receiptNumber" FROM "VATReceipt" WHERE "saleId" = $1 AND "tenantId" = $2 AND "isDeleted" = false`,
        [sale.id, tenantId]
      );
      if (existing && !data.forceNew) {
        return NextResponse.json(
          { error: `VAT receipt already exists for this sale: ${existing.receiptNumber}. Use forceNew: true to create a new one.` },
          { status: 409 }
        );
      }

      saleItems = parseJsonSafe(sale.items);
      if (!Array.isArray(saleItems)) saleItems = [];
      customerName = data.customerName || sale.customerName || '';
      paymentMethod = sale.paymentMethod || 'cash';
      currency = sale.currency || 'TTD';
      saleNumber = sale.saleNumber || '';
    }
    // ─── Mode 2: Create from inline data ───
    else if (data.items && Array.isArray(data.items)) {
      saleItems = data.items;
      customerName = data.customerName || '';
      paymentMethod = data.paymentMethod || 'cash';
      currency = data.currency || 'TTD';
      saleNumber = data.saleNumber || '';
    } else {
      return NextResponse.json(
        { error: 'Provide either saleId or items array to create a VAT receipt' },
        { status: 400 }
      );
    }

    if (saleItems.length === 0) {
      return NextResponse.json({ error: 'No items to create VAT receipt' }, { status: 400 });
    }

    // ─── Build line items with VAT breakdown ───
    const vatResult = await buildReceiptLineItems(saleItems, tenantId);

    // ─── Generate sequential receipt number ───
    const receiptNumber = await generateReceiptNumber(tenantId);

    // ─── Store VAT receipt ───
    const now = new Date().toISOString();
    const itemsJson = JSON.stringify(vatResult.lines);

    const created = await pgQueryOne<any>(
      `INSERT INTO "VATReceipt" (
        "tenantId", "receiptNumber", "saleId", "saleNumber", status,
        "issuedAt", "businessName", "businessAddress", "birNumber", "tin", "vatRegistrationNumber",
        "customerName", "paymentMethod", currency, items,
        subtotal, "totalVAT", "grandTotal",
        "standardSubtotal", "standardVAT", "exemptSubtotal", "zeroRatedSubtotal",
        notes, "createdAt", "updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING *`,
      [
        tenantId, receiptNumber, sale?.id || null, saleNumber, data.status || 'issued',
        now, tenant.name, tenant.address || '', birNumber, tin, vatRegistrationNumber,
        customerName, paymentMethod, currency, itemsJson,
        vatResult.subtotal, vatResult.totalVAT, vatResult.grandTotal,
        vatResult.standardSubtotal, vatResult.standardVAT, vatResult.exemptSubtotal, vatResult.zeroRatedSubtotal,
        data.notes || null, now, now,
      ]
    );

    if (!created) {
      return NextResponse.json({ error: 'Failed to create VAT receipt' }, { status: 500 });
    }

    // ─── Build formatted response ───
    const formatted = formatReceipt(
      {
        ...created,
        _vatBreakdown: {
          standardSubtotal: vatResult.standardSubtotal,
          standardVAT: vatResult.standardVAT,
          exemptSubtotal: vatResult.exemptSubtotal,
          zeroRatedSubtotal: vatResult.zeroRatedSubtotal,
        },
      },
      tenant,
      vatResult.lines
    );

    return NextResponse.json({
      receipt: created,
      formatted,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[vat-receipts] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
