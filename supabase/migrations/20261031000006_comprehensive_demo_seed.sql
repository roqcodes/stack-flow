-- =============================================================================
-- BRIGHTLOOP SUBSCRIPTION MANAGEMENT & RECURRING BILLING PLATFORM
-- Migration: 20261031000006_comprehensive_demo_seed.sql
-- Description: Comprehensive Demo & Assessment Seed Data
-- =============================================================================

-- Clean up existing data in reverse dependency order for idempotent execution
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

-- 1. TAX RATES & JURISDICTIONS
INSERT INTO taxes (id, name, code, country, state_province, rate, is_compound, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'US California Sales Tax', 'TAX-US-CA', 'US', 'CA', 7.25, false, true),
  ('a0000000-0000-0000-0000-000000000002', 'US New York State Tax', 'TAX-US-NY', 'US', 'NY', 8.00, false, true),
  ('a0000000-0000-0000-0000-000000000003', 'US Texas Sales Tax', 'TAX-US-TX', 'US', 'TX', 6.25, false, true),
  ('a0000000-0000-0000-0000-000000000004', 'Germany Standard VAT', 'TAX-EU-DE', 'DE', NULL, 19.00, false, true),
  ('a0000000-0000-0000-0000-000000000005', 'United Kingdom VAT', 'TAX-GB-VAT', 'GB', NULL, 20.00, false, true),
  ('a0000000-0000-0000-0000-000000000006', 'Japan Consumption Tax', 'TAX-JP-JCT', 'JP', NULL, 10.00, false, true);

-- 2. PRODUCTS & VARIANTS
INSERT INTO products (id, name, code, description, status, is_active, metadata)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Brightloop Cloud Platform', 'PROD-CLOUD', 'Autonomous subscription billing, invoicing, and lifecycle platform engine', 'active', true, '{"product_type":"saas","sales_price":49.00,"cost_price":12.00,"currency":"USD"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000002', 'Dedicated Billing Infrastructure', 'PROD-INFRA', 'Single-tenant isolated PostgreSQL cluster and dedicated throughput worker', 'active', true, '{"product_type":"infrastructure","sales_price":1499.00,"cost_price":600.00,"currency":"USD"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000003', 'AI Dunning & Churn Intelligence', 'PROD-AI', 'Smart automated payment retry schedules and predictive churn retention analytics', 'active', true, '{"product_type":"addon","sales_price":89.00,"cost_price":15.00,"currency":"USD"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000004', 'Developer Platform & Webhook Suite', 'PROD-API', 'High-throughput event streaming, 99.99% webhook delivery guarantees, and SDKs', 'active', true, '{"product_type":"developer_tools","sales_price":149.00,"cost_price":30.00,"currency":"USD"}'::jsonb);

INSERT INTO product_variants (id, product_id, name, sku, attributes, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Multi-Tenant Standard', 'SKU-CLOUD-STD', '{"region": "us-east-1", "sla": "99.9%"}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'High-Availability Multi-Region', 'SKU-CLOUD-HA', '{"region": "global", "sla": "99.99%"}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Dedicated Single-Tenant Cluster', 'SKU-INFRA-DEDICATED', '{"tier": "enterprise", "isolated_vpc": true}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'High-Performance DR Cluster', 'SKU-INFRA-DR', '{"tier": "hyperscale", "disaster_recovery": true}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003', 'Autonomous Dunning Bot', 'SKU-AI-DUNNING', '{"retries": "exponential_backoff", "channels": ["email","sms"]}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003', 'Predictive Churn Engine', 'SKU-AI-CHURN', '{"model": "v2_gradient_boost", "refresh": "hourly"}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000004', 'High-Throughput Webhooks', 'SKU-API-WEBHOOK', '{"events_per_sec": 5000, "concurrency": 50}'::jsonb, true),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'Enterprise SDK & Event Bus', 'SKU-API-EVENTBUS', '{"events_per_sec": 50000, "concurrency": 200}'::jsonb, true);

-- 3. PLANS & PLAN RULES
INSERT INTO plans (id, product_id, variant_id, name, code, billing_cycle, billing_interval_count, currency, price, trial_period_days, setup_fee, status, is_active)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Starter Monthly', 'PLAN-START-M', 'monthly', 1, 'USD', 49.00, 14, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Professional Monthly', 'PLAN-PRO-M', 'monthly', 1, 'USD', 199.00, 0, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Enterprise Annual', 'PLAN-ENT-Y', 'yearly', 1, 'USD', 1999.00, 0, 499.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Starter Annual (2 Months Free)', 'PLAN-START-Y', 'yearly', 1, 'USD', 490.00, 14, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Professional Annual (Save 20%)', 'PLAN-PRO-Y', 'yearly', 1, 'USD', 1990.00, 0, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Scale Tier Monthly', 'PLAN-SCALE-M', 'monthly', 1, 'USD', 499.00, 0, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'Dedicated Billing Cluster', 'PLAN-INFRA-DEDICATED', 'monthly', 1, 'USD', 1499.00, 0, 999.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'Autonomous AI Dunning Add-On', 'PLAN-AI-DUNNING', 'monthly', 1, 'USD', 89.00, 7, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 'Predictive Churn Intelligence', 'PLAN-AI-CHURN', 'monthly', 1, 'USD', 249.00, 0, 0.00, 'active', true),
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000007', 'Developer API High-Throughput', 'PLAN-API-GROWTH', 'monthly', 1, 'USD', 149.00, 14, 0.00, 'active', true);

INSERT INTO plan_rules (plan_id, rule_type, rule_value, description)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'seat_limit', '5', 'Up to 5 operator seats'),
  ('d0000000-0000-0000-0000-000000000001', 'api_rate_limit', '1000', '1,000 requests per minute'),
  ('d0000000-0000-0000-0000-000000000002', 'seat_limit', '25', 'Up to 25 operator seats'),
  ('d0000000-0000-0000-0000-000000000002', 'api_rate_limit', '10000', '10,000 requests per minute'),
  ('d0000000-0000-0000-0000-000000000003', 'seat_limit', 'unlimited', 'Unlimited operator seats'),
  ('d0000000-0000-0000-0000-000000000003', 'api_rate_limit', '100000', '100,000 requests per minute'),
  ('d0000000-0000-0000-0000-000000000006', 'seat_limit', '50', 'Up to 50 operator seats'),
  ('d0000000-0000-0000-0000-000000000006', 'api_rate_limit', '50000', '50,000 requests per minute'),
  ('d0000000-0000-0000-0000-000000000007', 'seat_limit', 'unlimited', 'Dedicated single tenant access'),
  ('d0000000-0000-0000-0000-000000000007', 'api_rate_limit', 'unlimited', 'Direct isolated database throughput'),
  ('d0000000-0000-0000-0000-000000000010', 'webhook_delivery', 'true', 'Guaranteed at-least-once delivery with exponential retries');

-- 4. DISCOUNTS & COUPONS
INSERT INTO discounts (id, code, name, type, value, currency, max_redemptions, times_redeemed, is_active)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'ANNUAL20', 'Annual Plan 20% Discount', 'percentage', 20.00, NULL, 500, 3, true),
  ('e0000000-0000-0000-0000-000000000002', 'WELCOME50', '$50 Onboarding Credit', 'fixed_amount', 50.00, 'USD', 200, 5, true),
  ('e0000000-0000-0000-0000-000000000003', 'SCALE30', '30% Off Scale Tier Promotion', 'percentage', 30.00, NULL, 50, 1, true),
  ('e0000000-0000-0000-0000-000000000004', 'STARTUP90', '90% Accelerator Subsidy', 'percentage', 90.00, NULL, 20, 0, true);

INSERT INTO discount_products (discount_id, product_id)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001');

-- 5. CUSTOMERS
INSERT INTO customers (
  id, company_name, contact_name, email, phone, business_number, currency,
  billing_address_line1, billing_city, billing_state, billing_postal_code, billing_country, status, is_active
)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'Acme Global Technologies Inc.', 'Jane Doe', 'billing@acmetech.io', '+1-415-555-0199', 'US-94-3829104', 'USD', '500 Howard Street, Suite 400', 'San Francisco', 'CA', '94105', 'US', 'active', true),
  ('f0000000-0000-0000-0000-000000000002', 'Nova AI Labs Corp.', 'Alex Chen', 'finance@novalabs.ai', '+1-650-555-0144', 'US-77-9028192', 'USD', '100 University Ave', 'Palo Alto', 'CA', '94301', 'US', 'active', true),
  ('f0000000-0000-0000-0000-000000000003', 'Apex Financial Systems Ltd.', 'Sarah Jenkins', 'accounts@apexfinancial.co.uk', '+44-20-7946-0921', 'GB-VAT-982341', 'USD', '25 Bank Street, Canary Wharf', 'London', NULL, 'E14 5JP', 'GB', 'active', true),
  ('f0000000-0000-0000-0000-000000000004', 'CyberPulse Security GmbH', 'Maximilian Becker', 'rechnung@cyberpulse.de', '+49-30-1234-5678', 'DE-HRB-102938', 'USD', 'Friedrichstraße 68', 'Berlin', 'Berlin', '10117', 'DE', 'active', true),
  ('f0000000-0000-0000-0000-000000000005', 'CloudScale Systems Inc.', 'Marcus Brody', 'billing@cloudscale.net', '+1-212-555-0177', 'US-13-8472910', 'USD', '350 5th Avenue, Suite 2100', 'New York', 'NY', '10118', 'US', 'active', true),
  ('f0000000-0000-0000-0000-000000000006', 'Quantum Data Networks KK', 'Kenji Sato', 'payments@quantumdata.jp', '+81-3-5555-0123', 'JP-CORP-482910', 'USD', 'Roppongi Hills Mori Tower 32F', 'Tokyo', 'Tokyo', '106-6108', 'JP', 'active', true);

-- 6. QUOTATIONS
INSERT INTO quotations (
  id, quotation_number, customer_id, status, currency, subtotal, discount_amount, tax_amount, total_amount, valid_until, accepted_at, notes, terms
)
VALUES
  (
    '40000000-0000-0000-0000-000000000001', 'Q-2026-0001', 'f0000000-0000-0000-0000-000000000002',
    'sent', 'USD', 199.00, 0.00, 14.43, 213.43,
    CURRENT_DATE + INTERVAL '30 days', NULL,
    'Enterprise SaaS Quote for Nova AI Labs', 'Net-30 Payment Terms. Valid for 30 days.'
  ),
  (
    '40000000-0000-0000-0000-000000000002', 'Q-2026-0002', 'f0000000-0000-0000-0000-000000000003',
    'accepted', 'USD', 1999.00, 0.00, 399.80, 2398.80,
    CURRENT_DATE + INTERVAL '15 days', NOW() - INTERVAL '2 days',
    'Enterprise Annual Quotation accepted by CFO', 'Annual upfront payment. SLA 99.99% included.'
  ),
  (
    '40000000-0000-0000-0000-000000000003', 'Q-2026-0003', 'f0000000-0000-0000-0000-000000000005',
    'accepted', 'USD', 499.00, 50.00, 35.92, 484.92,
    CURRENT_DATE + INTERVAL '20 days', NOW() - INTERVAL '1 day',
    'Scale Tier Monthly with $50 Onboarding Credit applied', 'Monthly billing cycle with automatic card debit.'
  ),
  (
    '40000000-0000-0000-0000-000000000004', 'Q-2026-0004', 'f0000000-0000-0000-0000-000000000004',
    'draft', 'USD', 1499.00, 0.00, 284.81, 1783.81,
    CURRENT_DATE + INTERVAL '45 days', NULL,
    'Dedicated Infrastructure cluster proposal under legal review', 'Custom dedicated VPC cluster.'
  );

INSERT INTO quotation_items (quotation_id, product_id, plan_id, description, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_amount)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Professional Monthly Plan', 1, 199.00, 0.00, 7.25, 14.43, 213.43),
  ('40000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Enterprise Annual SaaS Subscription', 1, 1999.00, 0.00, 20.00, 399.80, 2398.80),
  ('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'Scale Tier Monthly Platform License', 1, 499.00, 50.00, 8.00, 35.92, 484.92),
  ('40000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', 'Dedicated Billing Infrastructure Single-Tenant', 1, 1499.00, 0.00, 19.00, 284.81, 1783.81);

-- 7. SUBSCRIPTIONS & ITEMS
INSERT INTO subscriptions (
  id, subscription_number, customer_id, plan_id, status, billing_cycle, currency,
  unit_price, quantity, subtotal, discount_amount, tax_amount, total_amount,
  trial_start, trial_end, current_period_start, current_period_end, next_billing_date
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001', 'SUB-2026-0001', 'f0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002', 'active', 'monthly', 'USD',
    199.00, 1, 199.00, 0.00, 14.43, 213.43,
    NULL, NULL,
    CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days'
  ),
  (
    '10000000-0000-0000-0000-000000000002', 'SUB-2026-0002', 'f0000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000006', 'active', 'monthly', 'USD',
    499.00, 1, 499.00, 0.00, 39.92, 538.92,
    NULL, NULL,
    CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days', CURRENT_DATE + INTERVAL '20 days'
  ),
  (
    '10000000-0000-0000-0000-000000000003', 'SUB-2026-0003', 'f0000000-0000-0000-0000-000000000006',
    'd0000000-0000-0000-0000-000000000003', 'active', 'yearly', 'USD',
    1999.00, 1, 1999.00, 0.00, 199.90, 2198.90,
    NULL, NULL,
    CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days', CURRENT_DATE + INTERVAL '305 days'
  ),
  (
    '10000000-0000-0000-0000-000000000004', 'SUB-2026-0004', 'f0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001', 'trialing', 'monthly', 'USD',
    49.00, 1, 49.00, 0.00, 3.55, 52.55,
    CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days',
    CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days'
  ),
  (
    '10000000-0000-0000-0000-000000000005', 'SUB-2026-0005', 'f0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000002', 'active', 'monthly', 'USD',
    199.00, 1, 199.00, 0.00, 39.80, 238.80,
    NULL, NULL,
    CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, CURRENT_DATE
  ),
  (
    '10000000-0000-0000-0000-000000000006', 'SUB-2026-0006', 'f0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000007', 'active', 'monthly', 'USD',
    1499.00, 1, 1499.00, 0.00, 284.81, 1783.81,
    NULL, NULL,
    CURRENT_DATE - INTERVAL '31 days', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day'
  ),
  (
    '10000000-0000-0000-0000-000000000007', 'SUB-2026-0007', 'f0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000008', 'past_due', 'monthly', 'USD',
    89.00, 1, 89.00, 0.00, 6.45, 95.45,
    NULL, NULL,
    CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '15 days'
  ),
  (
    '10000000-0000-0000-0000-000000000008', 'SUB-2026-0008', 'f0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000010', 'paused', 'monthly', 'USD',
    149.00, 1, 149.00, 0.00, 10.80, 159.80,
    NULL, NULL,
    CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days'
  );

INSERT INTO subscription_items (subscription_id, product_id, plan_id, description, quantity, unit_price, subtotal)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Professional Monthly SaaS Subscription', 1, 199.00, 199.00),
  ('10000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'Scale Tier Monthly Dedicated Platform', 1, 499.00, 499.00),
  ('10000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Enterprise Annual Multi-Region Engine', 1, 1999.00, 1999.00),
  ('10000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Starter Monthly Trial Plan', 1, 49.00, 49.00),
  ('10000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Professional Monthly Billing Run Candidate', 1, 199.00, 199.00),
  ('10000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', 'Dedicated Billing Cluster High Throughput', 1, 1499.00, 1499.00),
  ('10000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000008', 'AI Dunning & Churn Assistant Add-On', 1, 89.00, 89.00),
  ('10000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000010', 'High-Throughput Developer Webhook Engine', 1, 149.00, 149.00);

-- 8. INVOICES & INVOICE ITEMS
INSERT INTO invoices (
  id, invoice_number, customer_id, subscription_id, status, currency,
  subtotal, discount_amount, tax_amount, total_amount, amount_paid, amount_due,
  period_start, period_end, issue_date, due_date, paid_at, notes
)
VALUES
  (
    '20000000-0000-0000-0000-000000000001', 'INV-2026-0001',
    'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    'paid', 'USD', 199.00, 0.00, 14.43, 213.43, 213.43, 0.00,
    CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '44 days', 'Automated recurring billing payment cleared via Stripe.'
  ),
  (
    '20000000-0000-0000-0000-000000000002', 'INV-2026-0002',
    'f0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002',
    'paid', 'USD', 499.00, 0.00, 39.92, 538.92, 538.92, 0.00,
    CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '10 days',
    CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '25 days',
    CURRENT_DATE - INTERVAL '39 days', 'ACH Bank Transfer settled successfully.'
  ),
  (
    '20000000-0000-0000-0000-000000000003', 'INV-2026-0003',
    'f0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003',
    'issued', 'USD', 1999.00, 0.00, 199.90, 2198.90, 0.00, 2198.90,
    CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days',
    CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '10 days',
    NULL, 'Annual enterprise billing. Net-15 wire transfer pending.'
  ),
  (
    '20000000-0000-0000-0000-000000000004', 'INV-2026-0004',
    'f0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000006',
    'partially_paid', 'USD', 1499.00, 0.00, 284.81, 1783.81, 1000.00, 783.81,
    CURRENT_DATE - INTERVAL '31 days', CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '15 days',
    NULL, 'First installment received via Wire Transfer ($1,000.00).'
  ),
  (
    '20000000-0000-0000-0000-000000000005', 'INV-2026-0005',
    'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
    'issued', 'USD', 89.00, 0.00, 6.45, 95.45, 0.00, 95.45,
    CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '30 days',
    NULL, 'Overdue payment. Automated dunning retry scheduled.'
  );

INSERT INTO invoice_items (
  invoice_id, product_id, plan_id, description, quantity, unit_amount, discount_amount, tax_rate, tax_amount, total_amount
)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Professional Monthly Subscription License', 1, 199.00, 0.00, 7.25, 14.43, 213.43),
  ('20000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'Scale Tier Monthly Dedicated Engine', 1, 499.00, 0.00, 8.00, 39.92, 538.92),
  ('20000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Enterprise Annual Cloud Platform + Global HA', 1, 1999.00, 0.00, 10.00, 199.90, 2198.90),
  ('20000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', 'Dedicated Billing Infrastructure Single-Tenant Cluster', 1, 1499.00, 0.00, 19.00, 284.81, 1783.81),
  ('20000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000008', 'Autonomous AI Dunning Module Subscription', 1, 89.00, 0.00, 7.25, 6.45, 95.45);

-- 9. PAYMENTS & ALLOCATIONS
INSERT INTO payments (
  id, payment_number, customer_id, amount, currency, status, payment_method_type, transaction_reference, paid_at
)
VALUES
  (
    '30000000-0000-0000-0000-000000000001', 'PAY-2026-0001', 'f0000000-0000-0000-0000-000000000001',
    213.43, 'USD', 'succeeded', 'credit_card', 'ch_stripe_card_92810482', CURRENT_DATE - INTERVAL '44 days'
  ),
  (
    '30000000-0000-0000-0000-000000000002', 'PAY-2026-0002', 'f0000000-0000-0000-0000-000000000005',
    538.92, 'USD', 'succeeded', 'ach', 'ach_direct_debit_4810293', CURRENT_DATE - INTERVAL '39 days'
  ),
  (
    '30000000-0000-0000-0000-000000000003', 'PAY-2026-0003', 'f0000000-0000-0000-0000-000000000004',
    1000.00, 'USD', 'succeeded', 'wire', 'wire_swift_deutdebb_91029', CURRENT_DATE - INTERVAL '20 days'
  );

INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 213.43),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 538.92),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 1000.00);

-- 10. BILLING ENGINE AUDIT LOGS
INSERT INTO billing_logs (subscription_id, customer_id, invoice_id, action, status, message, payload)
VALUES
  (
    '10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
    'invoice_generated', 'success',
    'Automated recurring billing generated invoice INV-2026-0001 for Acme Global Technologies Inc.',
    '{"total": 213.43, "currency": "USD", "cycle": "monthly", "subtotal": 199.00, "tax": 14.43}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
    'invoice_generated', 'success',
    'Automated recurring billing generated invoice INV-2026-0002 for CloudScale Systems Inc.',
    '{"total": 538.92, "currency": "USD", "cycle": "monthly", "subtotal": 499.00, "tax": 39.92}'::jsonb
  ),
  (
    NULL, NULL, NULL,
    'cycle_run', 'success',
    'Scheduled nightly billing cycle completed. 2 subscriptions processed, 0 failures.',
    '{"processed_count": 2, "invoices_created": 2, "total_billed": 752.35}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005',
    'dunning_attempt', 'warning',
    'Payment auto-charge failed for INV-2026-0005 (card_declined: insufficient funds). Retry 1 of 3 scheduled.',
    '{"reason": "insufficient_funds", "next_retry": "in 72 hours"}'::jsonb
  );

-- 11. AUTOMATIC PROFILE ELEVATION TO ADMIN
UPDATE public.profiles
SET role = 'admin',
    is_active = true
WHERE role != 'admin';
