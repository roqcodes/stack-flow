# Brightloop Module Ownership & Responsibility Matrix

To prevent code collisions during parallel development, module boundaries and feature ownership are assigned as follows:

---

## Team Responsibility Distribution

```
                               ┌─────────────────────────────┐
                               │     Brightloop Monolith     │
                               └──────────────┬──────────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              ▼                               ▼                               ▼
       [Team Member 1]                 [Team Member 2]                 [Team Member 3]
    Foundation & Identity              Product & Sales                 Billing & Ledger
    ─────────────────────              ───────────────                 ────────────────
    - Core Layout Shell                - Products & Plans              - Subscriptions
    - Database Migrations              - Product Variants              - Subscription Items
    - Supabase SSR Clients             - Plan Rules                    - Invoices & Items
    - Auth & Session Flow              - Taxes & Jurisdictions         - Payments & Allocations
    - User & Staff Admin (/users)      - Discounts & Usages            - Automated Billing Engine
    - Shared UI Foundations            - Customers Organization        - Financial Audit Logs
    - Design System Tokens             - Quotations & Pipelines        - Revenue Analytics (MRR/ARR)
```

---

## Detailed Directory Ownership

### Team Member 1 (Foundation & Security Lead)
* **Owned Directories:**
  * `src/components/layout/` (Sidebar, Header, DashboardShell, Breadcrumbs)
  * `src/components/ui/` (12 Atomic UI Components)
  * `src/components/auth/` (`<Can />`, `AuthProvider`)
  * `src/lib/` (Supabase SSR clients, utils, api-response)
  * `src/modules/auth/` (Auth actions, types, validations, permissions)
  * `src/modules/users/` (Staff directory actions, types, management)
  * `src/app/(auth)/` (Login, Register, Forgot Password, Reset Password)
  * `src/app/users/` (Staff Management Dashboard)
  * `supabase/migrations/` (Schema migrations)

### Team Member 2 (Catalog, Customers & Quotations Lead)
* **Assigned Modules:**
  * `src/modules/products/`
  * `src/modules/taxes/`
  * `src/modules/discounts/`
  * `src/modules/customers/`
  * `src/modules/quotations/`
* **Assigned Application Routes:**
  * `src/app/products/`
  * `src/app/taxes/`
  * `src/app/discounts/`
  * `src/app/customers/`
  * `src/app/quotations/`
* **Database Tables Owned:**
  * `products`, `product_variants`, `plans`, `plan_rules`
  * `taxes`, `discounts`, `discount_products`, `discount_usages`
  * `customers`, `quotation_templates`, `quotation_template_items`, `quotations`, `quotation_items`

### Team Member 3 (Subscriptions, Billing Engine & Financial Ledger Lead)
* **Assigned Modules:**
  * `src/modules/subscriptions/`
  * `src/modules/billing/`
  * `src/modules/invoices/`
  * `src/modules/payments/`
  * `src/modules/analytics/`
* **Assigned Application Routes:**
  * `src/app/subscriptions/`
  * `src/app/billing/`
  * `src/app/invoices/`
  * `src/app/payments/`
  * `src/app/analytics/`
* **Database Tables Owned:**
  * `subscriptions`, `subscription_items`
  * `invoices`, `invoice_items`
  * `payments`, `payment_allocations`
  * `billing_logs`, `audit_logs`

---

## Collaboration Protocol

1. **Shared Files:** Do NOT modify `src/lib/supabase/`, `src/components/ui/`, or `src/middleware.ts` without notifying Member 1.
2. **Migrations:** Never alter an existing applied migration file. Always create a new sequential timestamped migration (e.g. `20261031000004_...sql`).
3. **Branching Strategy:**
   * Branch naming: `feature/[member]-[module-name]` (e.g. `feature/m2-products-catalog`, `feature/m3-subscription-engine`).
   * Merge target: `main` via PR with required checks passing (`build`, `lint`).
