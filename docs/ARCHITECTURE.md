# Brightloop Architecture Specification

Brightloop is an enterprise-grade Subscription Lifecycle Management and Recurring Billing Monolith. This document outlines the architectural blueprints for all engineers collaborating on the platform.

---

## 1. High-Level Architectural Paradigm: Modular Monolith

Brightloop adopts a **Modular Monolithic** structure rather than distributed microservices or an unstructured codebase:

```
src/
├── app/                  # Next.js App Router (Layouts, routes, route handlers)
├── components/
│   ├── auth/             # Permission gates (<Can />) and auth context
│   ├── layout/           # DashboardShell, Sidebar, Header, Breadcrumbs
│   └── ui/               # 12 Atomic design system foundations
├── config/               # Navigation, metadata, route permissions
├── lib/
│   ├── api-response.ts   # Standardized ApiSuccess / ApiError contracts
│   ├── supabase/         # Official Supabase SSR (client, server, middleware, admin)
│   └── utils.ts          # Financial formatting, date parsers, cn merger
├── modules/              # 11 Autonomous Business Domain Modules + _template
│   ├── _template/        # Reference module implementation
│   ├── analytics/        # MRR, ARR, churn, cash flow metrics
│   ├── auth/             # Supabase Auth, profiles, RBAC, password policies
│   ├── billing/          # Automated recurring billing engine
│   ├── customers/        # Customer records and billing addresses
│   ├── discounts/        # Promotions, coupons, and redemption ledgers
│   ├── invoices/         # Invoices, snapshot items, PDF rendering
│   ├── payments/         # Payment gateways and multi-invoice allocations
│   ├── products/         # Products, variants, plans, and quota rules
│   ├── quotations/       # Quotes and subscription conversion pipeline
│   ├── subscriptions/    # Subscription lifecycles and historical periods
│   ├── taxes/            # Jurisdiction tax rates and snapshots
│   └── users/            # Administrative staff and user management
└── types/
    └── database.ts       # Generated PostgreSQL database types
```

---

## 2. Layered Responsibilities & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│  - Presentation Layer                                       │
│  - Interactive UI Foundations (Button, Dialog, Table, Toast)│
│  - Declarative Permission Gates (<Can />)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / Server Actions
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js Edge / Node Server                 │
│  - Middleware (Session token refresh & route guards)        │
│  - Server Actions ("use server")                            │
│  - Input Validation via Zod (Zero untrusted inputs)         │
│  - Server-Authoritative Financial Computation               │
│  - Unified ApiResponse Contract ({ success, data/error })   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Authenticated SSR Cookie
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL Database Engine                  │
│  - Row Level Security (RLS) across all 22 tables            │
│  - NUMERIC(14,2) Exact Precision (Zero floating point)      │
│  - Hard Constraints (Unique billing cycle periods)          │
│  - Point-in-time Snapshot Retention                         │
│  - Audit Logs (Immutable compliance trail)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Guarantees

1. **No Shared Mutability Across Modules:**
   Modules must communicate via public functions, server actions, or database relationships. One module must never modify the private internal files of another.
2. **Server-Side Financial Integrity:**
   Frontend components are strictly visual. All prices, tax calculations, discounts, and invoice balances are computed on the server.
3. **Database-Enforced Authorization:**
   Security does not rely solely on middleware or UI visibility. Even if an attacker executes raw SQL or API calls, Row Level Security (RLS) ensures they only see rows they are authorized to access.
