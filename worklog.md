# Worklog: Retail Fase 2 — Register Shift / Shift Management (Cierre de Caja)

## Date: $(date -u +%Y-%m-%d)

## Summary
Implemented the full Daily Register Close / Shift Management feature for the ZBS Retail module, including Prisma model, API route, i18n translations (EN/ES), and a comprehensive UI component.

## Files Modified

### 1. Prisma Schema (`prisma/schema.prisma`)
- Added `RegisterShift` model with all required fields:
  - id, tenantId, shiftNumber, staffName, staffId
  - openedAt, closedAt, status (open/closed)
  - startingCash, closingCash, expectedCash, discrepancy
  - cashSales, cardSales, transferSales, totalSales
  - totalRefunds, giftCardSales, layawayDeposits
  - transactionCount, refundCount
  - notes, isDeleted, createdAt, updatedAt
- Added `registerShifts` relation to `Tenant` model
- Ran `npx prisma generate` successfully

### 2. API Route (`src/app/api/tenant/[tenantId]/register-shifts/route.ts`)
- **GET**: List shifts with filters (status, date range, staffName). Returns summary stats when status=open.
- **POST**: Open new shift — auto-generates shiftNumber (SHIFT-00001), requires startingCash and staffName. Prevents duplicate open shifts (409).
- **PUT**: Close shift — aggregates POS sales by payment method (cash/card/transfer), calculates expectedCash, discrepancy. Also supports updating notes.
- **DELETE**: Soft delete for closed shifts only.
- Follows existing API pattern with Prisma + pgQuery fallback.

### 3. i18n Keys (`src/lib/i18n.ts`)
- Added 53 translation keys under `shift.*` prefix in both English and Spanish sections.
- Keys cover: title, subtitle, open/close shift, shift number, staff, dates, cash amounts, discrepancy, payment types, status labels, toast messages, search/filter, dialog labels.

### 4. UI Component (`src/app/page.tsx`)
- **TenantRegisterPage()** — Full-featured register shift management page with:
  - **Active shift banner**: Shows live pulse indicator, elapsed time, starting cash, and close button
  - **Summary stat cards**: Total sales, cash sales, card sales, transaction count
  - **Filters**: Search by shift#/staff, status filter (all/open/closed)
  - **History table**: shiftNumber, staff, status, opened/closed times, starting cash, total sales, discrepancy badge
  - **Open shift dialog**: Staff name, staff ID, starting cash amount
  - **Close shift dialog**: Summary card, counted cash input, auto-calculated expected cash, notes
  - **Shift detail dialog**: Full breakdown with 6 payment type cards, totals, counts, closing cash comparison (calculated vs actual vs difference)
  - **Discrepancy highlighting**: Green (perfect=0), amber (≤5), red (>5)
  - **Multi-currency support**: Uses tenant currency via formatCurrency()

### 5. Store (`src/lib/store.ts`)
- Added `'register'` to `TenantPage` union type

### 6. Navigation (`src/app/page.tsx`)
- Added "Register / Shift Management" entry to `getRetailNav()` under Operations section
- Added `case 'register': return <TenantRegisterPage />` in page switch

## Verification
- TypeScript: `npx tsc --noEmit` — 0 errors ✅
- Prisma generate: successful ✅
- ESLint: Pre-existing warnings (not related to this change)

## Architecture Decisions
- Used `shift.*` i18n prefix instead of `register.*` to avoid collision with existing `register.title`/`register.subtitle` keys used for the registration page
- API uses Prisma ORM as primary with pgQuery raw SQL fallback for resilience
- Close shift aggregates from POSSale, Return, Layaway, and GiftCard tables
- discrepancy = closingCash - expectedCash (where expectedCash = startingCash + cashSales - totalRefunds)
- Auto-shift number format: SHIFT-00001, SHIFT-00002, etc.
