# Production Hotfix: 42P05 "prepared statement already exists"

**Date:** 2025-01-01
**Severity:** Critical — all Prisma-dependent pages broken in production

## Root Cause
Multiple PrismaClient instances competing for the same PgBouncer connection pool,
causing stale prepared statements on recycled connections (error 42P05).

## Fixes Applied

### Bug 1 & 2 — `src/lib/db.ts` (PrismaClient singleton & PgBouncer compat)
- Changed singleton caching from `if (process.env.NODE_ENV !== 'production')` to `if (!globalForPrisma.prisma)` — now caches in ALL environments
- Added `datasourceUrl: process.env.DATABASE_URL` to PrismaClient constructor for PgBouncer compatibility

### Bug 3 — 5 API routes bypassing singleton
Each file was creating its own `const prisma = new PrismaClient()` instead of importing the shared singleton:
- `src/app/api/platform/property-documents/route.ts` — replaced with `import { db } from '@/lib/db'`
- `src/app/api/platform/journal-entries/route.ts` — replaced with `import { db } from '@/lib/db'`
- `src/app/api/platform/rent-payments/generate/route.ts` — replaced with `import { db } from '@/lib/db'`
- `src/app/api/platform/rent-payments/route.ts` — replaced with `import { db } from '@/lib/db'`
- `src/app/api/platform/vendors/route.ts` — replaced with `import { db } from '@/lib/db'`

All `prisma.` references replaced with `db.` in each file.

### Bug 4 — Tenant creation UI error swallowing (`src/app/page.tsx`)
- `handleCreate` now wraps the API call in try/catch
- Checks `res.ok` before proceeding
- Parses error from response body for meaningful error messages
- Shows `toast.error()` on failure instead of always showing success

### Bug 5 — Full codebase audit
- Searched entire `src/` directory for `new PrismaClient`
- Confirmed only one instance remains: `src/lib/db.ts` (the singleton)

## Verification
- `npx tsc --noEmit` — **0 errors**

---
Task ID: 1
Agent: Main Agent
Task: Enable db-init endpoint and provide SQL for Supabase database initialization

Work Log:
- Found that /api/db-init was blocked by middleware (not in PUBLIC_ROUTES)
- Temporarily added /api/db-init to PUBLIC_ROUTES, committed and pushed
- User requested SQL directly instead of using the endpoint
- Generated complete SQL file (52 tables + 21 indexes) from route.ts createStatements
- Saved to /home/z/my-project/download/zbs-schema.sql
- Removed /api/db-init from PUBLIC_ROUTES again for security, committed (1f5dae7)
- User executed SQL in Supabase SQL Editor — SUCCESS, all tables created

Stage Summary:
- Database initialization complete via Supabase SQL Editor
- All 52 ZBS tables + 21 indexes created successfully
- db-init endpoint re-secured in middleware
- Ready for production verification of Pastelería Control Tower

---
Task ID: 1
Agent: Main Agent (4 parallel subagents)
Task: Add T&T and Caribbean legal compliance models and API routes for Property Rental, Retail POS, and Bakery

Work Log:
- Added 11 new Prisma compliance models to schema.prisma
- Added reverse relation fields to Property, PropertyUnit, Lease, and Tenant models
- Created 3 Property Rental compliance API routes
- Created 2 Retail VAT compliance API routes
- Created 6 Bakery food safety API routes
- Generated Prisma client successfully

Stage Summary:
- **11 New Prisma Models**: SecurityDeposit, PropertyInspection, LegalNotice, VATReturn, HACCPPlan, HACCPRiskLog, AllergenDeclaration, FoodHandlerRegistration, HealthInspection, TemperatureLog, CleaningSanitationLog
- **11 New API Routes**:
  - /api/platform/security-deposits (CRUD + T&T deposit validation)
  - /api/platform/inspections (CRUD + move-in/move-out templates)
  - /api/platform/legal-notices (CRUD + T&T legal templates + auto-generation)
  - /api/tenant/[tenantId]/vat-compliance (VAT assessment + quarterly returns)
  - /api/tenant/[tenantId]/vat-receipts (BIR-compliant receipts)
  - /api/tenant/[tenantId]/haccp (HACCP plans + risk monitoring)
  - /api/tenant/[tenantId]/allergens (allergen declarations + matrix)
  - /api/tenant/[tenantId]/food-handlers (registration + expiry alerts)
  - /api/tenant/[tenantId]/health-inspections (inspections + violations)
  - /api/tenant/[tenantId]/temperature-logs (monitoring + alerts)
  - /api/tenant/[tenantId]/cleaning-logs (schedule + compliance)
- **T&T Legal Compliance Features**: Rent Restriction Act, Land Tenants Act Ch.59:54, BIR VAT 12.5%, 14-day deposit return, 28-day notice periods
- **Food Safety Features**: HACCP plans, allergen tracking, food handler registration, health inspections, temperature monitoring, cleaning schedules
