# Brightloop Database Schema Specification

This document provides the definitive contract for all 22 database tables, column names, foreign keys, constraints, and custom ENUMs.

---

## 1. Custom PostgreSQL ENUMs

* `user_role`: `'admin'`, `'staff'`, `'customer'`
* `billing_cycle`: `'daily'`, `'weekly'`, `'monthly'`, `'yearly'`
* `customer_status`: `'active'`, `'suspended'`, `'archived'`
* `product_status`: `'active'`, `'draft'`, `'archived'`
* `quotation_status`: `'draft'`, `'sent'`, `'accepted'`, `'rejected'`, `'expired'`
* `subscription_status`: `'trialing'`, `'active'`, `'past_due'`, `'paused'`, `'cancelled'`, `'expired'`
* `invoice_status`: `'draft'`, `'issued'`, `'paid'`, `'partially_paid'`, `'void'`, `'uncollectible'`
* `payment_status`: `'pending'`, `'succeeded'`, `'failed'`, `'refunded'`, `'partially_refunded'`
* `payment_method_type`: `'credit_card'`, `'bank_transfer'`, `'ach'`, `'wire'`, `'manual'`
* `discount_type`: `'percentage'`, `'fixed_amount'`
* `billing_action_type`: `'cycle_run'`, `'invoice_generated'`, `'auto_charge_attempted'`, `'dunning_attempt'`, `'subscription_renewed'`, `'subscription_cancelled'`

---

## 2. Complete 22 Table Registry

### Table 1: `profiles`
* `id` UUID PRIMARY KEY REFERENCES `auth.users(id)` ON DELETE CASCADE
* `email` TEXT NOT NULL UNIQUE
* `full_name` TEXT
* `role` `user_role` NOT NULL DEFAULT `'customer'`
* `is_active` BOOLEAN NOT NULL DEFAULT `true`
* `permissions` JSONB NOT NULL DEFAULT `'[]'::jsonb`
* `avatar_url` TEXT
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 2: `customers`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `profile_id` UUID UNIQUE REFERENCES `profiles(id)` ON DELETE SET NULL
* `company_name` TEXT NOT NULL
* `contact_name` TEXT NOT NULL
* `email` TEXT NOT NULL UNIQUE
* `phone` TEXT
* `business_number` TEXT UNIQUE
* `currency` VARCHAR(3) NOT NULL DEFAULT `'USD'`
* `billing_address_line1` TEXT
* `billing_address_line2` TEXT
* `billing_city` TEXT
* `billing_state` TEXT
* `billing_postal_code` TEXT
* `billing_country` VARCHAR(2)
* `status` `customer_status` NOT NULL DEFAULT `'active'`
* `is_active` BOOLEAN NOT NULL DEFAULT `true`
* `metadata` JSONB NOT NULL DEFAULT `'{}'::jsonb`
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 3: `products`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `name` TEXT NOT NULL
* `code` TEXT NOT NULL UNIQUE
* `description` TEXT
* `status` `product_status` NOT NULL DEFAULT `'active'`
* `is_active` BOOLEAN NOT NULL DEFAULT `true`
* `metadata` JSONB NOT NULL DEFAULT `'{}'::jsonb`
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 4: `product_variants`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `product_id` UUID NOT NULL REFERENCES `products(id)` ON DELETE CASCADE
* `name` TEXT NOT NULL
* `sku` TEXT NOT NULL UNIQUE
* `attributes` JSONB NOT NULL DEFAULT `'{}'::jsonb`
* `is_active` BOOLEAN NOT NULL DEFAULT `true`
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 5: `plans`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `product_id` UUID NOT NULL REFERENCES `products(id)` ON DELETE RESTRICT
* `variant_id` UUID REFERENCES `product_variants(id)` ON DELETE SET NULL
* `name` TEXT NOT NULL
* `code` TEXT NOT NULL UNIQUE
* `billing_cycle` `billing_cycle` NOT NULL DEFAULT `'monthly'`
* `billing_interval_count` INTEGER NOT NULL DEFAULT `1` CHECK (`billing_interval_count > 0`)
* `currency` VARCHAR(3) NOT NULL DEFAULT `'USD'`
* `price` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`price >= 0`)
* `trial_period_days` INTEGER NOT NULL DEFAULT `0` CHECK (`trial_period_days >= 0`)
* `setup_fee` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`setup_fee >= 0`)
* `status` `product_status` NOT NULL DEFAULT `'active'`
* `is_active` BOOLEAN NOT NULL DEFAULT `true`
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 6: `plan_rules`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `plan_id` UUID NOT NULL REFERENCES `plans(id)` ON DELETE CASCADE
* `rule_type` TEXT NOT NULL
* `rule_value` TEXT NOT NULL
* `description` TEXT
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 7: `quotation_templates`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `name` TEXT NOT NULL
* `description` TEXT
* `terms` TEXT
* `is_active` BOOLEAN NOT NULL DEFAULT `true`
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 8: `quotation_template_items`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `template_id` UUID NOT NULL REFERENCES `quotation_templates(id)` ON DELETE CASCADE
* `product_id` UUID NOT NULL REFERENCES `products(id)` ON DELETE RESTRICT
* `plan_id` UUID REFERENCES `plans(id)` ON DELETE SET NULL
* `quantity` INTEGER NOT NULL DEFAULT `1` CHECK (`quantity > 0`)
* `default_discount_percentage` NUMERIC(5,2) NOT NULL DEFAULT `0.00` CHECK (`default_discount_percentage BETWEEN 0 AND 100`)
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 9: `quotations`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `quotation_number` TEXT NOT NULL UNIQUE
* `customer_id` UUID NOT NULL REFERENCES `customers(id)` ON DELETE RESTRICT
* `template_id` UUID REFERENCES `quotation_templates(id)` ON DELETE SET NULL
* `status` `quotation_status` NOT NULL DEFAULT `'draft'`
* `currency` VARCHAR(3) NOT NULL DEFAULT `'USD'`
* `subtotal` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`subtotal >= 0`)
* `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`discount_amount >= 0`)
* `tax_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`tax_amount >= 0`)
* `total_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`total_amount >= 0`)
* `valid_until` DATE NOT NULL
* `accepted_at` TIMESTAMPTZ
* `converted_subscription_id` UUID REFERENCES `subscriptions(id)` ON DELETE SET NULL
* `notes` TEXT
* `terms` TEXT
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 10: `quotation_items`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `quotation_id` UUID NOT NULL REFERENCES `quotations(id)` ON DELETE CASCADE
* `product_id` UUID REFERENCES `products(id)` ON DELETE SET NULL
* `plan_id` UUID REFERENCES `plans(id)` ON DELETE SET NULL
* `description` TEXT NOT NULL
* `quantity` INTEGER NOT NULL DEFAULT `1` CHECK (`quantity > 0`)
* `unit_price` NUMERIC(14,2) NOT NULL CHECK (`unit_price >= 0`)
* `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`discount_amount >= 0`)
* `tax_rate` NUMERIC(5,2) NOT NULL DEFAULT `0.00` CHECK (`tax_rate >= 0`)
* `tax_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`tax_amount >= 0`)
* `total_amount` NUMERIC(14,2) NOT NULL CHECK (`total_amount >= 0`)
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 11: `subscriptions`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `subscription_number` TEXT NOT NULL UNIQUE
* `customer_id` UUID NOT NULL REFERENCES `customers(id)` ON DELETE RESTRICT
* `plan_id` UUID NOT NULL REFERENCES `plans(id)` ON DELETE RESTRICT
* `status` `subscription_status` NOT NULL DEFAULT `'active'`
* `billing_cycle` `billing_cycle` NOT NULL
* `currency` VARCHAR(3) NOT NULL DEFAULT `'USD'`
* `unit_price` NUMERIC(14,2) NOT NULL CHECK (`unit_price >= 0`)
* `quantity` INTEGER NOT NULL DEFAULT `1` CHECK (`quantity > 0`)
* `subtotal` NUMERIC(14,2) NOT NULL CHECK (`subtotal >= 0`)
* `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`discount_amount >= 0`)
* `tax_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`tax_amount >= 0`)
* `total_amount` NUMERIC(14,2) NOT NULL CHECK (`total_amount >= 0`)
* `trial_start` TIMESTAMPTZ
* `trial_end` TIMESTAMPTZ
* `current_period_start` TIMESTAMPTZ NOT NULL
* `current_period_end` TIMESTAMPTZ NOT NULL
* `next_billing_date` TIMESTAMPTZ NOT NULL
* `cancelled_at` TIMESTAMPTZ
* `cancel_reason` TEXT
* `ended_at` TIMESTAMPTZ
* `metadata` JSONB NOT NULL DEFAULT `'{}'::jsonb`
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* **Constraint:** `CHECK (current_period_end >= current_period_start)`

### Table 12: `subscription_items`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `subscription_id` UUID NOT NULL REFERENCES `subscriptions(id)` ON DELETE CASCADE
* `product_id` UUID NOT NULL REFERENCES `products(id)` ON DELETE RESTRICT
* `plan_id` UUID REFERENCES `plans(id)` ON DELETE SET NULL
* `variant_id` UUID REFERENCES `product_variants(id)` ON DELETE SET NULL
* `description` TEXT NOT NULL
* `quantity` INTEGER NOT NULL DEFAULT `1` CHECK (`quantity > 0`)
* `unit_price` NUMERIC(14,2) NOT NULL CHECK (`unit_price >= 0`)
* `subtotal` NUMERIC(14,2) NOT NULL CHECK (`subtotal >= 0`)
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 13: `taxes`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `name` TEXT NOT NULL
* `code` TEXT NOT NULL UNIQUE
* `country` VARCHAR(2) NOT NULL
* `state_province` TEXT
* `rate` NUMERIC(5,2) NOT NULL CHECK (`rate >= 0 AND rate <= 100`)
* `is_compound` BOOLEAN NOT NULL DEFAULT `false`
* `is_active` BOOLEAN NOT NULL DEFAULT `true`
* `valid_from` DATE
* `valid_until` DATE
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 14: `discounts`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `code` TEXT NOT NULL UNIQUE
* `name` TEXT NOT NULL
* `type` `discount_type` NOT NULL
* `value` NUMERIC(14,2) NOT NULL CHECK (`value > 0`)
* `currency` VARCHAR(3)
* `max_redemptions` INTEGER CHECK (`max_redemptions IS NULL OR max_redemptions > 0`)
* `times_redeemed` INTEGER NOT NULL DEFAULT `0` CHECK (`times_redeemed >= 0`)
* `valid_from` TIMESTAMPTZ
* `valid_until` TIMESTAMPTZ
* `is_active` BOOLEAN NOT NULL DEFAULT `true`
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* **Constraint:** `CHECK (type != 'percentage' OR (value >= 0 AND value <= 100))`

### Table 15: `discount_products`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `discount_id` UUID NOT NULL REFERENCES `discounts(id)` ON DELETE CASCADE
* `product_id` UUID NOT NULL REFERENCES `products(id)` ON DELETE CASCADE
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* **Constraint:** `UNIQUE (discount_id, product_id)`

### Table 16: `discount_usages`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `discount_id` UUID NOT NULL REFERENCES `discounts(id)` ON DELETE RESTRICT
* `customer_id` UUID NOT NULL REFERENCES `customers(id)` ON DELETE RESTRICT
* `invoice_id` UUID REFERENCES `invoices(id)` ON DELETE SET NULL
* `subscription_id` UUID REFERENCES `subscriptions(id)` ON DELETE SET NULL
* `redeemed_amount` NUMERIC(14,2) NOT NULL CHECK (`redeemed_amount >= 0`)
* `redeemed_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 17: `invoices`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `invoice_number` TEXT NOT NULL UNIQUE
* `customer_id` UUID NOT NULL REFERENCES `customers(id)` ON DELETE RESTRICT
* `subscription_id` UUID REFERENCES `subscriptions(id)` ON DELETE SET NULL
* `status` `invoice_status` NOT NULL DEFAULT `'draft'`
* `currency` VARCHAR(3) NOT NULL DEFAULT `'USD'`
* `subtotal` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`subtotal >= 0`)
* `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`discount_amount >= 0`)
* `tax_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`tax_amount >= 0`)
* `total_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`total_amount >= 0`)
* `amount_paid` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`amount_paid >= 0`)
* `amount_due` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`amount_due >= 0`)
* `period_start` TIMESTAMPTZ
* `period_end` TIMESTAMPTZ
* `issue_date` DATE NOT NULL DEFAULT `CURRENT_DATE`
* `due_date` DATE NOT NULL
* `paid_at` TIMESTAMPTZ
* `notes` TEXT
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* **CRITICAL INVARIANT:** `CONSTRAINT uq_subscription_period UNIQUE (subscription_id, period_start, period_end)`

### Table 18: `invoice_items`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `invoice_id` UUID NOT NULL REFERENCES `invoices(id)` ON DELETE CASCADE
* `product_id` UUID REFERENCES `products(id)` ON DELETE SET NULL
* `plan_id` UUID REFERENCES `plans(id)` ON DELETE SET NULL
* `description` TEXT NOT NULL
* `quantity` INTEGER NOT NULL DEFAULT `1` CHECK (`quantity > 0`)
* `unit_amount` NUMERIC(14,2) NOT NULL CHECK (`unit_amount >= 0`)
* `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`discount_amount >= 0`)
* `tax_rate` NUMERIC(5,2) NOT NULL DEFAULT `0.00` CHECK (`tax_rate >= 0`)
* `tax_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`tax_amount >= 0`)
* `total_amount` NUMERIC(14,2) NOT NULL CHECK (`total_amount >= 0`)
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 19: `payments`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `payment_number` TEXT NOT NULL UNIQUE
* `customer_id` UUID NOT NULL REFERENCES `customers(id)` ON DELETE RESTRICT
* `amount` NUMERIC(14,2) NOT NULL CHECK (`amount > 0`)
* `currency` VARCHAR(3) NOT NULL DEFAULT `'USD'`
* `status` `payment_status` NOT NULL DEFAULT `'pending'`
* `payment_method_type` `payment_method_type` NOT NULL DEFAULT `'credit_card'`
* `transaction_reference` TEXT
* `failure_reason` TEXT
* `refunded_amount` NUMERIC(14,2) NOT NULL DEFAULT `0.00` CHECK (`refunded_amount >= 0`)
* `paid_at` TIMESTAMPTZ
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* `updated_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 20: `payment_allocations`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `payment_id` UUID NOT NULL REFERENCES `payments(id)` ON DELETE CASCADE
* `invoice_id` UUID NOT NULL REFERENCES `invoices(id)` ON DELETE RESTRICT
* `allocated_amount` NUMERIC(14,2) NOT NULL CHECK (`allocated_amount > 0`)
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
* **Constraint:** `CONSTRAINT uq_payment_invoice UNIQUE (payment_id, invoice_id)`

### Table 21: `billing_logs`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `subscription_id` UUID REFERENCES `subscriptions(id)` ON DELETE SET NULL
* `customer_id` UUID REFERENCES `customers(id)` ON DELETE SET NULL
* `invoice_id` UUID REFERENCES `invoices(id)` ON DELETE SET NULL
* `action` `billing_action_type` NOT NULL
* `status` VARCHAR(20) NOT NULL CHECK (`status IN ('success', 'failure', 'warning')`)
* `message` TEXT NOT NULL
* `payload` JSONB NOT NULL DEFAULT `'{}'::jsonb`
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`

### Table 22: `audit_logs`
* `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
* `user_id` UUID REFERENCES `auth.users(id)` ON DELETE SET NULL
* `table_name` TEXT NOT NULL
* `record_id` UUID NOT NULL
* `action` VARCHAR(10) NOT NULL CHECK (`action IN ('INSERT', 'UPDATE', 'DELETE')`)
* `old_values` JSONB
* `new_values` JSONB
* `ip_address` TEXT
* `created_at` TIMESTAMPTZ NOT NULL DEFAULT `NOW()`
