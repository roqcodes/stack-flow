# Member 2 Handover — Catalog, Customers & Quotations

This document is the integration contract for **Member 3** (subscriptions & billing) and **Member 4** (taxes & discounts). All methods are **server actions** in `src/modules/*/actions.ts` unless noted. Responses use `ApiResponse<T>` from `@/lib/api-response`.

---

## Member 3 — Accepted quotation & subscription conversion

| Method | Module path | Purpose |
|--------|-------------|---------|
| `acceptQuotationAction(quotationId)` | `src/modules/quotations/actions.ts` | Transition `sent` → `accepted`, sets `accepted_at`. Line items remain in `quotation_items`. |
| `getAcceptedQuotationAction(quotationId)` | same | Load accepted quotation + customer billing snapshot + frozen line items. |
| `getQuotationAction(quotationId)` | same | Load any quotation with items (staff/admin). |

### Shared types (import from `@/modules/quotations/types`)

- `QuotationWithItems` — header, `items[]`, optional `customer` snapshot
- `QuotationItem` — persisted `unit_price`, `tax_rate`, `tax_amount`, `total_amount`, optional `product_id` / `plan_id`
- `QuotationCustomerSnapshot` — company, contact, email, billing address fields

### Rules

1. **Never re-price** from live `products` / `plans` after acceptance — use `quotation_items` only.
2. `converted_subscription_id` on `quotations` is owned by Member 3; Member 2 does not write it.
3. Acceptance requires status `sent`, not expired (`valid_until` ≥ today).

---

## Member 3 & 4 — Catalog & customer reads

| Method | Module path | Purpose |
|--------|-------------|---------|
| `getProductAction(productId)` | `src/modules/products/actions.ts` | Product + variants + plans. |
| `getProductVariantsAction(productId)` | same | Variants only. |
| `getProductPlansAction(productId)` | same | Plans for product. |
| `getPlanAction(planId)` | same | Plan + `plan_rules`. |
| `getEffectiveProductPricesAction(productId)` | same | **Pricing contract** — see below. |
| `listCustomersAction(filters?)` | `src/modules/customers/actions.ts` | Paginated directory. |
| `getCustomerAction(customerId)` | same | Single customer record. |

### `EffectiveProductPrice` (`@/modules/products/types`)

- Product-level `sales_price` / `cost_price` from `products.metadata` keys.
- Variant-level prices from `product_variants.attributes` keys (`sales_price`, `cost_price`).
- Active plans with `price`, `currency`, `billing_cycle`, `billing_interval_count`.
- Default currency from `products.metadata.currency` or `USD`.

Example metadata:

```json
{ "sales_price": 99.0, "cost_price": 42.5, "currency": "USD", "product_type": "saas" }
```

---

## Member 2 — Quotation documents (Prompt 2.6)

| Method / route | Purpose |
|----------------|---------|
| `GET /api/quotations/[quotationId]/pdf` | Authenticated staff/admin PDF download from snapshot. |
| `generateQuotationPdfAction(quotationId)` | Returns `{ filename, pdf_base64 }`. |
| `sendQuotationEmailAction(quotationId)` | Emails PDF via Resend when `RESEND_API_KEY` is set. |

Environment (server only):

- `RESEND_API_KEY` — required for email
- `QUOTATION_EMAIL_FROM` — optional sender (default Resend onboarding address)

---

## Quotation templates (Prompt 2.4)

Server actions: `listQuotationTemplatesAction`, `getQuotationTemplateAction`, `createQuotationTemplateAction`, `updateQuotationTemplateAction`, `addTemplateItemAction`, `removeTemplateItemAction`.

Types: `QuotationTemplate`, `QuotationTemplateItem`, `QuotationTemplateWithItems` in `@/modules/quotations/types`.

**Note:** Default validity for new quotations is set at creation time (`valid_until` on `quotations`). Template `terms` copy to quotations when selected at create.

---

## Permissions

Uses `@/modules/auth/permissions` with `requirePermission` / `requireRole` in actions:

- Catalog: `catalog:view`, `catalog:manage`
- Customers: `customers:view`, `customers:manage`
- Quotations: `quotations:view`, `quotations:manage`

---

## UI routes (Member 2)

| Route | Feature |
|-------|---------|
| `/products`, `/products/[id]` | Product CRUD, variants, plans, plan rules |
| `/customers`, `/customers/[id]` | Customer directory & detail |
| `/quotations`, `/quotations/[id]` | Quotations list, detail, PDF, email |

---

## Verification checklist

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Manual: create quotation → send → download PDF → accept → call `getAcceptedQuotationAction` and confirm line totals match PDF.

---

## Database tables (read-only for other members)

`products`, `product_variants`, `plans`, `plan_rules`, `customers`, `quotation_templates`, `quotation_template_items`, `quotations`, `quotation_items`

Do not alter schema without Member 1 approval; use new migrations only.
