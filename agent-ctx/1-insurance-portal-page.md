# Insurance Client Portal Page — Work Record

## Task
Create the Insurance Client Portal page for ZBS, a self-service portal for policyholders.

## What Was Done

### 1. Created `/home/z/my-project/src/components/pages/InsurancePortalPage.tsx`
Complete, functional portal page (~730 lines of actual logic) with:

- **Login Screen**: Clean centered card with token input, company branding, authentication via POST to `/api/portal/insurance/auth`
- **Portal Header**: Welcome message with name, masked National ID badge, tab navigation, exit button
- **Policies Tab**: Summary cards (Total, Active, Coverage, Open Claims), expandable policy list with details (product, agent, premium summary, claims count)
- **Claims Tab**: Claims table with status/priority badges, "File New Claim" button, detail dialog
- **File New Claim Dialog**: Policy selector (active only), type/priority dropdowns, amount, description, incident date, location, police report
- **Claim Detail Dialog**: Full info grid, financial summary, description, notes (non-internal only), documents list with upload, activity timeline
- **Document Upload Dialog**: File picker, category selector, description, FormData upload
- **Premiums Tab**: Summary (Total Due/Paid/Outstanding), schedule table with status badges
- **Profile Tab**: Read-only personal info (name, national ID, DOB, gender), editable contact info (email, phone, address, city, occupation, employer), update button

### 2. Updated `/home/z/my-project/src/lib/store.ts`
- Added `'insurance_portal'` to `ViewMode` type

### 3. Updated `/home/z/my-project/src/app/page.tsx`
- Added import for `InsurancePortalPage`
- Added rendering: `{view === 'insurance_portal' && <InsurancePortalPage key="insurance-portal" />}`
- Added URL param detection: `?insurance_portal=true` triggers the view

## Portal API Integration
All API calls use the portal token pattern:
- **GET requests**: `?token=xxx` as query parameter
- **POST/PATCH**: `token` in JSON body (except FormData uploads which use `formData.append('token', ...)`)

Endpoints used:
- `POST /api/portal/insurance/auth` — authenticate
- `GET /api/portal/insurance/[insuredId]/policies?token=xxx`
- `GET /api/portal/insurance/[insuredId]/claims?token=xxx`
- `POST /api/portal/insurance/[insuredId]/claims` — file claim
- `GET /api/portal/insurance/[insuredId]/claims/[claimId]?token=xxx` — detail
- `POST /api/portal/insurance/[insuredId]/claims/[claimId]/documents` — upload (FormData)
- `GET /api/portal/insurance/[insuredId]/premiums?token=xxx`
- `GET /api/portal/insurance/[insuredId]/profile?token=xxx`
- `PATCH /api/portal/insurance/[insuredId]/profile` — update profile

## Patterns Followed
- Uses `useState`, `useEffect`, `useCallback` React hooks (same as existing insurance pages)
- Uses `toast` from `sonner` (same as InsurancePoliciesPage, InsuranceClaimsPage)
- Uses shadcn/ui components (Card, Badge, Dialog, Select, Tabs, Table, etc.)
- Uses lucide-react icons
- Status color maps consistent with existing claims/policies pages
- `portalFetch` helper replaces `authFetch` for token-based auth

## Access
Portal is accessible via `?insurance_portal=true&token=<portal_token>` URL params.
The `insurance_portal=true` param triggers the view mode, while `token` is consumed by the portal component for authentication.
