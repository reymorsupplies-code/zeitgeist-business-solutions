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
