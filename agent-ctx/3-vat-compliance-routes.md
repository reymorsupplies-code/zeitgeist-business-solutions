# Task ID: 3 — Retail VAT Compliance API Routes (Trinidad & Tobago BIR)

## Summary
Created two production-ready API routes for T&T BIR VAT compliance and a Prisma schema enhancement.

## Files Created

### 1. `/home/z/my-project/src/app/api/tenant/[tenantId]/vat-compliance/route.ts`
**GET** — VAT Compliance Status Assessment
- Calculates tenant's annual revenue from completed POS sales
- Checks against T&T thresholds: VAT registration at TT$500,000/yr, Business Levy at TT$360,000/yr
- Reads tenant settings for BIR number, TIN, VAT registration number
- Returns compliance status: `compliant`, `needs_registration`, `needs_filing`, `overdue`
- Checks existing VAT returns for filing status and overdue detection
- Includes quarterly revenue breakdown and projected annual revenue
- Returns alerts and actionable recommendations

**POST** — Generate Quarterly VAT Return
- Accepts `year` and `quarter` (1–4) parameters
- Fetches all completed POS sales within the quarter
- Enriches each sale line item with VAT category from product settings
- Calculates per-sale and aggregate: totalSalesExVAT, totalVATCollected (12.5%), totalVATPaid on purchases, net vatDue or vatRefund
- Breaks down by VAT category: standard (12.5%), exempt (0%), zero_rated (0%)
- Auto-creates `VATReturn` table via pgQuery (idempotent DDL)
- Supports `forceRegenerate` to overwrite existing returns
- Returns full breakdown with per-sale detail and BIR filing deadline

### 2. `/home/z/my-project/src/app/api/tenant/[tenantId]/vat-receipts/route.ts`
**GET** — BIR-Compliant VAT Receipt Generation
- Generate from existing sale (`saleId` or `saleNumber`) → preview format
- Retrieve existing receipt (`receiptId` or `receiptNumber`)
- List tenant's VAT receipts with pagination
- Receipt includes: BIR header, sequential receipt number, per-line VAT breakdown, category totals, amount in words, BIR disclaimers

**POST** — Create New VAT Receipt
- Two modes: from existing saleId or from inline items array
- Auto-assigns sequential receipt number: `VR-YYYY-NNNNN`
- Validates required BIR fields (BIR number, TIN, VAT registration number) → returns 422 if missing
- Detects duplicate receipts for same sale (returns 409)
- Stores in `VATReceipt` table (auto-created via idempotent DDL)
- Returns both raw record and formatted BIR-compliant receipt

## Schema Enhancement

### `prisma/schema.prisma` — RetailProduct model
Added `settings String @default("{}")` field to support per-product VAT category storage (e.g., `{"vatCategory": "exempt"}`). Note: `db:push` could not run locally (missing DIRECT_URL env var), but the code handles the missing column gracefully via try/catch in pgQuery.

## Key Design Decisions
- Used `pgQuery`/`pgQueryOne` for VATReturn and VATReceipt tables (not in Prisma schema — avoids migration complexity)
- Both tables are created lazily via idempotent `CREATE TABLE IF NOT EXISTS`
- Product VAT categories read from `RetailProduct.settings` JSON column
- Sequential receipt numbers use MAX() query pattern with retry safety
- Number-to-words function for receipt total (TTD amounts)
- All routes use auth guards (`authenticateRequest` + `verifyTenantAccess`) and rate limiting
- Zero TypeScript errors, zero ESLint errors on both files
