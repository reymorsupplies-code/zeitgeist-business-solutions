# Task 4: Bakery Food Safety API Routes

**Agent:** Main Agent  
**Status:** Completed

## Work Done

### 1. Prisma Schema Updates
- Added 7 new food safety models to `prisma/schema.prisma`:
  - `HACCPPlan` — HACCP plans with critical limits, status, approval workflow
  - `HACCPRiskLog` — Risk monitoring entries linked to HACCP plans
  - `AllergenDeclaration` — Allergen declarations with severity, status, review
  - `FoodHandlerRegistration` — Food handler certificates with expiry tracking
  - `HealthInspection` — Health inspection records with violations and corrective actions
  - `TemperatureLog` — Temperature monitoring with auto-evaluation
  - `CleaningSanitationLog` — Cleaning task logs with scheduling
- Added corresponding relations to the `Tenant` model
- Removed duplicate model definitions that were present in the schema

### 2. API Route Files Created

#### FILE 1: HACCP (`/api/tenant/[tenantId]/haccp/route.ts`)
- **GET** with `?action=dashboard`: Summary stats (active plans, out-of-limit alerts, upcoming reviews)
- **GET** with `?action=risk-logs`: List risk logs with filters (planId, isWithinLimit, date range)
- **GET** default: List HACCP plans with risk log count, filter by status/productCategory
- **POST** default: Create HACCP plan with auto nextReviewDate (12 months)
- **POST** with `action=risk-log`: Log risk monitoring entry, auto-validate against critical limits
- **PATCH** with `action=approve`: Approve a plan (sets approvedBy, approvedAt)
- **PATCH** with `action=risk-log`: Update a risk log entry
- **PATCH** default: Update HACCP plan fields
- **DELETE**: Soft-delete plan

#### FILE 2: Allergens (`/api/tenant/[tenantId]/allergens/route.ts`)
- **GET** with `?action=report`: Allergen matrix (products vs allergens cross-reference)
- **GET** with `?action=check-recipe&recipeId=X`: Check allergens for specific recipe
- **GET** default: List declarations, filter by recipeId, ingredientId, allergenType
- **POST**: Create declaration with allergen type validation against T&T common allergens
- **PATCH** with `action=review`: Review and approve declaration
- **PATCH** default: Update declaration fields
- **DELETE**: Soft-delete

#### FILE 3: Food Handlers (`/api/tenant/[tenantId]/food-handlers/route.ts`)
- **GET** with `?action=compliance-status`: % registered, % valid certificates
- **GET** with `?action=expiry-alerts`: Registrations expiring within 30 days or expired
- **GET** default: List registrations, filter by status
- **POST**: Register handler with validation (registrationNumber, expiryDate required, future date)
- **PATCH** with `action=suspend|expire|reactivate`: Status transitions
- **PATCH** default: Update fields
- **DELETE**: Soft-delete

#### FILE 4: Health Inspections (`/api/tenant/[tenantId]/health-inspections/route.ts`)
- **GET** with `?action=violation-summary`: Aggregate by category, severity, resolution rate
- **GET** with `?action=upcoming`: Inspections within 30 days
- **GET** default: List with filters, enriched with violation stats
- **POST**: Create inspection with violations/corrective actions as JSON
- **PATCH** with `action=resolve-violation`: Mark specific violation as resolved
- **PATCH** with `action=add-corrective-action`: Append corrective action
- **PATCH** with `action=complete-action`: Mark corrective action as completed
- **DELETE**: Soft-delete

#### FILE 5: Temperature Logs (`/api/tenant/[tenantId]/temperature-logs/route.ts`)
- **GET** with `?action=equipment-setup`: Safe ranges by equipment type
- **GET** with `?action=daily-summary`: All equipment readings for a date, grouped with stats
- **GET** with `?action=alerts`: Out-of-range logs grouped by equipment
- **GET** default: List with filters (equipmentType, isWithinRange, date range)
- **POST**: Log reading, auto-evaluate isWithinRange from equipment defaults, return alert if out of range
- **PATCH**: Update log with auto re-evaluation
- **DELETE**: Hard delete

#### FILE 6: Cleaning Logs (`/api/tenant/[tenantId]/cleaning-logs/route.ts`)
- **GET** with `?action=daily-report`: Scheduled vs completed vs missed for a date
- **GET** with `?action=compliance`: Completion rate by area, highlight missed tasks
- **GET** with `?action=schedule`: Generate cleaning schedule by frequency
- **GET** default: List with filters (area, frequency, status, date range)
- **POST**: Log cleaning task completion
- **PATCH**: Update log entry
- **DELETE**: Soft-delete

### 3. Patterns Followed
- Uses `pgQuery`/`pgQueryOne` from `@/lib/pg-query` for all database operations (consistent with existing codebase)
- Auto-creates tables via SQL DDL on first request (no db push needed)
- Auth guards: `authenticateRequest` + `verifyTenantAccess` on all endpoints
- Error handling: try/catch with proper HTTP status codes
- Query parameters for action routing (action=something pattern)
- JSON fields stored as TEXT with parse/stringify helpers
