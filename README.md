# Brightloop — Subscription Management & Recurring Billing Platform

Brightloop is a production-grade Subscription Management and Recurring Billing Monolith built with Next.js App Router, TypeScript, Tailwind CSS v4, and Supabase PostgreSQL.

---

## Architecture Overview

Brightloop follows a **modular monolithic architecture** designed for strict domain boundary isolation and high financial integrity:

```
src/
├── app/                  # Next.js App Router pages and layouts
├── components/
│   ├── layout/           # Dashboard shell, header, sidebar
│   └── ui/               # Reusable atomic UI foundation components
├── config/               # Navigation, routes, and global configuration
├── lib/
│   ├── supabase/         # Official Supabase SSR (client, server, middleware, admin)
│   └── utils.ts          # Financial formatting, date parsers, class merger
├── modules/              # Domain-specific business modules
│   ├── analytics/        # MRR, ARR, churn, and cash flow ledger
│   ├── auth/             # Supabase SSR auth, user profiles, RBAC
│   ├── billing/          # Automated recurring billing engine
│   ├── customers/        # Customer records and billing addresses
│   ├── discounts/        # Promotions, coupons, and redemption ledgers
│   ├── invoices/         # Invoice generation and lifecycle
│   ├── payments/         # Payment processing and multi-invoice allocations
│   ├── products/         # Products, variants, plans, and plan rules
│   ├── quotations/       # Quotes and subscription conversion pipeline
│   ├── subscriptions/    # Subscription lifecycles and historical periods
│   └── taxes/            # Jurisdiction tax rates and snapshots
└── types/                # Global domain and database typings
```

---

## Core Technologies

- **Framework:** Next.js (App Router)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4 + Vanilla CSS Variables
- **Database & Auth:** Supabase PostgreSQL & Supabase SSR
- **Validation:** Zod
- **Icons:** Lucide React

---

## Mandatory Engineering Rules

1. **Server-Authoritative Finances:** All prices, discounts, taxes, and totals are computed strictly on the server. Never trust frontend-supplied financial totals.
2. **Financial Precision:** All monetary amounts are stored as `NUMERIC(14,2)` in PostgreSQL.
3. **Historical Snapshots:** Invoices and quotation items preserve point-in-time price, discount, and tax snapshots.
4. **Security & RLS:** Row Level Security (RLS) is enabled on all tables. Supabase service role keys are strictly prohibited in browser code.
5. **No Cross-Module Coupling:** Each business module in `src/modules/*` maintains independent data access and business logic.

---

## Getting Started

### 1. Prerequisites
- Node.js 18.17+ or 20+
- Supabase account or local Supabase CLI instance

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase connection credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Migrations
Run the SQL migration files located in `supabase/migrations/` using the Supabase Dashboard SQL Editor or Supabase CLI:
```bash
supabase db push
# or run supabase/migrations/20261031000000_initial_schema.sql
```
Apply the seed data:
```bash
# Run supabase/seed.sql
```

### 5. Launch the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Typechecks and builds the production bundle.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs ESLint across the codebase.
