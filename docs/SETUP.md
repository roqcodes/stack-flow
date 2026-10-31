# Brightloop Local Setup & Migration Guide

This guide walks new developers through setting up Brightloop locally and connecting to Supabase.

---

## 1. Prerequisites

* Node.js 18.17+ or Node.js 20+
* npm 9+
* A Supabase project (Free tier on [supabase.com](https://supabase.com) or local Supabase CLI)

---

## 2. Environment Configuration

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/roqcodes/stack-flow.git
   cd stack-flow
   npm install
   ```

2. Create `.env.local` by copying the example:
   ```bash
   cp .env.example .env.local
   ```

3. Populate your Supabase credentials in `.env.local`:
   ```env
   # Found in Supabase Dashboard -> Project Settings -> API
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   
   # SERVER ONLY: Never commit or expose to browser
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key

   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

---

## 3. Applying Database Migrations

Apply the migration files in order inside the **Supabase Dashboard SQL Editor** or via the Supabase CLI:

1. **`supabase/migrations/20261031000000_initial_schema.sql`**
   * Sets up 22 tables, ENUM types, triggers, constraints, and indexes.
2. **`supabase/migrations/20261031000001_row_level_security.sql`**
   * Enables RLS across all 22 tables and adds role policies.
3. **`supabase/migrations/20261031000002_auth_trigger_and_bootstrap.sql`**
   * Configures automatic customer profile provisioning on signup and admin elevation procedures.
4. **`supabase/migrations/20261031000003_add_profile_status_and_permissions.sql`**
   * Adds `is_active` and `permissions` attributes to user profiles.
5. **`supabase/seed.sql`**
   * Populates baseline products, plans, tax jurisdictions, discounts, sample customer, active subscription, and paid invoice.

---

## 4. Bootstrapping Your First Administrator

1. Start the application:
   ```bash
   npm run dev
   ```
2. Open [http://localhost:3000/register](http://localhost:3000/register) and register an account (e.g. `admin@brightloop.io`).
3. Because public registration always assigns `'customer'` standing, elevate your account in the Supabase SQL Editor:
   ```sql
   SELECT public.bootstrap_initial_admin('admin@brightloop.io');
   ```
4. Sign out and sign back in at [http://localhost:3000/login](http://localhost:3000/login).
5. You now have full Administrator access, including the `/users` Staff Directory.

---

## 5. Verification Commands

Run these checks to verify that your local environment is functioning perfectly:

```bash
# 1. Type validation & bundle build
npm run build

# 2. Code style & linting check
npm run lint
```
Both commands must exit with code 0.
