# Zeitgeist Business Solutions

**The Digital Building for Every Industry**

Enterprise-grade multi-tenant SaaS platform built for Caribbean businesses. Each industry gets its own specialized "apartment" with tailored tools — from bakeries to law firms, salons to clinics.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui + Framer Motion
- **State**: Zustand
- **Database**: Prisma ORM → Supabase PostgreSQL
- **Auth**: Supabase Auth + Google OAuth
- **Payments**: WiPay (Caribbean)
- **Deploy**: Vercel + GitHub
- **i18n**: English / Español

## Industries

| Industry | Slug | Status |
|----------|------|--------|
| Bakery & Pastry | `bakery` | In Progress |
| Salon & Spa | `salon-spa` | In Progress |
| Clinic & Healthcare | `clinics` | Planned |
| Legal Services | `legal` | Planned |
| Insurance | `insurance` | Planned |
| Retail | `retail` | Planned |
| Events & Hospitality | `events` | Planned |
| Professional Services | `professional` | Planned |

## Plans

| Plan | USD/mo | TTD/mo | Users | Branches |
|------|--------|--------|-------|----------|
| Starter Suite | $75 | TT$500 | 3 | 1 |
| Growth Engine | $180 | TT$1,200 | 10 | 3 |
| Premium Elite | $375 | TT$2,500 | 50 | 10 |

All plans include a 7-day free trial.

## Getting Started

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env

# Generate Prisma client
bun run db:generate

# Push database schema
bun run db:push

# Seed demo data
bun run db:seed

# Start development server
bun run dev
```

## Environment Variables

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
WIPAY_API_KEY="..."
```

## Demo Credentials

- **Super Admin**: admin@zeitgeist.com / admin123
- **Tenant Admin**: demo@bakery.com / demo123

## Project Structure

```
src/
├── app/
│   ├── page.tsx          ← Main SPA (all views)
│   ├── layout.tsx        ← Root layout
│   ├── globals.css       ← Deep electric blue theme
│   └── api/
│       ├── auth/         ← Authentication
│       ├── platform/     ← Admin APIs
│       ├── seed/         ← Database seeding
│       └── tenant/       ← Tenant APIs
├── components/ui/        ← shadcn/ui components
├── hooks/                ← Custom hooks
└── lib/
    ├── store.ts          ← Zustand store
    ├── constants.ts      ← Plan features & helpers
    ├── i18n.ts           ← Translations
    ├── currencies.ts     ← Caribbean currencies
    ├── db.ts             ← Prisma client
    └── utils.ts          ← Utilities
prisma/
└── schema.prisma         ← 25+ models
```

## Caribbean Currencies

TTD (Trinidad & Tobago), JMD (Jamaica), BBD (Barbados), BZD (Belize), GYD (Guyana), USD, EUR, GBP

## License

UNLICENSED — All rights reserved.
