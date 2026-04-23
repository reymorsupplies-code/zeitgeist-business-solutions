# Task ID: 2 — Property Rental T&T Compliance API Routes

## Agent: Main Agent
## Status: Completed

---

## Summary

Created 3 new production-ready Next.js API route files for Property Rental T&T compliance, plus added 3 Prisma models to the schema.

---

## Files Created

### 1. `/src/app/api/platform/security-deposits/route.ts`
Full CRUD for SecurityDeposit model with:
- **GET**: List deposits with filters (leaseId, propertyId, status, tenantId, includeOverdue). Computes `pastReturnDeadline` flag and `daysUntilDeadline` for each deposit. Supports filtering only overdue deposits.
- **POST**: Create deposit with T&T compliance validation — deposit must not exceed 1 month's rent. Auto-sets `returnDeadline = vacateDate + 14 days` (or lease.endDate + 14 days as fallback). Returns 422 with compliance details on violation.
- **PATCH**: Process deposit return — validates that `returnedAmount + deductionTotal <= amount`. Auto-transitions status (held → partially_returned → fully_returned). Supports deduction details/receipts as JSON arrays.
- **DELETE**: Soft removal of deposit record.

### 2. `/src/app/api/platform/inspections/route.ts`
Full CRUD for PropertyInspection model with:
- **GET**: List inspections with filters (propertyId, unitId, leaseId, type, status, dateFrom, dateTo). Supports `?template=move_in` or `?template=move_out` to retrieve blank checklist templates without creating a record.
- **POST**: Create inspection with auto-generated checklist for move_in/move_out types. Template covers 8 areas: walls, floors, doors_windows, kitchen, bathroom, electrical, plumbing, general (55+ individual items). Supports custom checklist items that merge with template.
- **PATCH**: Update inspection, record checklist results, sign-off by tenant and landlord. Auto-promotes status to 'signed' when both parties sign off. Validates overallScore between 1-10.
- **DELETE**: Remove inspection record.

### 3. `/src/app/api/platform/legal-notices/route.ts`
Full CRUD for LegalNotice model with:
- **GET**: List notices with filters (leaseId, propertyId, type, status, jurisdiction).
- **POST**: Create notice from T&T template. Supports 6 notice types:
  - `rent_increase` — 30 days notice with Rent Restriction Act (Ch. 59:51) reference
  - `lease_renewal` — Land Tenants Act (Ch. 59:54) reference
  - `lease_termination` — 28 days notice for month-to-month
  - `eviction` — Court-ordered process with Constitutional rights reference
  - `late_payment` — Reminder with grace period, Rent Restriction Act reference
  - `vacate_notice` — Move-out instructions with deposit return timeline
  - `POST ?generate=true` — Auto-generate notices for leases expiring within configurable window (default 60 days). Skips leases that already have pending notices of the same type. Auto-fills recipient info from lease data.
- **PATCH**: Update notice status, record response. Validates status transitions. Auto-sets issuedDate on send, auto-sets responseDate when response recorded.
- **DELETE**: Remove notice record.

---

## Prisma Schema Changes

Added 3 models to `/prisma/schema.prisma`:
- `SecurityDeposit` — with relations to Lease, Property, PropertyUnit, Tenant
- `PropertyInspection` — with relations to Property, PropertyUnit (optional), Lease (optional), Tenant (optional)
- `LegalNotice` — with relations to Lease (optional), Property (optional), PropertyUnit (optional), Tenant (optional)

Also added reverse relation fields (`deposits`, `inspections`, `legalNotices`) to `Property`, `PropertyUnit`, and `Lease` models.

**Note**: `db push` could not be executed because `DIRECT_URL` env var is not set (Supabase not configured in sandbox). Tables will need to be created via Supabase SQL Editor using the generated schema. The SQL should match the Prisma model definitions added.

---

## Conventions Followed
- Uses `import { db } from '@/lib/db'` (singleton PrismaClient per project hotfix)
- Uses `import { pgQuery } from '@/lib/pg-query'` available if needed
- All responses use `NextResponse.json()` with proper HTTP status codes
- Error handling with try/catch, returns `{ error: message }` on failure
- Uses `NextRequest`/`NextResponse` from `next/server`
- PATCH uses `?id=` search param pattern matching existing routes
- No new `PrismaClient()` instances created (follows 42P05 fix)
- Zero lint errors on all 3 new files
