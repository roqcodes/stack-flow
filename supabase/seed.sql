-- =============================================================================
-- BRIGHTLOOP SUBSCRIPTION MANAGEMENT & RECURRING BILLING PLATFORM
-- Seed File: seed.sql
-- Description: Initial Catalog, Tax Jurisdictions, Promotions, and Baseline Sample Records
-- =============================================================================

-- Clean up existing data in reverse dependency order for idempotent local runs
DELETE FROM payment_allocations;
DELETE FROM payments;
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM discount_usages;
DELETE FROM discount_products;
DELETE FROM discounts;
DELETE FROM taxes;
DELETE FROM subscription_items;
DELETE FROM subscriptions;
DELETE FROM quotation_items;
DELETE FROM quotations;
DELETE FROM quotation_template_items;
DELETE FROM quotation_templates;
DELETE FROM plan_rules;
DELETE FROM plans;
DELETE FROM product_variants;
DELETE FROM products;
DELETE FROM customers;
DELETE FROM billing_logs;
DELETE FROM audit_logs;

-- -----------------------------------------------------------------------------
-- 1. TAX RATES
-- -----------------------------------------------------------------------------
INSERT INTO taxes (id, name, code, country, state_province, rate, is_compound, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'US California Sales Tax', 'TAX-US-CA', 'US', 'CA', 7.25, false, true),
  ('a0000000-0000-0000-0000-000000000002', 'US New York State Tax', 'TAX-US-NY', 'US', 'NY', 8.00, false, true),
  ('a0000000-0000-0000-0000-000000000003', 'Germany Standard VAT', 'TAX-EU-DE', 'DE', NULL, 19.00, false, true),
  ('a0000000-0000-0000-0000-000000000004', 'United Kingdom VAT', 'TAX-GB-VAT', 'GB', NULL, 20.00, false, true);

-- -----------------------------------------------------------------------------
-- 2. PRODUCTS & VARIANTS
-- -----------------------------------------------------------------------------
INSERT INTO products (id, name, code, description, status, is_active, metadata)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Brightloop Cloud Platform', 'PROD-CLOUD', 'Autonomous subscription billing and lifecycle platform engine', 'active', true, '{"product_type":"saas","sales_price":49.00,"cost_price":12.00,"currency":"USD"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000002', 'Dedicated Billing Infrastructure', 'PROD-INFRA', 'Single-tenant isolated database cluster and dedicated throughput worker', 'active', true, '{"product_type":"infrastructure","sales_price":1999.00,"cost_price":800.00,"currency":"USD"}'::jsonb);

INSERT INTO product_variants (id, product_id, name, sku, attributes, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Multi-Tenant Standard', 'SKU-CLOUD-STD', '{"region": "us-east-1", "sla": "99.9%"}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'High-Availability Multi-Region', 'SKU-CLOUD-HA', '{"region": "global", "sla": "99.99%"}'::jsonb, true);

-- -----------------------------------------------------------------------------
-- 3. PLANS & PLAN RULES
-- -----------------------------------------------------------------------------
INSERT INTO plans (id, product_id, variant_id, name, code, billing_cycle, billing_interval_count, currency, price, trial_period_days, setup_fee, status, is_active)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Starter Monthly', 'PLAN-START-M', 'monthly', 1, 'USD', 49.00, 14, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Professional Monthly', 'PLAN-PRO-M', 'monthly', 1, 'USD', 199.00, 0, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Enterprise Annual', 'PLAN-ENT-Y', 'yearly', 1, 'USD', 1999.00, 0, 499.00, 'active', true);

INSERT INTO plan_rules (plan_id, rule_type, rule_value, description)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'seat_limit', '5', 'Up to 5 operator seats'),
  ('d0000000-0000-0000-0000-000000000001', 'api_rate_limit', '1000', '1,000 requests per minute'),
  ('d0000000-0000-0000-0000-000000000002', 'seat_limit', '25', 'Up to 25 operator seats'),
  ('d0000000-0000-0000-0000-000000000002', 'api_rate_limit', '10000', '10,000 requests per minute'),
  ('d0000000-0000-0000-0000-000000000003', 'seat_limit', 'unlimited', 'Unlimited operator seats'),
  ('d0000000-0000-0000-0000-000000000003', 'api_rate_limit', '100000', '100,000 requests per minute');

-- -----------------------------------------------------------------------------
-- 4. DISCOUNTS & COUPONS
-- -----------------------------------------------------------------------------
INSERT INTO discounts (id, code, name, type, value, currency, max_redemptions, times_redeemed, is_active)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'ANNUAL20', 'Annual Plan 20% Discount', 'percentage', 20.00, NULL, 500, 1, true),
  ('e0000000-0000-0000-0000-000000000002', 'WELCOME50', '$50 Onboarding Credit', 'fixed_amount', 50.00, 'USD', 100, 0, true);

INSERT INTO discount_products (discount_id, product_id)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');

-- -----------------------------------------------------------------------------
-- 5. CUSTOMERS
-- -----------------------------------------------------------------------------
INSERT INTO customers (
  id,
  company_name,
  contact_name,
  email,
  phone,
  business_number,
  currency,
  billing_address_line1,
  billing_city,
  billing_state,
  billing_postal_code,
  billing_country,
  status,
  is_active
)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'Acme Global Technologies Inc.',
  'Jane Doe',
  'billing@acmetech.io',
  '+1-415-555-0199',
  'US-94-3829104',
  'USD',
  '500 Howard Street, Suite 400',
  'San Francisco',
  'CA',
  '94105',
  'US',
  'active',
  true
);

-- -----------------------------------------------------------------------------
-- 6. SUBSCRIPTIONS & SUBSCRIPTION ITEMS
-- -----------------------------------------------------------------------------
INSERT INTO subscriptions (
  id,
  subscription_number,
  customer_id,
  plan_id,
  status,
  billing_cycle,
  currency,
  unit_price,
  quantity,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
  current_period_start,
  current_period_end,
  next_billing_date
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'SUB-2026-0001',
  'f0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'active',
  'monthly',
  'USD',
  199.00,
  1,
  199.00,
  0.00,
  14.43, -- 7.25% CA tax
  213.43,
  '2026-10-01 00:00:00+00',
  '2026-10-31 23:59:59+00',
  '2026-11-01 00:00:00+00'
);

INSERT INTO subscription_items (
  subscription_id,
  product_id,
  plan_id,
  description,
  quantity,
  unit_price,
  subtotal
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'Professional Monthly SaaS Subscription',
  1,
  199.00,
  199.00
);

-- -----------------------------------------------------------------------------
-- 7. INVOICES & INVOICE ITEMS (Historical snapshot preserved)
-- -----------------------------------------------------------------------------
INSERT INTO invoices (
  id,
  invoice_number,
  customer_id,
  subscription_id,
  status,
  currency,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
  amount_paid,
  amount_due,
  period_start,
  period_end,
  issue_date,
  due_date,
  paid_at
)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'INV-2026-0001',
  'f0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'paid',
  'USD',
  199.00,
  0.00,
  14.43,
  213.43,
  213.43,
  0.00,
  '2026-10-01 00:00:00+00',
  '2026-10-31 23:59:59+00',
  '2026-10-01',
  '2026-10-15',
  '2026-10-02 14:32:10+00'
);

INSERT INTO invoice_items (
  invoice_id,
  product_id,
  plan_id,
  description,
  quantity,
  unit_amount,
  discount_amount,
  tax_rate,
  tax_amount,
  total_amount
)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'Professional Monthly Subscription (Oct 1 – Oct 31, 2026)',
  1,
  199.00,
  0.00,
  7.25,
  14.43,
  213.43
);

-- -----------------------------------------------------------------------------
-- 8. PAYMENTS & ALLOCATIONS (Multi-invoice allocation support)
-- -----------------------------------------------------------------------------
INSERT INTO payments (
  id,
  payment_number,
  customer_id,
  amount,
  currency,
  status,
  payment_method_type,
  transaction_reference,
  paid_at
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  'PAY-2026-0001',
  'f0000000-0000-0000-0000-000000000001',
  213.43,
  'USD',
  'succeeded',
  'credit_card',
  'ch_stripe_test_8392019482',
  '2026-10-02 14:32:10+00'
);

INSERT INTO payment_allocations (
  payment_id,
  invoice_id,
  allocated_amount
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  213.43
);

-- -----------------------------------------------------------------------------
-- 9. BILLING ENGINE AUDIT LOG
-- -----------------------------------------------------------------------------
INSERT INTO billing_logs (
  subscription_id,
  customer_id,
  invoice_id,
  action,
  status,
  message,
  payload
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'invoice_generated',
  'success',
  'Automated recurring billing generated invoice INV-2026-0001 for period Oct 1 - Oct 31, 2026',
  '{"total": 213.43, "currency": "USD", "cycle": "monthly"}'::jsonb
);
