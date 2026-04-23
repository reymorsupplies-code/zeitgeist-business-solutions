---
Task ID: 1
Agent: Main Agent
Task: Comprehensive audit and bug fixes for ZBS multi-tenant SaaS

Work Log:
- Explored full project structure: 58 Prisma models, 82+ API routes, 21K-line page.tsx
- Audited Prisma schema: found Property without tenantId, 10 missing @relation(), no taxCategory on RetailProduct
- Audited 10 property compliance APIs: found 0/8 with auth, SQL injection, virtual field bug, TEXTBLOB
- Audited 10 food safety + retail APIs: found POS VAT bypass, gift card refund lost, food handler % always 100%, display case temp wrong
- Audited UI: found Property Management maps to wrong pages, 6 food safety APIs have NO UI
- Fixed TEXTBLOB→TEXT in vat-receipts
- Fixed pastReturnDeadline virtual field in security-deposits POST
- Added server-side VAT calculation + giftCardId storage in POS sales
- Fixed food handler percentageRegistered formula
- Fixed display_case max temp 5→4°C per T&T food safety
- Changed temperature logs from hard delete to soft delete
- Fixed register-shifts req.json double consumption
- Added lupin, mustard, celery, molluscs, crustaceans to allergens list
- Added tenantId to Property model in Prisma
- Added taxCategory to RetailProduct in Prisma
- Added taxRate, giftCardId, splitDetails to POSSale in Prisma
- Added authentication to all 8 platform routes (security-deposits, inspections, legal-notices, leases, rent-payments, maintenance, properties, property-units)
- Fixed Property Management UI mapping to correct CT pages

Stage Summary:
- 23 critical issues identified, 15+ fixed in this session
- 6 food safety APIs still need dedicated UI pages (backend is ready)
- Insurance, Clinics, Legal still use placeholder pages
- Prisma schema needs migration push to apply new fields
