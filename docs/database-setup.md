# Brightloop Database Setup & Migration Guide

This guide walks through configuring and running the Brightloop PostgreSQL database foundation on Supabase.

---

## 1. Prerequisites

- A Supabase Project (Cloud or Local via Supabase CLI).
- Access to the Supabase Dashboard SQL Editor or Supabase CLI.

---

## 2. Migration Files Structure

The migrations are located under `supabase/migrations/`:

1. `supabase/migrations/20261031000000_initial_schema.sql`
   - Defines required PostgreSQL extensions (`uuid-ossp`, `pgcrypto`).
   - Defines custom ENUM types (`user_role`, `billing_cycle`, `customer_status`, `product_status`, `quotation_status`, `subscription_status`, `invoice_status`, `payment_status`, `payment_method_type`, `discount_type`, `billing_action_type`).
   - Creates the `set_updated_at()` trigger function.
   - Creates all **22 database tables** with UUID primary keys, `NUMERIC(14,2)` precision, foreign keys, and check constraints.
   - Installs `updated_at` triggers and high-performance indexes.
2. `supabase/migrations/20261031000001_row_level_security.sql`
   - Creates security helper functions: `current_user_role()`, `is_admin()`, `is_staff()`, `get_customer_id_for_auth_user()`.
   - Enables Row Level Security (RLS) across all 22 tables.
   - Configures granular role-based policies for Customer, Staff, and Admin roles.
3. `supabase/migrations/20261031000002_auth_trigger_and_bootstrap.sql`
   - Configures automated `handle_new_user()` trigger on `auth.users` creating profiles with role strictly locked to `'customer'`.
   - Configures secure `bootstrap_initial_admin(p_email)` function.
   - Configures `assign_staff_role(p_email)` procedure restricted to administrators.
4. `supabase/seed.sql`
   - Populates initial baseline tax jurisdictions, products, variants, subscription plans, plan rules, discounts, and a verified customer lifecycle sample with subscription, invoice, and payment allocation.

---

## 3. How to Apply Migrations

### Option A: Using the Supabase Dashboard SQL Editor (Recommended for Cloud)

1. Navigate to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project and click on the **SQL Editor** tab in the left sidebar.
3. Open `supabase/migrations/20261031000000_initial_schema.sql`, copy all contents, paste into the editor, and click **Run**.
4. Open `supabase/migrations/20261031000001_row_level_security.sql`, copy all contents, paste into the editor, and click **Run**.
5. Open `supabase/seed.sql`, copy all contents, paste into the editor, and click **Run**.

### Option B: Using the Supabase CLI (Local Development)

If using the Supabase CLI locally:
```bash
# Start local Supabase containers
supabase start

# Apply pending migrations
supabase db reset
```

---

## 4. Verification Checklist

After running the migrations, verify the database setup:

1. **Table Count:** Verify that all 22 tables appear in the **Table Editor**:
   - `profiles`, `customers`, `products`, `product_variants`, `plans`, `plan_rules`
   - `quotation_templates`, `quotation_template_items`, `quotations`, `quotation_items`
   - `subscriptions`, `subscription_items`, `taxes`, `discounts`, `discount_products`, `discount_usages`
   - `invoices`, `invoice_items`, `payments`, `payment_allocations`, `billing_logs`, `audit_logs`
2. **RLS Verification:**
   Ensure each table displays the **RLS Enabled** badge in the Supabase Dashboard.
3. **Data Integrity Test:**
   Verify that `plans` prices and `invoices` amounts are stored with two decimal places (`NUMERIC(14,2)`).
4. **Duplicate Billing Prevention Test:**
   Attempting to insert a duplicate invoice with the same `(subscription_id, period_start, period_end)` will raise a PostgreSQL unique constraint violation error (`uq_subscription_period`).
