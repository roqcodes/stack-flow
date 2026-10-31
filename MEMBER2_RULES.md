# Member 2 — Product, Pricing & Customer Management

## Role

You are **Member 2** of the Brightloop development team.

Your responsibility is the **entire commercial management module**.

The project foundation has already been built by Member 1.

---

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Supabase PostgreSQL

---

## Ownership

| Area | Path |
|------|------|
| Products | `src/modules/products/` |
| Plans | `src/modules/plans/` |
| Customers | `src/modules/customers/` |
| Quotations | `src/modules/quotations/` |
| Routes | Assigned product, plan, customer and quotation route directories |

### Responsibilities (from assignment image)

- Products and variants
- Subscription plans
- Plan availability and rules
- Customer management
- Quotation templates
- Quotation creation and PDF
- Quotation acceptance

---

## Strict Rules

1. Inspect the existing repository before coding.
2. Read `docs/ARCHITECTURE.md`.
3. Read `docs/DATABASE_SCHEMA.md`.
4. Read `docs/API_CONTRACTS.md`.
5. Read `docs/MODULE_OWNERSHIP.md`.
6. Never recreate the project.
7. Never modify authentication, global CSS or shared Supabase clients.
8. Never create database tables independently.
9. Never change shared database columns without approval from Member 1.
10. Use the existing database schema.
11. Use existing authorization and validation utilities.
12. Use server-side operations for all business logic.
13. Preserve historical financial information.
14. Do not implement subscriptions or invoice generation.
15. Do not use mock data for completed features.

---

## Communication Contract

Your outputs will be consumed by **Member 3** and **Member 4**.

Document the exact service methods for:

- Getting product details
- Getting effective product prices
- Getting variants
- Getting plans
- Getting customers
- Accepting quotations
- Retrieving accepted quotation details

Use **shared TypeScript types**.

---

## After Every Task — Checklist

- [ ] Run typecheck
- [ ] Run lint
- [ ] Run relevant tests
- [ ] Report changed files
- [ ] Report database dependencies
- [ ] Report unresolved issues

---

## Project Master Rules (Brightloop-wide)

> These apply to all team members, not just Member 2.

### Mandatory Engineering Rules

1. Inspect the existing repository before making changes.
2. Never recreate or replace an existing application.
3. Preserve all existing working functionality.
4. Use TypeScript strictly. Avoid `any`.
5. Use the existing package versions and conventions.
6. Use server-side Supabase clients for protected operations.
7. Never expose the Supabase service role key in client code.
8. Enforce authorization on the server and database using RLS.
9. Validate every external input using Zod.
10. Perform all financial calculations on the server.
11. Use `NUMERIC(14,2)` for financial database values.
12. Preserve historical financial records.
13. Never trust frontend-supplied prices, taxes, discounts or totals.
14. Use transactions and database constraints for financial operations.
15. Follow existing database table and column names exactly.
16. Never create a second Supabase client implementation.
17. Never change shared files or another developer's modules without approval.
18. Never introduce mock data into production business logic.
19. Implement proper loading, empty, error and success states.
20. Make the application responsive and accessible.

### Development Workflow

**Before implementation:**
- Inspect the repository
- Read `README.md` and shared documentation
- Identify existing components and utilities
- Confirm database contracts
- List files that need modification

**After implementation:**
- Run TypeScript validation
- Run linting
- Run relevant tests
- Check for broken imports
- Report modified files
- Report new dependencies
- Report database changes
- Explain how to test the implementation

### Critical Instruction

> Do not assume that you are the only developer.

Other team members are independently implementing different modules in the same repository.

Your responsibility is to implement **only your assigned scope** while maintaining complete compatibility with the shared project architecture.

If a required database field, API or shared component does not exist, **STOP** and report the missing dependency instead of silently inventing a replacement.

Build **production-minded, functional software**, not static UI demonstrations.
