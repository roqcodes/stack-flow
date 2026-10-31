# Brightloop Member 3 — Subscription Service & Billing Engine Contracts

**Author:** Member 3 (Subscription Lifecycle & Customer Portal Lead)  
**Consumer:** Member 4 (Recurring Billing Engine & Financial Ledger Lead), Member 2 (Sales & Quotations)  
**Module Location:** `src/modules/subscriptions/`  
**Service Export:** `subscriptionService` (`@/modules/subscriptions/subscription-service`)

---

## 1. Architectural Scope & Invariants

Member 3 owns subscription lifecycle state, period calculations, line items, and the customer self-service portal.

1. **Monetary Precision:** All amounts are computed server-side and stored with `NUMERIC(14,2)` precision.
2. **Deterministic Dates:** `calculateNextBillingDate` handles calendar months without JavaScript month-overflow anomalies (e.g. Jan 31 + 1 month clamps strictly to Feb 28/29, never March 3).
3. **State Machine Invariant:** Transitions are strictly validated (`isTransitionAllowed`). Arbitrary or terminal transitions (such as resuming a `cancelled` subscription) throw explicit validation errors.
4. **Billing Boundaries:** Member 3 does **not** insert into `invoices`, `invoice_items`, `payments`, or `payment_allocations`. Instead, Member 3 exposes the exact contracts below for Member 4's billing engine to consume.

---

## 2. Mandatory Service Contracts Reference

```typescript
import { subscriptionService } from "@/modules/subscriptions/subscription-service";
```

### 1. `getDueSubscriptions(options?: DueSubscriptionsOptions): Promise<ApiResponse<SubscriptionForBilling[]>>`

**Purpose:** Called by Member 4's recurring billing worker/cron to find all active subscriptions whose `next_billing_date <= asOfDate`.

#### Signature
```typescript
async getDueSubscriptions(options?: {
  asOfDate?: Date | string; // Defaults to current timestamp
  limit?: number;           // Defaults to 50, max 500
  offset?: number;          // Defaults to 0
  currency?: string;        // Optional currency filter (e.g. "USD")
}): Promise<ApiResponse<SubscriptionForBilling[]>>
```

#### Return Type: `SubscriptionForBilling`
```typescript
interface SubscriptionForBilling {
  subscription_id: string;
  subscription_number: string;
  status: "active" | "trialing";
  billing_cycle: "daily" | "weekly" | "monthly" | "yearly";
  currency: string;
  period_start: string; // ISO 8601 UTC
  period_end: string;   // ISO 8601 UTC
  next_billing_date: string;
  customer: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    business_number?: string | null;
    currency: string;
    billing_address_line1?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_postal_code?: string | null;
    billing_country?: string | null;
  };
  plan: {
    id: string;
    name: string;
    code: string;
    billing_cycle: BillingCycle;
    billing_interval_count: number;
    price: number;
  };
  totals: {
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
  };
  billing_lines: SubscriptionBillingLine[];
}
```

---

### 2. `getSubscriptionForBilling(subscriptionId: string): Promise<ApiResponse<SubscriptionForBilling>>`

**Purpose:** Retrieves a single verified subscription payload ready for invoice generation.

#### Signature
```typescript
async getSubscriptionForBilling(
  subscriptionId: string
): Promise<ApiResponse<SubscriptionForBilling>>
```

---

### 3. `getSubscriptionBillingLines(subscriptionId: string): Promise<ApiResponse<SubscriptionBillingLine[]>>`

**Purpose:** Returns line items that Member 4 maps directly into `invoice_items` during invoice generation.

#### Signature
```typescript
async getSubscriptionBillingLines(
  subscriptionId: string
): Promise<ApiResponse<SubscriptionBillingLine[]>>
```

#### Line Format
```typescript
interface SubscriptionBillingLine {
  id: string;               // Unique line identifier
  subscription_id: string;
  product_id: string;
  plan_id?: string | null;
  description: string;      // Line description (e.g., "Professional Monthly (monthly tier)")
  quantity: number;
  unit_amount: number;      // NUMERIC(14,2)
  discount_amount: number;  // NUMERIC(14,2)
  tax_rate: number;         // Percentage rate
  tax_amount: number;       // NUMERIC(14,2)
  total_amount: number;     // NUMERIC(14,2)
  is_recurring: boolean;
}
```

---

### 4. `validateSubscriptionForBilling(subscriptionId: string): Promise<ApiResponse<SubscriptionBillingValidation>>`

**Purpose:** Pre-flight sanity checks executed before initiating automated charges or invoice generation.

#### Signature
```typescript
async validateSubscriptionForBilling(
  subscriptionId: string
): Promise<ApiResponse<SubscriptionBillingValidation>>
```

#### Return Type: `SubscriptionBillingValidation`
```typescript
interface SubscriptionBillingValidation {
  subscription_id: string;
  is_valid: boolean;
  can_proceed_to_billing: boolean;
  reasons: string[];  // Blocking reasons (e.g., "Customer suspended", "Subscription paused")
  warnings: string[]; // Non-blocking notices (e.g., "Customer missing tax ID")
  validated_at: string;
}
```

---

### 5. `calculateNextBillingDate(currentPeriodEnd: Date | string, cycle: BillingCycle, intervalCount?: number): Date`

**Purpose:** Pure, deterministic date calculation utility.

#### Signature
```typescript
function calculateNextBillingDate(
  currentPeriodEnd: Date | string,
  cycle: "daily" | "weekly" | "monthly" | "yearly",
  intervalCount: number = 1
): Date
```

**Behavioral Guarantees:**
- `"daily"`: `+ (1 * intervalCount)` UTC days.
- `"weekly"`: `+ (7 * intervalCount)` UTC days.
- `"monthly"`: `+ (1 * intervalCount)` UTC months with end-of-month day clamping (e.g., `2026-01-31` + 1 month = `2026-02-28`).
- `"yearly"`: `+ (1 * intervalCount)` UTC years (leap day `2024-02-29` + 1 year = `2025-02-28`).

---

### 6. `renewSubscription(subscriptionId: string, options?: RenewSubscriptionOptions): Promise<ApiResponse<Subscription>>`

**Purpose:** Called by Member 4 upon successful payment or cycle completion to advance the subscription to the next billing period.

#### Signature
```typescript
async renewSubscription(
  subscriptionId: string,
  options?: { advancePeriod?: boolean }
): Promise<ApiResponse<Subscription>>
```

**Actions Taken:**
1. Verifies subscription is not in terminal status (`cancelled`, `expired`).
2. Advances `current_period_start = old current_period_end`.
3. Sets `current_period_end = calculateNextBillingDate(old current_period_end, cycle, intervalCount)`.
4. Sets `next_billing_date = new current_period_end`.
5. Resets `status = 'active'` (resolves `past_due` standing).
6. Appends audit record to `metadata.renew_history`.

---

### 7. `createSubscriptionFromQuotation(quotationId: string, options?: CreateFromQuotationOptions): Promise<ApiResponse<SubscriptionWithDetails>>`

**Purpose:** Converts an accepted quotation into an active or trialing subscription.

#### Signature
```typescript
async createSubscriptionFromQuotation(
  quotationId: string,
  options?: {
    startDate?: string;
    overrideCycle?: BillingCycle;
    notes?: string;
  }
): Promise<ApiResponse<SubscriptionWithDetails>>
```

**Pre-conditions:**
- Quotation must exist with `status = 'accepted'`.
- Quotation must not already have `converted_subscription_id` populated.
- Customer must be in `active` standing.

---

### 8. `getSubscriptionById(id: string): Promise<ApiResponse<SubscriptionWithDetails>>`

**Purpose:** Retrieves full composite subscription with customer, plan, and attached line items.

#### Signature
```typescript
async getSubscriptionById(
  id: string
): Promise<ApiResponse<SubscriptionWithDetails>>
```

---

### 9. `pauseSubscription(subscriptionId: string, options?: PauseSubscriptionOptions): Promise<ApiResponse<Subscription>>`

**Purpose:** Transitions subscription from `active` to `paused`. Enforces plan-specific permissions (`allow_pause`, `max_pause_days`) and records audit history in `metadata.pause_history`.

#### Signature
```typescript
async pauseSubscription(
  subscriptionId: string,
  options?: {
    reason?: string;
    resumeScheduledAt?: string; // Optional auto-resume date validated against plan max_pause_days
    actorRole?: string;
    actorId?: string;
  }
): Promise<ApiResponse<Subscription>>
```

---

### 10. `resumeSubscription(subscriptionId: string, options?: ResumeSubscriptionOptions): Promise<ApiResponse<Subscription>>`

**Purpose:** Transitions subscription from `paused` to `active`. Supports immediate cycle reset (`resumeBillingNow: true`) or unspent days credit preservation (`resumeBillingNow: false`). Records audit history in `metadata.resume_history`.

#### Signature
```typescript
async resumeSubscription(
  subscriptionId: string,
  options?: {
    resumeBillingNow?: boolean; // true = reset billing interval today; false = credit remaining unspent days
    actorRole?: string;
    actorId?: string;
  }
): Promise<ApiResponse<Subscription>>
```

---

### 11. `closeSubscription(subscriptionId: string, options?: CloseSubscriptionOptions): Promise<ApiResponse<Subscription>>`

**Purpose:** Terminates or closes a subscription.
- `immediately: true` (default): Early Closure terminating immediately (`status = 'cancelled'`, `lifecycle_status = 'closed'`, `cancelled_at = now`, `ended_at = now`).
- `immediately: false`: Delegates to `submitCancellationRequest` to schedule automatic closure at `current_period_end`.

#### Signature
```typescript
async closeSubscription(
  subscriptionId: string,
  options?: {
    reason?: string;
    immediately?: boolean; // true = early closure now; false = schedule automatic closure at period end
    feedback?: string;
    actorRole?: string;
    actorId?: string;
  }
): Promise<ApiResponse<Subscription>>
```

---

### 12. `submitCancellationRequest(options: SubmitCancellationRequestOptions): Promise<ApiResponse<Subscription>>`

**Purpose:** Formal cancellation workflow used by Customer Self-Service Portal and staff.
- If `immediately: true`: executes immediate early closure.
- If `immediately: false`: schedules closure at `current_period_end`, setting `metadata.cancel_at_period_end = true` and creating a structured cancellation request with status `"scheduled"`. Excludes subscription from future billing runs in `getDueSubscriptions` and `validateSubscriptionForBilling`.

#### Signature
```typescript
async submitCancellationRequest(options: {
  subscriptionId: string;
  immediately?: boolean;
  reason: string;
  feedback?: string;
  actorRole?: string;
  actorId?: string;
}): Promise<ApiResponse<Subscription>>
```

---

### 13. `revokeCancellationRequest(subscriptionId: string, options?: RevokeCancellationRequestOptions): Promise<ApiResponse<Subscription>>`

**Purpose:** Allows customer or staff to reverse and revoke a scheduled period-end cancellation prior to `current_period_end`. Restores normal recurring renewal status.

#### Signature
```typescript
async revokeCancellationRequest(
  subscriptionId: string,
  options?: {
    notes?: string;
    actorRole?: string;
    actorId?: string;
  }
): Promise<ApiResponse<Subscription>>
```

---

### 14. `processAutomaticClosures(asOf?: Date | string): Promise<ApiResponse<{ closedCount: number; closedSubscriptionIds: string[] }>>`

**Purpose:** Background sweep service (triggered by cron / admin action) that finds subscriptions where `cancel_at_period_end === true` and `asOf >= current_period_end`, or fixed-term contracts reaching expiration. Transitions them automatically to `closed` with `ended_at = current_period_end`.

#### Signature
```typescript
async processAutomaticClosures(
  asOf?: Date | string
): Promise<ApiResponse<{ closedCount: number; closedSubscriptionIds: string[] }>>
```

---

### 15. `submitPlanChangeRequest(options: SubmitPlanChangeRequestOptions): Promise<ApiResponse<SubscriptionWithDetails>>`

**Purpose:** Upgrades, downgrades, or adjusts seats on an existing active or trialing subscription.
- Validates seat limits against plan rules.
- Classifies change type (`upgrade` vs `downgrade` vs `seat_adjustment` vs `cycle_change`).
- Evaluates plan permissions for staff approval (`requiresApproval`).
- If `immediately: true` and no approval required: recalculates pricing, updates subscription items immediately.
- If `immediately: false`: schedules change for `current_period_end` in `metadata.scheduled_plan_change` and preserves current billing terms until next renewal.
- Automatically applied during period renewal via `renewSubscription`.

#### Signature
```typescript
async submitPlanChangeRequest(options: {
  subscriptionId: string;
  targetPlanId: string;
  targetQuantity?: number;
  targetCycle?: BillingCycle;
  immediately?: boolean; // true = apply immediately; false = schedule for next renewal
  notes?: string;
  actorRole?: string;
  actorId?: string;
}): Promise<ApiResponse<SubscriptionWithDetails>>
```

---

### 16. `revokePlanChangeRequest(subscriptionId: string, options?: RevokePlanChangeRequestOptions): Promise<ApiResponse<SubscriptionWithDetails>>`

**Purpose:** Allows customer or staff to cancel a scheduled or pending plan change request before it takes effect at renewal.

#### Signature
```typescript
async revokePlanChangeRequest(
  subscriptionId: string,
  options?: {
    notes?: string;
    actorRole?: string;
    actorId?: string;
  }
): Promise<ApiResponse<SubscriptionWithDetails>>
```

---

### 17. `approvePlanChangeRequest(subscriptionId: string, options?: { notes?: string; actorId?: string }): Promise<ApiResponse<SubscriptionWithDetails>>`

**Purpose:** Allows staff/administrators to review and approve plan change requests that were submitted for plans requiring approval policy compliance.

#### Signature
```typescript
async approvePlanChangeRequest(
  subscriptionId: string,
  options?: {
    notes?: string;
    actorId?: string;
  }
): Promise<ApiResponse<SubscriptionWithDetails>>
```

---

## 3. Subscription Finite State Machine

```
               ┌──────────┐
               │ trialing │
               └────┬─────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    ┌─────────┐┌─────────┐┌─────────┐
    │ active  ││cancelled││ expired │
    └────┬────┘└─────────┘└─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────────┐
│paused │ │ past_due │
└───┬───┘ └────┬─────┘
    │          │
    └────┬─────┘
         ▼
    ┌─────────┐
    │ active  │ (re-activation / payment recovery)
    └─────────┘
```

| Current Status | Allowed Next Statuses | Notes |
|---|---|---|
| `trialing` | `active`, `cancelled`, `expired` | Converts upon trial completion or payment |
| `active` | `paused`, `past_due`, `cancelled`, `expired` | Standard operating state |
| `paused` | `active`, `cancelled` | Suspends recurring billing |
| `past_due` | `active`, `cancelled`, `expired` | Set by billing engine when charge fails |
| `cancelled` | *(None)* | Terminal state; immutable |
| `expired` | *(None)* | Terminal state; immutable |

---

## 4. Integration Example for Member 4

```typescript
import { subscriptionService } from "@/modules/subscriptions/subscription-service";

export async function executeAutomatedBillingCycle() {
  // 1. Fetch subscriptions due as of right now
  const dueResult = await subscriptionService.getDueSubscriptions({
    asOfDate: new Date(),
    limit: 100,
  });

  if (!dueResult.success) {
    console.error("Failed to query due subscriptions:", dueResult.error);
    return;
  }

  for (const sub of dueResult.data) {
    // 2. Pre-flight validation
    const validation = await subscriptionService.validateSubscriptionForBilling(sub.subscription_id);
    if (!validation.success || !validation.data.can_proceed_to_billing) {
      console.warn(`Skipping billing for ${sub.subscription_number}:`, validation.data?.reasons);
      continue;
    }

    // 3. Member 4 creates invoice in invoices table with sub.billing_lines
    // ... Member 4 generates invoice and charges customer ...

    // 4. Upon successful invoice payment, advance subscription period
    const renewResult = await subscriptionService.renewSubscription(sub.subscription_id);
    if (!renewResult.success) {
      console.error(`Failed to renew period for ${sub.subscription_number}`);
    }
  }
}
```

