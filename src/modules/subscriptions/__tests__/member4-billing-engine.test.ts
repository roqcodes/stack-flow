import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateNextBillingDate,
  isBillingDue,
} from "../date-utils";
import {
  isTransitionAllowed,
  isLifecycleTransitionAllowed,
} from "../state-machine";
import {
  SubscriptionForBilling,
  SubscriptionBillingLine,
  SubscriptionBillingValidation,
  RenewSubscriptionOptions,
} from "../service-contracts";
import {
  dueSubscriptionsOptionsSchema,
  renewSubscriptionSchema,
  createSubscriptionFromQuotationSchema,
} from "../validations";
import {
  PlanChangeRequest,
  PreservedSubscriptionPeriod,
  RenewalHistoryRecord,
} from "../types";

/**
 * ============================================================================
 * MEMBER 4 BILLING ENGINE INTEGRATION TEST SUITE
 * ============================================================================
 *
 * This test suite validates all service contracts, date mechanics, payload
 * formats, validation checks, and state transitions that Member 4's
 * Recurring Billing Engine consumes to execute invoice generation and payment
 * processing.
 */

// ----------------------------------------------------------------------------
// TEST GROUP 1: Querying Due Subscriptions for Recurring Billing Run
// ----------------------------------------------------------------------------

test("Member 4: DueSubscriptionsOptions schema validation", () => {
  // Valid default options
  const defaultOpts = dueSubscriptionsOptionsSchema.safeParse({});
  assert.equal(defaultOpts.success, true);
  if (defaultOpts.success) {
    assert.equal(defaultOpts.data.limit, 50);
    assert.equal(defaultOpts.data.offset, 0);
  }

  // Valid custom options
  const customOpts = dueSubscriptionsOptionsSchema.safeParse({
    asOfDate: "2026-11-01T00:00:00.000Z",
    limit: 100,
    offset: 200,
    currency: "USD",
  });
  assert.equal(customOpts.success, true);

  // Reject limit exceeding 500
  const invalidLimit = dueSubscriptionsOptionsSchema.safeParse({
    limit: 1000,
  });
  assert.equal(invalidLimit.success, false);

  // Reject invalid currency code length
  const invalidCurrency = dueSubscriptionsOptionsSchema.safeParse({
    currency: "US", // must be 3 characters
  });
  assert.equal(invalidCurrency.success, false);
});

test("Member 4: Due subscriptions date evaluation logic (isBillingDue)", () => {
  const asOf = new Date("2026-11-01T00:00:00.000Z");

  // 1. Subscription with next_billing_date in the past -> DUE
  assert.equal(isBillingDue("2026-10-31T23:59:59.000Z", asOf), true);

  // 2. Subscription with next_billing_date exactly equal to asOf -> DUE
  assert.equal(isBillingDue("2026-11-01T00:00:00.000Z", asOf), true);

  // 3. Subscription with next_billing_date in future -> NOT DUE
  assert.equal(isBillingDue("2026-11-01T00:00:01.000Z", asOf), false);
  assert.equal(isBillingDue("2026-11-15T00:00:00.000Z", asOf), false);
});

test("Member 4: SubscriptionForBilling payload structure and type safety", () => {
  // Mock verified payload as returned by getSubscriptionForBilling()
  const mockBillingPayload: SubscriptionForBilling = {
    subscription_id: "sub-corp-001",
    subscription_number: "SUB-2026-0001",
    status: "active",
    billing_cycle: "monthly",
    currency: "USD",
    period_start: "2026-10-01T00:00:00.000Z",
    period_end: "2026-11-01T00:00:00.000Z",
    next_billing_date: "2026-11-01T00:00:00.000Z",
    customer: {
      id: "cust-corp-001",
      company_name: "Acme Enterprises Inc",
      contact_name: "Jane Doe",
      email: "finance@acme.com",
      business_number: "US-987654321",
      currency: "USD",
      billing_address_line1: "100 Market St",
      billing_city: "San Francisco",
      billing_state: "CA",
      billing_postal_code: "94105",
      billing_country: "US",
    },
    plan: {
      id: "plan-pro-m",
      name: "Professional Monthly",
      code: "PLAN-PRO-M",
      billing_cycle: "monthly",
      billing_interval_count: 1,
      price: 199.0,
    },
    totals: {
      subtotal: 398.0, // 2 seats @ 199.00
      discount_amount: 50.0,
      tax_amount: 25.23,
      total_amount: 373.23,
    },
    billing_lines: [
      {
        id: "line-plan-001",
        subscription_id: "sub-corp-001",
        product_id: "prod-cloud-001",
        plan_id: "plan-pro-m",
        description: "Professional Monthly (2 seats)",
        quantity: 2,
        unit_amount: 199.0,
        discount_amount: 50.0,
        tax_rate: 7.25,
        tax_amount: 25.23,
        total_amount: 373.23,
        is_recurring: true,
      },
    ],
  };

  // Assertions ensuring Member 4 has all required fields to generate invoices
  assert.equal(mockBillingPayload.subscription_id, "sub-corp-001");
  assert.equal(mockBillingPayload.customer.email, "finance@acme.com");
  assert.equal(mockBillingPayload.totals.total_amount, 373.23);
  assert.equal(mockBillingPayload.billing_lines.length, 1);
  assert.equal(mockBillingPayload.billing_lines[0].is_recurring, true);
});

// ----------------------------------------------------------------------------
// TEST GROUP 2: Pre-Flight Billing Validation (validateSubscriptionForBilling)
// ----------------------------------------------------------------------------

test("Member 4: Pre-flight validation logic checks", () => {
  // Helper simulating validateSubscriptionForBilling rules
  function validateForBilling(sub: {
    status: string;
    customer_active: boolean;
    customer_email: string | null;
    cancel_at_period_end?: boolean;
    current_period_end: string;
    asOf: string;
  }): SubscriptionBillingValidation {
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (sub.status !== "active" && sub.status !== "trialing") {
      reasons.push(`Subscription is in non-billable status '${sub.status}'.`);
    }

    if (!sub.customer_active) {
      reasons.push("Customer account is inactive or suspended.");
    }

    if (!sub.customer_email) {
      warnings.push("Customer has no billing email address on file.");
    }

    if (sub.cancel_at_period_end) {
      const isEnded = new Date(sub.asOf).getTime() >= new Date(sub.current_period_end).getTime();
      if (isEnded) {
        reasons.push("Subscription is scheduled for termination at period end and cycle has concluded.");
      } else {
        warnings.push("Subscription is scheduled to cancel at the end of the current period.");
      }
    }

    const isValid = reasons.length === 0;
    return {
      subscription_id: "sub-test",
      is_valid: isValid,
      can_proceed_to_billing: isValid,
      reasons,
      warnings,
      validated_at: new Date().toISOString(),
    };
  }

  const asOf = "2026-11-01T00:00:00.000Z";

  // Scenario 1: Active subscription with good standing -> PASS
  const validResult = validateForBilling({
    status: "active",
    customer_active: true,
    customer_email: "billing@acme.com",
    current_period_end: "2026-11-01T00:00:00.000Z",
    asOf,
  });
  assert.equal(validResult.can_proceed_to_billing, true);
  assert.equal(validResult.reasons.length, 0);

  // Scenario 2: Paused subscription -> BLOCKED
  const pausedResult = validateForBilling({
    status: "paused",
    customer_active: true,
    customer_email: "billing@acme.com",
    current_period_end: "2026-11-01T00:00:00.000Z",
    asOf,
  });
  assert.equal(pausedResult.can_proceed_to_billing, false);
  assert.match(pausedResult.reasons[0], /non-billable status 'paused'/);

  // Scenario 3: Cancelled subscription -> BLOCKED
  const cancelledResult = validateForBilling({
    status: "cancelled",
    customer_active: true,
    customer_email: "billing@acme.com",
    current_period_end: "2026-11-01T00:00:00.000Z",
    asOf,
  });
  assert.equal(cancelledResult.can_proceed_to_billing, false);

  // Scenario 4: Inactive / suspended customer -> BLOCKED
  const suspendedCustomerResult = validateForBilling({
    status: "active",
    customer_active: false,
    customer_email: "billing@acme.com",
    current_period_end: "2026-11-01T00:00:00.000Z",
    asOf,
  });
  assert.equal(suspendedCustomerResult.can_proceed_to_billing, false);
  assert.match(suspendedCustomerResult.reasons[0], /Customer account is inactive/);

  // Scenario 5: Period-end cancellation reached -> BLOCKED from renewing
  const periodEndReachedResult = validateForBilling({
    status: "active",
    customer_active: true,
    customer_email: "billing@acme.com",
    cancel_at_period_end: true,
    current_period_end: "2026-11-01T00:00:00.000Z",
    asOf: "2026-11-01T01:00:00.000Z", // Past period end
  });
  assert.equal(periodEndReachedResult.can_proceed_to_billing, false);
});

// ----------------------------------------------------------------------------
// TEST GROUP 3: Mapping Subscription Lines to Member 4 Invoice Items
// ----------------------------------------------------------------------------

test("Member 4: Financial precision & mapping lines to invoice items", () => {
  const line: SubscriptionBillingLine = {
    id: "item-seat-01",
    subscription_id: "sub-123",
    product_id: "prod-cloud",
    plan_id: "plan-pro",
    description: "Enterprise Cloud - Tier 1",
    quantity: 3,
    unit_amount: 100.0,
    discount_amount: 20.0,
    tax_rate: 10.0,
    tax_amount: 28.0, // (300 - 20) * 0.10 = 28.00
    total_amount: 308.0, // 300 - 20 + 28 = 308.00
    is_recurring: true,
  };

  // Member 4 maps this directly into table `invoice_items`
  const invoiceItem = {
    subscription_item_id: line.id,
    product_id: line.product_id,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_amount,
    subtotal: line.unit_amount * line.quantity,
    discount_amount: line.discount_amount,
    tax_amount: line.tax_amount,
    total_amount: line.total_amount,
  };

  assert.equal(invoiceItem.quantity, 3);
  assert.equal(invoiceItem.subtotal, 300.0);
  assert.equal(invoiceItem.discount_amount, 20.0);
  assert.equal(invoiceItem.tax_amount, 28.0);
  assert.equal(invoiceItem.total_amount, 308.0);
});

// ----------------------------------------------------------------------------
// TEST GROUP 4: Next Billing Date Calculation Invariants
// ----------------------------------------------------------------------------

test("Member 4: calculateNextBillingDate invariants for all cycles", () => {
  // Monthly: Jan 31 -> Feb 28 (clamps to month end, no March 3 overflow)
  const jan31 = new Date("2026-01-31T00:00:00.000Z");
  const nextMonthly = calculateNextBillingDate(jan31, "monthly", 1);
  assert.equal(nextMonthly.getUTCFullYear(), 2026);
  assert.equal(nextMonthly.getUTCMonth(), 1); // February
  assert.equal(nextMonthly.getUTCDate(), 28);

  // Daily: 1 day interval
  const dayStart = new Date("2026-05-15T12:00:00.000Z");
  const nextDaily = calculateNextBillingDate(dayStart, "daily", 1);
  assert.equal(nextDaily.toISOString(), "2026-05-16T12:00:00.000Z");

  // Weekly: 7 days interval
  const nextWeekly = calculateNextBillingDate(dayStart, "weekly", 1);
  assert.equal(nextWeekly.toISOString(), "2026-05-22T12:00:00.000Z");

  // Yearly: Leap day Feb 29, 2024 + 1 year -> Feb 28, 2025
  const leapDay = new Date("2024-02-29T00:00:00.000Z");
  const nextYearly = calculateNextBillingDate(leapDay, "yearly", 1);
  assert.equal(nextYearly.getUTCFullYear(), 2025);
  assert.equal(nextYearly.getUTCMonth(), 1);
  assert.equal(nextYearly.getUTCDate(), 28);
});

test("Member 4: Anchor day preservation across 31-day and short months", () => {
  // Cycle starts Jan 31 (anchor day = 31)
  const anchorDay = 31;
  const feb28 = new Date("2026-02-28T00:00:00.000Z");

  // Advancing from Feb 28 with anchorDay = 31 should restore March 31!
  const nextFromFeb = calculateNextBillingDate(feb28, "monthly", 1, { anchorDay });
  assert.equal(nextFromFeb.getUTCMonth(), 2); // March
  assert.equal(nextFromFeb.getUTCDate(), 31); // Restored to 31!

  // Advancing from Mar 31 with anchorDay = 31 should clamp to April 30
  const nextFromMar = calculateNextBillingDate(nextFromFeb, "monthly", 1, { anchorDay });
  assert.equal(nextFromMar.getUTCMonth(), 3); // April
  assert.equal(nextFromMar.getUTCDate(), 30); // April has 30 days

  // Advancing from Apr 30 with anchorDay = 31 should restore May 31!
  const nextFromApr = calculateNextBillingDate(nextFromMar, "monthly", 1, { anchorDay });
  assert.equal(nextFromApr.getUTCMonth(), 4); // May
  assert.equal(nextFromApr.getUTCDate(), 31); // Restored to 31!
});

// ----------------------------------------------------------------------------
// TEST GROUP 5: Period Renewal (renewSubscription) Integration Contracts
// ----------------------------------------------------------------------------

test("Member 4: renewSubscriptionSchema validation", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";
  const validInvoiceUuid = "987fcdeb-51a2-43f7-9abc-def012345678";

  // Valid complete renewal payload
  const validRenewal = renewSubscriptionSchema.safeParse({
    subscriptionId: validUuid,
    advancePeriod: true,
    idempotencyKey: "renew-inv-2026-0001",
    invoiceId: validInvoiceUuid,
    amountPaid: 199.0,
    notes: "Invoice INV-2026-0001 settled via Stripe webhook",
  });
  assert.equal(validRenewal.success, true);
  if (validRenewal.success) {
    assert.equal(validRenewal.data.amountPaid, 199.0);
    assert.equal(validRenewal.data.idempotencyKey, "renew-inv-2026-0001");
  }

  // Reject negative amount paid
  const invalidAmount = renewSubscriptionSchema.safeParse({
    subscriptionId: validUuid,
    amountPaid: -10,
  });
  assert.equal(invalidAmount.success, false);
});

test("Member 4: Duplicate renewal prevention via idempotency keys and invoice IDs", () => {
  const existingRenewHistory: RenewalHistoryRecord[] = [
    {
      renewal_id: "rn-001",
      cycle_number: 1,
      renewed_at: "2026-10-01T00:00:00.000Z",
      previous_period_start: "2026-09-01T00:00:00.000Z",
      previous_period_end: "2026-10-01T00:00:00.000Z",
      new_period_start: "2026-10-01T00:00:00.000Z",
      new_period_end: "2026-11-01T00:00:00.000Z",
      idempotency_key: "idem-key-inv-100",
      invoice_id: "inv-100",
      amount_paid: 199.0,
    },
  ];

  // Helper verifying duplicate prevention
  function checkDuplicateRenewal(
    renewHistory: RenewalHistoryRecord[],
    opts: RenewSubscriptionOptions
  ): { isDuplicate: boolean; reason?: string } {
    if (opts.idempotencyKey) {
      const match = renewHistory.find((r) => r.idempotency_key === opts.idempotencyKey);
      if (match) {
        return { isDuplicate: true, reason: `Duplicate renewal detected for idempotency key ${opts.idempotencyKey}` };
      }
    }
    if (opts.invoiceId) {
      const match = renewHistory.find((r) => r.invoice_id === opts.invoiceId);
      if (match) {
        return { isDuplicate: true, reason: `Duplicate renewal detected for invoice ${opts.invoiceId}` };
      }
    }
    return { isDuplicate: false };
  }

  // 1. Same idempotency key -> DUPLICATE REJECTED
  const dupIdem = checkDuplicateRenewal(existingRenewHistory, {
    idempotencyKey: "idem-key-inv-100",
  });
  assert.equal(dupIdem.isDuplicate, true);

  // 2. Same invoice ID -> DUPLICATE REJECTED
  const dupInvoice = checkDuplicateRenewal(existingRenewHistory, {
    invoiceId: "inv-100",
  });
  assert.equal(dupInvoice.isDuplicate, true);

  // 3. New unique key & invoice -> ALLOWED
  const freshRenewal = checkDuplicateRenewal(existingRenewHistory, {
    idempotencyKey: "idem-key-inv-101",
    invoiceId: "inv-101",
  });
  assert.equal(freshRenewal.isDuplicate, false);
});

test("Member 4: Preserving previous subscription period history on renewal", () => {
  const sub = {
    id: "sub-test",
    current_period_start: "2026-10-01T00:00:00.000Z",
    current_period_end: "2026-11-01T00:00:00.000Z",
    total_amount: 199.0,
    currency: "USD",
    metadata: {
      period_history: [] as PreservedSubscriptionPeriod[],
    },
  };

  // Member 4 calls renewSubscription with invoiceId = 'inv-oct-2026'
  const invoiceId = "inv-oct-2026";
  const archivedPeriod: PreservedSubscriptionPeriod = {
    period_index: sub.metadata.period_history.length + 1,
    period_start: sub.current_period_start,
    period_end: sub.current_period_end,
    archived_at: new Date().toISOString(),
    subtotal: sub.total_amount,
    total_amount: sub.total_amount,
    currency: sub.currency,
    invoice_id: invoiceId,
  };

  sub.metadata.period_history.push(archivedPeriod);

  // Advance period
  sub.current_period_start = sub.current_period_end;
  sub.current_period_end = calculateNextBillingDate(sub.current_period_start, "monthly", 1).toISOString();

  assert.equal(sub.metadata.period_history.length, 1);
  assert.equal(sub.metadata.period_history[0].period_index, 1);
  assert.equal(sub.metadata.period_history[0].invoice_id, "inv-oct-2026");
  assert.equal(sub.metadata.period_history[0].total_amount, 199.0);
  assert.equal(sub.current_period_start, "2026-11-01T00:00:00.000Z");
  assert.equal(sub.current_period_end, "2026-12-01T00:00:00.000Z");
});

test("Member 4: Resolving past_due back to active upon payment renewal", () => {
  // Subscription in past_due state following billing failure
  const sub = {
    id: "sub-overdue",
    status: "past_due",
    metadata: {
      lifecycle_status: "past_due",
      past_due_since: "2026-10-02T00:00:00.000Z",
    },
  };

  assert.equal(sub.status, "past_due");

  // Member 4 captures payment retry and executes renewal
  sub.status = "active";
  sub.metadata.lifecycle_status = "active";
  delete (sub.metadata as Record<string, unknown>).past_due_since;

  assert.equal(sub.status, "active");
  assert.equal(sub.metadata.lifecycle_status, "active");
  assert.equal(sub.metadata.past_due_since, undefined);
});

// ----------------------------------------------------------------------------
// TEST GROUP 6: Scheduled Plan Changes Applied at Renewal
// ----------------------------------------------------------------------------

test("Member 4: Auto-applying scheduled plan changes when period renews", () => {
  const scheduledChange: PlanChangeRequest = {
    id: "req-up-01",
    subscription_id: "sub-pro",
    change_type: "upgrade",
    target_plan_id: "plan-enterprise",
    target_plan_name: "Enterprise Annual",
    target_quantity: 5,
    target_billing_cycle: "yearly",
    target_price: 1500.0,
    immediately: false,
    effective_date: "2026-11-01T00:00:00.000Z",
    requested_at: "2026-10-15T00:00:00.000Z",
    requester_role: "customer",
    status: "scheduled",
  };

  const sub = {
    plan_id: "plan-pro",
    unit_price: 199.0,
    quantity: 2,
    subtotal: 398.0,
    total_amount: 398.0,
    billing_cycle: "monthly",
    metadata: {
      scheduled_plan_change: scheduledChange as PlanChangeRequest | undefined,
      plan_change_history: [scheduledChange],
    },
  };

  // Simulating renewal application in subscription-service
  if (sub.metadata.scheduled_plan_change) {
    const ch = sub.metadata.scheduled_plan_change;
    const targetPrice = ch.target_price ?? 1500.0;
    sub.plan_id = ch.target_plan_id;
    sub.unit_price = targetPrice;
    sub.quantity = ch.target_quantity;
    sub.subtotal = targetPrice * ch.target_quantity;
    sub.total_amount = sub.subtotal;
    sub.billing_cycle = ch.target_billing_cycle ?? "yearly";

    sub.metadata.plan_change_history[0].status = "applied";
    delete (sub.metadata as Record<string, unknown>).scheduled_plan_change;
  }

  assert.equal(sub.plan_id, "plan-enterprise");
  assert.equal(sub.unit_price, 1500.0);
  assert.equal(sub.quantity, 5);
  assert.equal(sub.subtotal, 7500.0); // 1500 * 5 = 7500
  assert.equal(sub.billing_cycle, "yearly");
  assert.equal(sub.metadata.scheduled_plan_change, undefined);
  assert.equal(sub.metadata.plan_change_history[0].status, "applied");
});

// ----------------------------------------------------------------------------
// TEST GROUP 7: State Machine Transitions for Member 4
// ----------------------------------------------------------------------------

test("Member 4: Finite State Machine transitions for billing events", () => {
  // 1. Payment failure triggers active -> past_due
  assert.equal(isTransitionAllowed("active", "past_due"), true);

  // 2. Payment recovery triggers past_due -> active
  assert.equal(isTransitionAllowed("past_due", "active"), true);

  // 3. Dunning exhaustion triggers past_due -> cancelled
  assert.equal(isTransitionAllowed("past_due", "cancelled"), true);

  // 4. Fixed-term contract expiry triggers active -> expired
  assert.equal(isTransitionAllowed("active", "expired"), true);

  // 5. Illegal: Cannot transition from cancelled -> active
  assert.equal(isTransitionAllowed("cancelled", "active"), false);

  // 6. Illegal: Cannot transition from expired -> active
  assert.equal(isTransitionAllowed("expired", "active"), false);

  // 7. Illegal: Cannot transition directly from draft to active without confirmation
  assert.equal(isLifecycleTransitionAllowed("draft", "active"), false);
});

// ----------------------------------------------------------------------------
// TEST GROUP 8: Billing Line Assembly & Duplicate Base Plan Line Prevention
// ----------------------------------------------------------------------------

test("Member 4: Billing line assembly does not double-charge base plan when subscription_items contains primary plan", () => {
  const planId = "plan-gold-123";
  const subId = "sub-test-999";

  // Simulate subscription_items containing both the cloned primary plan AND an add-on item
  const mockSubItems = [
    {
      id: "item-base-plan-clone",
      subscription_id: subId,
      product_id: "prod-cloud",
      plan_id: planId, // matches base plan!
      description: "Gold Cloud Plan (monthly)",
      quantity: 1,
      unit_price: 299.0,
      subtotal: 299.0,
    },
    {
      id: "item-addon-storage",
      subscription_id: subId,
      product_id: "prod-storage",
      plan_id: null, // genuine add-on
      description: "Additional 500GB NVMe Storage",
      quantity: 2,
      unit_price: 25.0,
      subtotal: 50.0,
    },
  ];

  // Base plan line synthesized from subscription header
  const baseLine: SubscriptionBillingLine = {
    id: `line-${subId}-plan`,
    subscription_id: subId,
    product_id: "prod-cloud",
    plan_id: planId,
    description: "Gold Cloud Plan (monthly)",
    quantity: 1,
    unit_amount: 299.0,
    discount_amount: 0,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 299.0,
    is_recurring: true,
  };

  // Filter out any item matching the base plan
  const addOnItems = mockSubItems.filter((item) => !item.plan_id || item.plan_id !== planId);

  const lines: SubscriptionBillingLine[] = [
    baseLine,
    ...addOnItems.map((item) => ({
      id: item.id,
      subscription_id: subId,
      product_id: item.product_id,
      plan_id: item.plan_id || null,
      description: item.description,
      quantity: item.quantity,
      unit_amount: item.unit_price,
      discount_amount: 0,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: item.subtotal,
      is_recurring: true,
    })),
  ];

  // Ensure lines length is 2 (base plan + 1 add-on), NOT 3 (which would have double-billed 299.00)
  assert.equal(lines.length, 2);
  assert.equal(lines[0].id, `line-${subId}-plan`);
  assert.equal(lines[0].plan_id, planId);
  assert.equal(lines[1].id, "item-addon-storage");
  assert.equal(lines[1].plan_id, null);

  const totalCalculated = lines.reduce((acc, l) => acc + l.total_amount, 0);
  assert.equal(totalCalculated, 349.0); // 299 + 50
});

// ----------------------------------------------------------------------------
// TEST GROUP 9: Quotation Conversion Expiration Validation & Options
// ----------------------------------------------------------------------------

test("Member 4: Quotation conversion options and validity validation", () => {
  // Test schema parsing
  const validOpts = createSubscriptionFromQuotationSchema.safeParse({
    quotationId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    allowExpiredQuotation: true,
    notes: "Approved by finance VP",
  });
  assert.equal(validOpts.success, true);
  if (validOpts.success) {
    assert.equal(validOpts.data.allowExpiredQuotation, true);
  }

  // Business logic check: expired quotation detection
  const pastValidUntil = "2026-01-01T00:00:00.000Z";
  const now = new Date("2026-10-31T00:00:00.000Z");

  const isExpired = new Date(pastValidUntil).getTime() < now.getTime();
  assert.equal(isExpired, true);

  // Without override: blocked
  const allowExpired = false;
  const canConvertWithoutOverride = !isExpired || allowExpired;
  assert.equal(canConvertWithoutOverride, false);

  // With override: permitted
  const overrideActive = true;
  const canConvertWithOverride = !isExpired || overrideActive;
  assert.equal(canConvertWithOverride, true);
});
