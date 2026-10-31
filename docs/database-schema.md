# Brightloop Database Schema Specification

This document serves as the formal PostgreSQL database contract for the Brightloop Subscription Management and Recurring Billing Platform.

---

## Architectural Principles

1. **Precision:** All monetary amounts are defined as `NUMERIC(14,2)` to avoid floating-point inaccuracies.
2. **Primary Keys:** Standard UUIDs (`gen_random_uuid()`).
3. **Auditability & History:** Historical point-in-time rates, amounts, and tax snapshots are permanently preserved in `invoice_items` and `quotation_items`.
4. **Duplicate Billing Prevention:** Hard database uniqueness constraint on `invoices(subscription_id, period_start, period_end)` guarantees no duplicate invoices are generated for the same billing cycle.
5. **Multi-Invoice Allocations:** `payment_allocations` decouples payments from single invoices, permitting lump-sum payments to settle multiple open invoices or partial payments.
6. **Row Level Security:** Every table enforces RLS via PostgreSQL policies.

---

## Entity Statuses & Enums

### `user_role`
- `admin`: Full administrative access to manage products, pricing, users, and audit logs.
- `staff`: Operational access to handle customers, subscriptions, invoices, and payments.
- `customer`: Self-service portal access restricted strictly to their own entity records.

### `billing_cycle`
- `daily`, `weekly`, `monthly`, `yearly`

### `customer_status`
- `active`: Normal operating standing.
- `suspended`: Temporarily restricted due to failed dunning or compliance hold.
- `archived`: Deactivated customer record.

### `product_status`
- `active`: Available for catalog selection and subscription attachment.
- `draft`: Work-in-progress plan configuration.
- `archived`: Deprecated from future assignment while preserving existing subscriptions.

### `quotation_status`
- `draft`, `sent`, `accepted`, `rejected`, `expired`

### `subscription_status`
- `trialing`, `active`, `past_due`, `paused`, `cancelled`, `expired`

### `invoice_status`
- `draft`, `issued`, `paid`, `partially_paid`, `void`, `uncollectible`

### `payment_status`
- `pending`, `succeeded`, `failed`, `refunded`, `partially_refunded`

### `payment_method_type`
- `credit_card`, `bank_transfer`, `ach`, `wire`, `manual`

---

## 22 Core Database Tables

| # | Table Name | Description | Key Relationships |
|---|------------|-------------|-------------------|
| 1 | `profiles` | User profiles linked to `auth.users` | `id -> auth.users.id` |
| 2 | `customers` | B2B enterprise customer organizations | `profile_id -> profiles.id` |
| 3 | `products` | Core catalog products | Self-contained |
| 4 | `product_variants` | Product SKUs and technical attributes | `product_id -> products.id` |
| 5 | `plans` | Recurring billing tiers and pricing | `product_id -> products.id`, `variant_id -> product_variants.id` |
| 6 | `plan_rules` | Feature gates and resource quota constraints | `plan_id -> plans.id` |
| 7 | `quotation_templates` | Standard sales quotation templates | Self-contained |
| 8 | `quotation_template_items` | Template line items and standard discounts | `template_id -> quotation_templates.id`, `product_id -> products.id` |
| 9 | `quotations` | Sales quotes issued to customers | `customer_id -> customers.id`, `converted_subscription_id -> subscriptions.id` |
| 10 | `quotation_items` | Itemized quotation line items with snapshots | `quotation_id -> quotations.id` |
| 11 | `subscriptions` | Active customer subscriptions | `customer_id -> customers.id`, `plan_id -> plans.id` |
| 12 | `subscription_items` | Add-on products and multi-tier items attached | `subscription_id -> subscriptions.id` |
| 13 | `taxes` | Tax rates and regional jurisdictions | Self-contained (ISO country/state) |
| 14 | `discounts` | Fixed and percentage coupon codes | Self-contained |
| 15 | `discount_products` | Restricts coupons to specific products | `discount_id -> discounts.id`, `product_id -> products.id` |
| 16 | `discount_usages` | Customer redemption ledger | `discount_id -> discounts.id`, `customer_id -> customers.id`, `invoice_id -> invoices.id` |
| 17 | `invoices` | Billing statements with due dates and balances | `customer_id -> customers.id`, `subscription_id -> subscriptions.id` |
| 18 | `invoice_items` | Historical price/tax snapshot line items | `invoice_id -> invoices.id` |
| 19 | `payments` | Inbound cash and card payment records | `customer_id -> customers.id` |
| 20 | `payment_allocations` | Many-to-many split ledger between payments and invoices | `payment_id -> payments.id`, `invoice_id -> invoices.id` |
| 21 | `billing_logs` | Automated cron and webhook execution history | `subscription_id -> subscriptions.id`, `customer_id -> customers.id` |
| 22 | `audit_logs` | Immutable audit trail for compliance | `user_id -> auth.users.id` |

---

## Critical Constraints

1. **Duplicate Billing Prevention:**
   ```sql
   CONSTRAINT uq_subscription_period UNIQUE (subscription_id, period_start, period_end)
   ```
2. **Numeric Precision:**
   All monetary fields (`unit_price`, `subtotal`, `tax_amount`, `discount_amount`, `total_amount`, `amount_paid`, `amount_due`, `allocated_amount`) strictly enforce `NUMERIC(14,2)` and `CHECK (field >= 0)`.
3. **Discount Sanity:**
   `CHECK (type != 'percentage' OR (value >= 0 AND value <= 100))`
4. **Subscription Period Logic:**
   `CHECK (current_period_end >= current_period_start)`
