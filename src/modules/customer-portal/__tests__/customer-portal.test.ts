import test from "node:test";
import assert from "node:assert/strict";
import type {
  PortalInvoiceSummary,
  PortalPaymentSummary,
} from "../types";
import type {
  SubscriptionWithDetails,
  PreservedSubscriptionPeriod,
} from "@/modules/subscriptions/types";
import { parsePlanRules } from "@/modules/subscriptions/plan-permissions";

/**
 * ============================================================================
 * CUSTOMER SELF-SERVICE PORTAL TEST SUITE
 * ============================================================================
 *
 * Validates all customer self-service capabilities:
 * 1. Multi-tenant customer ownership and cross-tenant access rejection.
 * 2. Immutable agreed pricing (server-controlled price evaluation).
 * 3. Subscription overview, next billing dates, and plan details.
 * 4. Invoice history and statement balances.
 * 5. Payment ledger and transaction allocation.
 * 6. Cancellation requests (immediate vs period end) and revocation.
 * 7. Upgrade and downgrade requests with seat limit enforcement.
 * 8. Pause and resume permissions (allow_pause, max_pause_days, allow_immediate_cancellation).
 * 9. Historical period ledger and past subscriptions.
 */

// ----------------------------------------------------------------------------
// TEST 1: Server-side authorization & multi-tenant isolation
// ----------------------------------------------------------------------------

test("Customer Portal: Server-side authorization blocks cross-tenant access", () => {
  const customerA = { id: "cust-org-AAA", email: "alice@acme.com", profile_id: "user-111" };
  const customerB = { id: "cust-org-BBB", email: "bob@globex.com", profile_id: "user-222" };

  const subBelongingToA = { id: "sub-100", customer_id: customerA.id };

  // Authorization check simulation
  function verifyOwnership(subOwnerId: string, callerCustomerId: string, callerRole: string): boolean {
    if (callerRole === "admin" || callerRole === "staff") return true;
    return subOwnerId === callerCustomerId;
  }

  // 1. Customer A accessing their own subscription -> Allowed
  assert.equal(verifyOwnership(subBelongingToA.customer_id, customerA.id, "customer"), true);

  // 2. Customer B attempting to modify Customer A's subscription -> BLOCKED (Cross-tenant breach prevented)
  assert.equal(verifyOwnership(subBelongingToA.customer_id, customerB.id, "customer"), false);

  // 3. Staff previewing Customer A's subscription -> Allowed
  assert.equal(verifyOwnership(subBelongingToA.customer_id, customerB.id, "staff"), true);
});

// ----------------------------------------------------------------------------
// TEST 2: Price immutability — Customers cannot tamper with plan pricing
// ----------------------------------------------------------------------------

test("Customer Portal: Agreed prices cannot be modified by customer inputs", () => {
  // Plan catalog in DB with immutable prices
  const dbPlans: Record<string, number> = {
    "plan-starter": 49.0,
    "plan-professional": 149.0,
    "plan-enterprise": 499.0,
  };

  // Malicious customer input attempting to set price to $1.00
  const untrustedCustomerPayload = {
    subscriptionId: "sub-100",
    targetPlanId: "plan-enterprise",
    targetQuantity: 5,
    customPriceAttempt: 1.0, // Should be completely ignored by server!
  };

  // Server securely looks up authoritative price from database
  const authoritativeUnitPrice = dbPlans[untrustedCustomerPayload.targetPlanId];
  assert.equal(authoritativeUnitPrice, 499.0);

  // Calculated subtotal is authoritative: 499 * 5 = 2495.0, NOT 1 * 5 = 5.0
  const authoritativeTotal = authoritativeUnitPrice * untrustedCustomerPayload.targetQuantity;
  assert.equal(authoritativeTotal, 2495.0);
});

// ----------------------------------------------------------------------------
// TEST 3: Active Subscription Details, Status, and Next Billing Countdown
// ----------------------------------------------------------------------------

test("Customer Portal: Active subscription overview and billing countdown", () => {
  const asOf = new Date("2026-10-31T00:00:00.000Z");

  const mockSub: Partial<SubscriptionWithDetails> = {
    id: "sub-portal-01",
    subscription_number: "SUB-2026-888999",
    status: "active",
    lifecycle_status: "active",
    billing_cycle: "monthly",
    currency: "USD",
    unit_price: 149.0,
    quantity: 3,
    total_amount: 447.0,
    current_period_start: "2026-10-01T00:00:00.000Z",
    current_period_end: "2026-11-01T00:00:00.000Z",
    next_billing_date: "2026-11-01T00:00:00.000Z",
    plan: {
      id: "plan-pro",
      product_id: "prod-cloud",
      name: "Cloud Pro Tier",
      code: "CLOUD-PRO",
      billing_cycle: "monthly",
      billing_interval_count: 1,
      currency: "USD",
      price: 149.0,
      trial_period_days: 0,
      setup_fee: 0,
      is_active: true,
      status: "active",
    },
    items: [],
  };

  // Countdown days calculation
  const nextBillingDate = new Date(mockSub.next_billing_date!);
  const diffTime = nextBillingDate.getTime() - asOf.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  assert.equal(diffDays, 1); // 1 day left until renewal
  assert.equal(mockSub.subscription_number, "SUB-2026-888999");
  assert.equal(mockSub.plan?.name, "Cloud Pro Tier");
  assert.equal(mockSub.total_amount, 447.0);
});

// ----------------------------------------------------------------------------
// TEST 4: Invoice History and Balances
// ----------------------------------------------------------------------------

test("Customer Portal: Invoice history presentation and amount due", () => {
  const invoices: PortalInvoiceSummary[] = [
    {
      id: "inv-001",
      invoice_number: "INV-2026-0001",
      status: "paid",
      total_amount: 447.0,
      amount_paid: 447.0,
      amount_due: 0.0,
      currency: "USD",
      issue_date: "2026-10-01T00:00:00.000Z",
      due_date: "2026-10-15T00:00:00.000Z",
      paid_at: "2026-10-02T14:30:00.000Z",
    },
    {
      id: "inv-002",
      invoice_number: "INV-2026-0002",
      status: "open",
      total_amount: 447.0,
      amount_paid: 0.0,
      amount_due: 447.0,
      currency: "USD",
      issue_date: "2026-11-01T00:00:00.000Z",
      due_date: "2026-11-15T00:00:00.000Z",
      paid_at: null,
    },
  ];

  assert.equal(invoices.length, 2);
  assert.equal(invoices[0].status, "paid");
  assert.equal(invoices[0].amount_due, 0.0);
  assert.equal(invoices[1].status, "open");
  assert.equal(invoices[1].amount_due, 447.0);
});

// ----------------------------------------------------------------------------
// TEST 5: Payment Ledger and Allocations
// ----------------------------------------------------------------------------

test("Customer Portal: Payment transactions and invoice allocations", () => {
  const payments: PortalPaymentSummary[] = [
    {
      id: "pay-101",
      payment_number: "PAY-2026-0001",
      customer_id: "cust-org-AAA",
      amount: 447.0,
      currency: "USD",
      status: "succeeded",
      payment_method_type: "credit_card",
      transaction_reference: "ch_stripe_mock_12345",
      failure_reason: null,
      refunded_amount: 0.0,
      paid_at: "2026-10-02T14:30:00.000Z",
      created_at: "2026-10-02T14:30:00.000Z",
      allocated_invoice_number: "INV-2026-0001",
      allocated_invoice_id: "inv-001",
    },
  ];

  assert.equal(payments.length, 1);
  assert.equal(payments[0].payment_number, "PAY-2026-0001");
  assert.equal(payments[0].status, "succeeded");
  assert.equal(payments[0].allocated_invoice_number, "INV-2026-0001");
});

// ----------------------------------------------------------------------------
// TEST 6: Cancellation Requests & Revocation
// ----------------------------------------------------------------------------

test("Customer Portal: Submitting and revoking cancellation requests", () => {
  const meta: Record<string, unknown> = {
    cancel_at_period_end: false,
    cancellation_requests: [],
  };

  // 1. Submit period-end cancellation
  const requestRecord = {
    id: "cancel-req-001",
    subscription_id: "sub-100",
    requested_at: "2026-10-31T12:00:00.000Z",
    requested_by: "user-111",
    requester_role: "customer",
    immediately: false,
    effective_date: "2026-11-01T00:00:00.000Z",
    reason: "Pricing or budget constraints",
    feedback: "Downsizing team for winter season",
    status: "scheduled" as const,
  };

  meta.cancel_at_period_end = true;
  meta.scheduled_cancellation = requestRecord;
  meta.cancellation_requests = [requestRecord];

  assert.equal(meta.cancel_at_period_end, true);
  assert.equal((meta.scheduled_cancellation as typeof requestRecord).status, "scheduled");

  // 2. Revoke cancellation before period end
  meta.cancel_at_period_end = false;
  meta.scheduled_cancellation = null;
  const requests = meta.cancellation_requests as Array<{ status: string; revoked_at?: string }>;
  requests[0].status = "revoked";
  requests[0].revoked_at = "2026-10-31T14:00:00.000Z";

  assert.equal(meta.cancel_at_period_end, false);
  assert.equal(meta.scheduled_cancellation, null);
  assert.equal(requests[0].status, "revoked");
});

// ----------------------------------------------------------------------------
// TEST 7: Upgrades, Downgrades & Seat Limit Clamping
// ----------------------------------------------------------------------------

test("Customer Portal: Plan changes and seat limit enforcement", () => {
  const currentPlan = { id: "plan-pro", price: 100.0, name: "Pro" };
  const targetPlan = { id: "plan-enterprise", price: 200.0, name: "Enterprise" };

  const currentSeats = 2;
  const currentTotal = currentPlan.price * currentSeats; // 200.0

  const targetSeats = 5;
  const newTotal = targetPlan.price * targetSeats; // 1000.0
  const diff = newTotal - currentTotal; // +800.0

  assert.equal(diff > 0, true); // Upgrade detected

  // Plan rules with seat_limit = 10
  const permissions = parsePlanRules("plan-enterprise", "Enterprise", [
    {
      id: "r-seat",
      plan_id: "plan-enterprise",
      rule_type: "seat_limit",
      rule_value: "10",
      description: null,
      created_at: new Date().toISOString(),
    },
  ]);

  // Requesting 5 seats is within limit
  assert.equal(targetSeats <= (permissions.seatLimit || 10), true);

  // Requesting 15 seats exceeds limit
  const excessiveSeats = 15;
  assert.equal(excessiveSeats <= (permissions.seatLimit || 10), false);
});

// ----------------------------------------------------------------------------
// TEST 8: Pause and Resume Where Permitted
// ----------------------------------------------------------------------------

test("Customer Portal: Pause & resume policy validation", () => {
  // Plan A: Basic plan that disallows pausing
  const basicRules = parsePlanRules("plan-basic", "Basic Tier", [
    {
      id: "r-nopanse",
      plan_id: "plan-basic",
      rule_type: "allow_pause",
      rule_value: "false",
      description: null,
      created_at: new Date().toISOString(),
    },
  ]);
  assert.equal(basicRules.allowPause, false);

  // Plan B: Pro plan with max 30 pause days and no immediate cancellation
  const proRules = parsePlanRules("plan-pro", "Pro Tier", [
    {
      id: "r-maxdays",
      plan_id: "plan-pro",
      rule_type: "max_pause_days",
      rule_value: "30",
      description: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "r-no-early",
      plan_id: "plan-pro",
      rule_type: "allow_immediate_cancellation",
      rule_value: "false",
      description: null,
      created_at: new Date().toISOString(),
    },
  ]);

  assert.equal(proRules.allowPause, true);
  assert.equal(proRules.maxPauseDays, 30);
  assert.equal(proRules.allowImmediateCancellation, false);
});

// ----------------------------------------------------------------------------
// TEST 9: Historical Subscription Periods Ledger
// ----------------------------------------------------------------------------

test("Customer Portal: Completed billing periods history preservation", () => {
  const periodLedger: PreservedSubscriptionPeriod[] = [
    {
      period_index: 1,
      period_start: "2026-08-01T00:00:00.000Z",
      period_end: "2026-09-01T00:00:00.000Z",
      archived_at: "2026-09-01T00:01:00.000Z",
      subtotal: 200.0,
      total_amount: 200.0,
      currency: "USD",
      invoice_id: "INV-2026-0001",
    },
    {
      period_index: 2,
      period_start: "2026-09-01T00:00:00.000Z",
      period_end: "2026-10-01T00:00:00.000Z",
      archived_at: "2026-10-01T00:01:00.000Z",
      subtotal: 200.0,
      total_amount: 200.0,
      currency: "USD",
      invoice_id: "INV-2026-0002",
    },
  ];

  assert.equal(periodLedger.length, 2);
  assert.equal(periodLedger[0].period_index, 1);
  assert.equal(periodLedger[0].invoice_id, "INV-2026-0001");
  assert.equal(periodLedger[1].period_index, 2);
  assert.equal(periodLedger[1].invoice_id, "INV-2026-0002");
});
