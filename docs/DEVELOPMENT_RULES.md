# Brightloop Engineering Rules & Conventions

All developers contributing to Brightloop must strictly observe these 20 engineering invariants. Violations will result in automated PR rejections.

---

## 1. The 20 Mandatory Engineering Rules

1. **Inspect Before Modifying:** Always inspect existing components, schema, and contracts before writing new code.
2. **Never Recreate the Application:** Build incrementally within the existing modular structure.
3. **Preserve Working Functionality:** Regression in existing auth, shell, or migrations is unacceptable.
4. **Strict TypeScript:** Absolutely no `any`. Explicitly type all parameters, responses, and database mappings.
5. **Adhere to Package Conventions:** Do not install alternative UI libraries (e.g. Shadcn/Radix/Chakra) or additional CSS preprocessors. Use the established design system in `src/components/ui/` and Tailwind CSS v4.
6. **Use Server-Side Supabase Clients:** All mutations and protected queries must execute through `@/lib/supabase/server`.
7. **Zero Service Role in Browser:** `SUPABASE_SERVICE_ROLE_KEY` is strictly server-only. `createAdminClient()` throws runtime errors if called in the browser.
8. **Enforce Database RLS:** Every database table must have Row Level Security enabled with explicit policies. Never disable RLS to make a query pass.
9. **Validate Every Input with Zod:** Every Server Action and route handler must validate its payload using Zod.
10. **Server-Authoritative Financial Computation:** Never trust frontend prices, tax amounts, or invoice totals. Calculate everything on the server.
11. **Financial Precision:** All monetary amounts must be stored as `NUMERIC(14,2)` in PostgreSQL and formatted using `formatCurrency()` from `@/lib/utils`.
12. **Preserve Historical Records:** Invoices and quotation items must store point-in-time snapshots of prices, discounts, and tax rates.
13. **Never Trust Client Totals:** Even if the UI shows $100.00, the server recalculates the line items, applicable taxes, and active discount redemptions before writing to the database.
14. **Use Transactions & Database Constraints:** Prevent race conditions using PostgreSQL constraints (e.g., `uq_subscription_period` on `invoices`).
15. **Follow Schema Naming Strictly:** Use exact snake_case table and column names specified in `docs/DATABASE_SCHEMA.md`.
16. **Never Duplicate Supabase Clients:** Use exclusively the four official clients in `src/lib/supabase/`.
17. **Strict Module Ownership:** Never edit another developer's module files without prior written approval.
18. **Zero Mock Data in Production:** Build functional software against Supabase, not hardcoded mock arrays.
19. **Complete UI States:** Implement loading (`Skeleton`), empty (`TableEmpty`), error (`toast.error`), and success states for every view.
20. **Responsive & Accessible:** Ensure all interactive elements have labels, focus rings, and function on mobile, tablet, and desktop screens.

---

## 2. Pre-Commit Verification Checklist

Before pushing code or opening a pull request, run:

```bash
# 1. Type validation
npm run build

# 2. ESLint verification (must exit with 0 errors and 0 warnings)
npm run lint

# 3. Check for unstaged files or accidental .env leaks
git status
```
