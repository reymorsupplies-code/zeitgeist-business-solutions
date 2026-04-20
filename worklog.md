# ZBS Production Bug Fix Worklog

## Date: 2025-01-28

## Summary
Fixed 12 critical production bugs across UI components, POS logic, register shift formulas, and i18n coverage.

---

## Fix 1: Held Sales Dialog Cannot Be Dismissed
**File:** `src/app/page.tsx`
- Added `showHeldSales` state variable
- Changed dialog `open` prop from `heldSales.length > 0` to `showHeldSales`
- Changed dialog `onOpenChange` from `() => {}` to `setShowHeldSales`
- Updated Held Sales button `onClick` to `setShowHeldSales(true)`

## Fix 2: Cart Can Exceed Stock in POS
**File:** `src/app/page.tsx`
- Rewrote `addToCart` to check existing cart quantity against available stock before adding
- Rewrote `updateQty` to validate against product stock before updating
- Both functions now show `toast.error(pos.outOfStock)` when stock limit would be exceeded

## Fix 3: Returns Max Qty Validation
**File:** `src/app/page.tsx`
- Changed return item quantity `max` prop from `item.qty || 99` to `item.qty || 0`
- Changed `onChange` min calculation from `item.qty || 99` to `item.qty || 0`

## Fix 4: i18n Missing Locale Parameter
**File:** `src/app/page.tsx`
- Fixed `t('returns.originalSale')` → `t('returns.originalSale', locale)` in Returns page

## Fix 5: Added Missing i18n Keys
**File:** `src/lib/i18n.ts` (both en and es)
- `pos.saleHeld`: "Sale held successfully" / "Venta en espera guardada"
- `pos.outOfStock`: "Out of stock" / "Sin stock"
- `common.confirmDelete`: Delete confirmation string
- `layaway.noPayments`: "No payments recorded." / "No hay pagos registrados."
- `layaway.item` / `layaway.items_count`: singular/plural for item counts
- `retailInv.moreAlerts`: "+{n} more" pattern
- `shift.optionalNotes`: "Optional notes..." / "Notas opcionales..."
- `returns.walkIn`: "Walk-in" / "Mostrador"
- `returns.date`: "Date" / "Fecha"

## Fix 6: JSON.parse Safety in Render
**File:** `src/app/page.tsx`
- Wrapped `JSON.parse(l.items)` in Layaways list with try-catch fallback to `[]`
- Wrapped `JSON.parse(l.items)` and `JSON.parse(l.payments)` in Layaways detail dialog with try-catch
- Wrapped `JSON.parse(ret.items)` in Returns page with try-catch

## Fix 7: Register Shift Expected Cash Formula
**File:** `src/app/api/tenant/[tenantId]/register-shifts/route.ts`
- Changed `expectedCash = startingCash + cashSales - totalRefunds` to use `cashRefunds` instead
- Added separate aggregation query for cash-only refunds (`refundMethod: 'cash'`)
- Fixed in both Prisma ORM path and raw SQL fallback path

## Fix 8: Register Shift Refunds Status Filter
**File:** `src/app/api/tenant/[tenantId]/register-shifts/route.ts`
- Added `status: { in: ['approved', 'completed'] }` filter to refund aggregation queries
- Applied to both Prisma ORM and raw SQL paths

## Fix 9: Confirmation Dialogs for Delete Actions
**File:** `src/app/page.tsx`
- Added `if (!confirm(t('common.confirmDelete', locale))) return;` to `TenantSuppliersPage.handleDelete`
- Added same confirmation to `TenantReturnsPage.handleDelete`

## Fix 10: Hardcoded Cancel Buttons
**File:** `src/app/page.tsx`
- PO Create dialog: `Cancel` → `t('common.cancel', locale)`
- PO Receive dialog: `Cancel` → `t('common.cancel', locale)`

## Fix 11: Hardcoded Strings in Various Components
**File:** `src/app/page.tsx`
- Inventory: `+${lowStockItems.length - 10} more` → `t('retailInv.moreAlerts', locale)`
- Returns: `'Walk-in'` → `t('returns.walkIn', locale)`
- Layaways: `'item'/'items'` → `t('layaway.item', locale)` / `t('layaway.items_count', locale)`
- Inventory movements: `<TableHead>Date</TableHead>` → `t('common.date', locale)`
- Layaways: `"No payments recorded."` → `t('layaway.noPayments', locale)`
- Register: `"Optional notes..."` → `t('shift.optionalNotes', locale)`
- Returns table: `"Date"` column header → `t('returns.date', locale)`

## Fix 12: POS Receipt ID from Server
**File:** `src/app/page.tsx`
- Changed from discarding API response to storing it
- Receipt now uses `result.saleNumber` from server response, with fallback to client-generated ID

## Verification
- TypeScript compilation: 0 errors (`npx tsc --noEmit`)
