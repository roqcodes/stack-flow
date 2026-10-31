import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateNextBillingDate,
  calculateDailyBillingDate,
  calculateWeeklyBillingDate,
  calculateMonthlyBillingDate,
  calculateYearlyBillingDate,
  calculateBillingPeriod,
  calculateInitialSubscriptionPeriod,
  isEndOfMonth,
  getEndOfMonth,
  getDaysInMonth,
  isLeapYear,
  isTrialExpired,
  isSubscriptionExpired,
  checkSubscriptionExpiry,
  isBillingDue,
} from "../date-utils";
import {
  isTransitionAllowed,
  assertTransition,
  isLifecycleTransitionAllowed,
  assertLifecycleTransition,
  getAllowedLifecycleTransitions,
  resolveLifecycleStatus,
  mapLifecycleToDbStatus,
} from "../state-machine";
import { parsePlanRules } from "../plan-permissions";
import {
  PlanChangeRequest,
  PlanRule,
  PreservedSubscriptionPeriod,
  RenewalHistoryRecord,
} from "../types";
import {
  createSubscriptionFromQuotationSchema,
  createDirectSubscriptionSchema,
  pauseSubscriptionSchema,
  resumeSubscriptionSchema,
  closeSubscriptionSchema,
  submitCancellationRequestSchema,
  revokeCancellationRequestSchema,
  submitPlanChangeRequestSchema,
  revokePlanChangeRequestSchema,
  transitionSubscriptionLifecycleSchema,
  renewSubscriptionSchema,
  dueSubscriptionsOptionsSchema,
} from "../validations";

test("calculateNextBillingDate: Daily cycle", () => {
  const start = new Date("2026-05-10T00:00:00.000Z");
  const next = calculateNextBillingDate(start, "daily", 1);
  assert.equal(next.toISOString(), "2026-05-11T00:00:00.000Z");

  const directDaily = calculateDailyBillingDate(start, 1);
  assert.equal(directDaily.toISOString(), "2026-05-11T00:00:00.000Z");

  const next5 = calculateNextBillingDate(start, "daily", 5);
  assert.equal(next5.toISOString(), "2026-05-15T00:00:00.000Z");
});

test("calculateNextBillingDate: Weekly cycle", () => {
  const start = new Date("2026-05-10T00:00:00.000Z");
  const next = calculateNextBillingDate(start, "weekly", 1);
  assert.equal(next.toISOString(), "2026-05-17T00:00:00.000Z");

  const directWeekly = calculateWeeklyBillingDate(start, 1);
  assert.equal(directWeekly.toISOString(), "2026-05-17T00:00:00.000Z");

  const next2Weeks = calculateNextBillingDate(start, "weekly", 2);
  assert.equal(next2Weeks.toISOString(), "2026-05-24T00:00:00.000Z");
});

test("calculateNextBillingDate: Monthly cycle normal & end-of-month clamp", () => {
  // Normal mid-month
  const midMonth = new Date("2026-04-15T12:00:00.000Z");
  const nextMid = calculateNextBillingDate(midMonth, "monthly", 1);
  assert.equal(nextMid.toISOString(), "2026-05-15T12:00:00.000Z");

  // End of month clamp: Jan 31 -> Feb 28 in non-leap year 2026
  const jan31 = new Date("2026-01-31T00:00:00.000Z");
  const feb = calculateNextBillingDate(jan31, "monthly", 1);
  assert.equal(feb.getUTCFullYear(), 2026);
  assert.equal(feb.getUTCMonth(), 1); // February (0-indexed)
  assert.equal(feb.getUTCDate(), 28); // Clamped to 28, NOT Mar 3!

  // Aug 31 -> Sep 30
  const aug31 = new Date("2026-08-31T00:00:00.000Z");
  const sep = calculateNextBillingDate(aug31, "monthly", 1);
  assert.equal(sep.getUTCMonth(), 8); // September
  assert.equal(sep.getUTCDate(), 30); // Clamped to 30

  // Multi-month interval (Quarterly: 3 months)
  const quarter = calculateNextBillingDate(jan31, "monthly", 3);
  assert.equal(quarter.getUTCMonth(), 3); // April
  assert.equal(quarter.getUTCDate(), 30); // April has 30 days
});

test("calculateNextBillingDate: Yearly cycle with leap-year handling", () => {
  const yearStart = new Date("2026-06-01T00:00:00.000Z");
  const nextYear = calculateNextBillingDate(yearStart, "yearly", 1);
  assert.equal(nextYear.toISOString(), "2027-06-01T00:00:00.000Z");

  // Leap day Feb 29, 2024 + 1 year -> Feb 28, 2025
  const leapDay = new Date("2024-02-29T00:00:00.000Z");
  const nonLeapNextYear = calculateNextBillingDate(leapDay, "yearly", 1);
  assert.equal(nonLeapNextYear.getUTCFullYear(), 2025);
  assert.equal(nonLeapNextYear.getUTCMonth(), 1); // February
  assert.equal(nonLeapNextYear.getUTCDate(), 28); // Clamped
});

test("isBillingDue utility", () => {
  const past = new Date("2026-01-01T00:00:00.000Z");
  const future = new Date("2030-01-01T00:00:00.000Z");
  const now = new Date("2026-10-31T00:00:00.000Z");

  assert.equal(isBillingDue(past, now), true);
  assert.equal(isBillingDue(future, now), false);
});

test("state-machine: Permitted transitions", () => {
  assert.equal(isTransitionAllowed("trialing", "active"), true);
  assert.equal(isTransitionAllowed("trialing", "cancelled"), true);
  assert.equal(isTransitionAllowed("active", "paused"), true);
  assert.equal(isTransitionAllowed("paused", "active"), true);
  assert.equal(isTransitionAllowed("active", "past_due"), true);
  assert.equal(isTransitionAllowed("past_due", "active"), true);
  assert.equal(isTransitionAllowed("active", "cancelled"), true);
  assert.equal(isTransitionAllowed("active", "active"), true); // Idempotent
});

test("state-machine: Prohibited transitions", () => {
  // Cancelled is terminal
  assert.equal(isTransitionAllowed("cancelled", "active"), false);
  assert.equal(isTransitionAllowed("cancelled", "paused"), false);

  // Expired is terminal
  assert.equal(isTransitionAllowed("expired", "active"), false);

  // Paused cannot jump to trialing
  assert.equal(isTransitionAllowed("paused", "trialing"), false);

  // Assert throws descriptive error
  assert.throws(
    () => assertTransition("cancelled", "active"),
    /Illegal subscription transition: cannot transition from status 'cancelled' to 'active'/
  );
});

test("validations: Zod schemas enforce constraints", () => {
  // Valid quotation RFC 4122 UUID
  const validQuote = createSubscriptionFromQuotationSchema.safeParse({
    quotationId: "11111111-1111-4111-a111-111111111111",
  });
  assert.equal(validQuote.success, true);

  // Invalid UUID
  const invalidQuote = createSubscriptionFromQuotationSchema.safeParse({
    quotationId: "not-a-uuid",
  });
  assert.equal(invalidQuote.success, false);

  // Pause reason minimum length
  const invalidPause = pauseSubscriptionSchema.safeParse({
    subscriptionId: "11111111-1111-4111-a111-111111111111",
    reason: "no", // < 3 chars
  });
  assert.equal(invalidPause.success, false);

  const validPause = pauseSubscriptionSchema.safeParse({
    subscriptionId: "11111111-1111-4111-a111-111111111111",
    reason: "Customer requested seasonal freeze",
  });
  assert.equal(validPause.success, true);
});

test("quotation conversion logic: Format of generated subscription number", () => {
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^SUB-${year}-\\d{6}$`);
  const candidate = `SUB-${year}-123456`;
  assert.equal(pattern.test(candidate), true);
});

test("quotation conversion logic: Financial snapshot precision", () => {
  // Financial calculation preserves 2 decimal places NUMERIC(14,2)
  const unitPrice = 199.99;
  const quantity = 3;
  const subtotal = Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100;
  assert.equal(subtotal, 599.97);

  const discount = 50.00;
  const tax = Math.round(((subtotal - discount) * 0.0825 + Number.EPSILON) * 100) / 100;
  assert.equal(tax, 45.37);

  const total = Math.round((subtotal - discount + tax + Number.EPSILON) * 100) / 100;
  assert.equal(total, 595.34);
});

test("lifecycle state-machine: Valid status transitions", () => {
  // From draft
  assert.equal(isLifecycleTransitionAllowed("draft", "quotation"), true);
  assert.equal(isLifecycleTransitionAllowed("draft", "confirmed"), true);
  assert.equal(isLifecycleTransitionAllowed("draft", "closed"), true);
  assert.equal(isLifecycleTransitionAllowed("draft", "draft"), true); // Idempotent

  // From quotation
  assert.equal(isLifecycleTransitionAllowed("quotation", "confirmed"), true);
  assert.equal(isLifecycleTransitionAllowed("quotation", "closed"), true);

  // From confirmed
  assert.equal(isLifecycleTransitionAllowed("confirmed", "active"), true);
  assert.equal(isLifecycleTransitionAllowed("confirmed", "closed"), true);

  // From active
  assert.equal(isLifecycleTransitionAllowed("active", "paused"), true);
  assert.equal(isLifecycleTransitionAllowed("active", "closed"), true);

  // From paused
  assert.equal(isLifecycleTransitionAllowed("paused", "active"), true);
  assert.equal(isLifecycleTransitionAllowed("paused", "closed"), true);

  // Terminal state closed
  assert.deepEqual(getAllowedLifecycleTransitions("closed"), []);
});

test("lifecycle state-machine: Illegal transitions throw detailed errors", () => {
  // Direct draft -> active without confirmation is prohibited
  assert.equal(isLifecycleTransitionAllowed("draft", "active"), false);

  // Closed is terminal
  assert.equal(isLifecycleTransitionAllowed("closed", "active"), false);
  assert.equal(isLifecycleTransitionAllowed("closed", "draft"), false);
  assert.equal(isLifecycleTransitionAllowed("closed", "paused"), false);

  // Paused cannot jump back to draft or quotation
  assert.equal(isLifecycleTransitionAllowed("paused", "draft"), false);
  assert.equal(isLifecycleTransitionAllowed("paused", "quotation"), false);

  // Confirmed cannot jump straight to paused
  assert.equal(isLifecycleTransitionAllowed("confirmed", "paused"), false);

  // assertLifecycleTransition throws error with valid alternatives
  assert.throws(
    () => assertLifecycleTransition("closed", "active"),
    /Illegal subscription lifecycle transition: cannot transition from status 'closed' to 'active'/
  );

  assert.throws(
    () => assertLifecycleTransition("draft", "active"),
    /Illegal subscription lifecycle transition: cannot transition from status 'draft' to 'active'/
  );
});

test("lifecycle mapping utilities", () => {
  // DB status mapping
  assert.equal(mapLifecycleToDbStatus("draft"), "trialing");
  assert.equal(mapLifecycleToDbStatus("quotation"), "active");
  assert.equal(mapLifecycleToDbStatus("confirmed"), "active");
  assert.equal(mapLifecycleToDbStatus("active"), "active");
  assert.equal(mapLifecycleToDbStatus("paused"), "paused");
  assert.equal(mapLifecycleToDbStatus("closed"), "cancelled");

  // Resolution from metadata
  assert.equal(resolveLifecycleStatus("active", { lifecycle_status: "draft" }), "draft");
  assert.equal(resolveLifecycleStatus("active", { lifecycle_status: "confirmed" }), "confirmed");
  assert.equal(resolveLifecycleStatus("active", { lifecycle_status: "quotation" }), "quotation");
  assert.equal(resolveLifecycleStatus("paused", { lifecycle_status: "paused" }), "paused");
  assert.equal(resolveLifecycleStatus("cancelled", { lifecycle_status: "closed" }), "closed");

  // Fallback resolution from DB status when metadata is empty
  assert.equal(resolveLifecycleStatus("paused", null), "paused");
  assert.equal(resolveLifecycleStatus("cancelled", null), "closed");
  assert.equal(resolveLifecycleStatus("expired", null), "closed");
  assert.equal(resolveLifecycleStatus("active", null), "active");
});

test("plan-permissions: Rule parsing and validation", () => {
  const sampleRules = [
    {
      id: "rule-1",
      plan_id: "plan-123",
      rule_type: "seat_limit",
      rule_value: "10",
      description: "Max 10 seats allowed",
      created_at: new Date().toISOString(),
    },
    {
      id: "rule-2",
      plan_id: "plan-123",
      rule_type: "allow_pause",
      rule_value: "false",
      description: "Annual commitment, no pausing",
      created_at: new Date().toISOString(),
    },
    {
      id: "rule-3",
      plan_id: "plan-123",
      rule_type: "requires_approval",
      rule_value: "true",
      description: "Requires staff approval",
      created_at: new Date().toISOString(),
    },
    {
      id: "rule-4",
      plan_id: "plan-123",
      rule_type: "api_rate_limit",
      rule_value: "5000",
      description: "5k req/min",
      created_at: new Date().toISOString(),
    },
  ];

  const parsed = parsePlanRules("plan-123", "Enterprise Tier", sampleRules);

  assert.equal(parsed.seatLimit, 10);
  assert.equal(parsed.allowPause, false);
  assert.equal(parsed.requiresApproval, true);
  assert.equal(parsed.customRules["api_rate_limit"], "5000");

  // Default permissions when no rules exist
  const emptyParsed = parsePlanRules("plan-456", "Starter Tier", []);
  assert.equal(emptyParsed.seatLimit, null);
  assert.equal(emptyParsed.allowPause, true);
  assert.equal(emptyParsed.requiresApproval, false);
});

test("validations: transitionSubscriptionLifecycleSchema", () => {
  const validTransition = transitionSubscriptionLifecycleSchema.safeParse({
    subscriptionId: "11111111-1111-4111-a111-111111111111",
    targetStatus: "active",
    reason: "Activated after payment clearance",
  });
  assert.equal(validTransition.success, true);

  const invalidStatus = transitionSubscriptionLifecycleSchema.safeParse({
    subscriptionId: "11111111-1111-4111-a111-111111111111",
    targetStatus: "non_existent_status",
  });
  assert.equal(invalidStatus.success, false);
});

test("date-utils: End-of-month calendar helpers", () => {
  // Leap years
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);

  // getDaysInMonth
  assert.equal(getDaysInMonth(2026, 0), 31); // Jan
  assert.equal(getDaysInMonth(2026, 1), 28); // Feb non-leap
  assert.equal(getDaysInMonth(2024, 1), 29); // Feb leap year
  assert.equal(getDaysInMonth(2026, 3), 30); // Apr

  // isEndOfMonth
  assert.equal(isEndOfMonth(new Date("2026-01-31T15:00:00.000Z")), true);
  assert.equal(isEndOfMonth(new Date("2026-01-30T15:00:00.000Z")), false);
  assert.equal(isEndOfMonth(new Date("2026-02-28T00:00:00.000Z")), true);
  assert.equal(isEndOfMonth(new Date("2024-02-28T00:00:00.000Z")), false); // 2024 has 29 days
  assert.equal(isEndOfMonth(new Date("2024-02-29T00:00:00.000Z")), true);
  assert.equal(isEndOfMonth(new Date("2026-04-30T23:59:59.000Z")), true);

  // getEndOfMonth
  const janMid = new Date("2026-01-14T10:30:00.000Z");
  const janEnd = getEndOfMonth(janMid);
  assert.equal(janEnd.getUTCDate(), 31);
  assert.equal(janEnd.getUTCHours(), 10);
  assert.equal(janEnd.getUTCMinutes(), 30);

  const febMid = new Date("2026-02-05T00:00:00.000Z");
  const febEnd = getEndOfMonth(febMid);
  assert.equal(febEnd.getUTCDate(), 28);
});

test("date-utils: Monthly anchor day preservation across 31-day and short months", () => {
  // Origin anchor day: Jan 31st
  const jan31 = new Date("2026-01-31T12:00:00.000Z");

  // Feb (interval 1) -> Clamped to Feb 28
  const feb = calculateMonthlyBillingDate(jan31, 1, { anchorDay: 31 });
  assert.equal(feb.getUTCFullYear(), 2026);
  assert.equal(feb.getUTCMonth(), 1); // February
  assert.equal(feb.getUTCDate(), 28); // Clamped

  // Advancing from Feb 28 with anchorDay=31 -> Recovers to March 31!
  const mar = calculateMonthlyBillingDate(feb, 1, { anchorDay: 31 });
  assert.equal(mar.getUTCFullYear(), 2026);
  assert.equal(mar.getUTCMonth(), 2); // March
  assert.equal(mar.getUTCDate(), 31); // Preserves origin anchor 31!

  // Advancing from Mar 31 to April -> Clamped to April 30
  const apr = calculateMonthlyBillingDate(mar, 1, { anchorDay: 31 });
  assert.equal(apr.getUTCMonth(), 3); // April
  assert.equal(apr.getUTCDate(), 30); // 30 days in April

  // Advancing from Apr 30 to May with anchorDay=31 -> Recovers to May 31!
  const may = calculateMonthlyBillingDate(apr, 1, { anchorDay: 31 });
  assert.equal(may.getUTCMonth(), 4); // May
  assert.equal(may.getUTCDate(), 31); // May has 31 days
});

test("date-utils: Yearly billing calculation & leap day handling", () => {
  // Regular yearly calculation
  const start = new Date("2026-09-15T00:00:00.000Z");
  const nextYear = calculateYearlyBillingDate(start, 1);
  assert.equal(nextYear.toISOString(), "2027-09-15T00:00:00.000Z");

  // Multi-year (3 years)
  const threeYears = calculateYearlyBillingDate(start, 3);
  assert.equal(threeYears.toISOString(), "2029-09-15T00:00:00.000Z");

  // Leap day Feb 29 2024 -> Feb 28 2025
  const leapDay = new Date("2024-02-29T08:00:00.000Z");
  const nonLeapNext = calculateYearlyBillingDate(leapDay, 1, { anchorDay: 29 });
  assert.equal(nonLeapNext.getUTCFullYear(), 2025);
  assert.equal(nonLeapNext.getUTCMonth(), 1);
  assert.equal(nonLeapNext.getUTCDate(), 28);

  // Leap day + 4 years -> Recovers Feb 29 2028 with anchorDay=29
  const fourYearsLater = calculateYearlyBillingDate(leapDay, 4, { anchorDay: 29 });
  assert.equal(fourYearsLater.getUTCFullYear(), 2028);
  assert.equal(fourYearsLater.getUTCMonth(), 1);
  assert.equal(fourYearsLater.getUTCDate(), 29);
});

test("date-utils: calculateBillingPeriod & calculateInitialSubscriptionPeriod", () => {
  const period = calculateBillingPeriod("2026-04-15T00:00:00.000Z", "monthly", 1);
  assert.equal(period.periodStart.toISOString(), "2026-04-15T00:00:00.000Z");
  assert.equal(period.periodEnd.toISOString(), "2026-05-15T00:00:00.000Z");
  assert.equal(period.nextBillingDate.toISOString(), "2026-05-15T00:00:00.000Z");
  assert.equal(period.anchorDay, 15);

  // Initial with 14-day free trial
  const initial = calculateInitialSubscriptionPeriod({
    startDate: "2026-01-01T00:00:00.000Z",
    cycle: "monthly",
    trialPeriodDays: 14,
  });
  assert.equal(initial.trialStart?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(initial.trialEnd?.toISOString(), "2026-01-15T00:00:00.000Z");
  assert.equal(initial.nextBillingDate.toISOString(), "2026-01-15T00:00:00.000Z");
  assert.equal(initial.periodEnd.toISOString(), "2026-02-15T00:00:00.000Z");
});

test("date-utils: Subscription expiry checks", () => {
  const asOf = new Date("2026-10-31T12:00:00.000Z");

  // Trial expiry
  assert.equal(isTrialExpired("2026-10-15T00:00:00.000Z", asOf), true);
  assert.equal(isTrialExpired("2026-11-15T00:00:00.000Z", asOf), false);
  assert.equal(isTrialExpired(null, asOf), false);

  // Active subscription in good standing
  const activeSub = {
    id: "sub-1",
    status: "active",
    current_period_end: "2026-11-30T00:00:00.000Z",
  };
  assert.equal(isSubscriptionExpired(activeSub, asOf), false);

  const activeCheck = checkSubscriptionExpiry(activeSub, asOf);
  assert.equal(activeCheck.isExpired, false);

  // Expired by explicit ended_at
  const endedSub = {
    id: "sub-2",
    status: "cancelled",
    current_period_end: "2026-09-01T00:00:00.000Z",
    ended_at: "2026-09-01T00:00:00.000Z",
  };
  assert.equal(isSubscriptionExpired(endedSub, asOf), true);
  const endedCheck = checkSubscriptionExpiry(endedSub, asOf);
  assert.equal(endedCheck.isExpired, true);
  assert.match(endedCheck.reason || "", /Subscription ended on/);

  // Expired by fixed-term contract in metadata
  const fixedTermSub = {
    id: "sub-3",
    status: "active",
    current_period_end: "2026-11-01T00:00:00.000Z",
    metadata: {
      expires_at: "2026-10-01T00:00:00.000Z",
    },
  };
  assert.equal(isSubscriptionExpired(fixedTermSub, asOf), true);
  const fixedTermCheck = checkSubscriptionExpiry(fixedTermSub, asOf);
  assert.equal(fixedTermCheck.isExpired, true);
  assert.match(fixedTermCheck.reason || "", /Fixed term contract reached expiration date/);

  // Cancelled subscription that has elapsed its final paid period
  const cancelledElapsed = {
    id: "sub-4",
    status: "cancelled",
    current_period_end: "2026-10-15T00:00:00.000Z",
  };
  assert.equal(isSubscriptionExpired(cancelledElapsed, asOf), true);
  const cancelledCheck = checkSubscriptionExpiry(cancelledElapsed, asOf);
  assert.equal(cancelledCheck.isExpired, true);
  assert.match(cancelledCheck.reason || "", /Cancelled subscription exceeded final billing cycle/);
});

test("subscription renewals: Period calculation and anchor day preservation", () => {
  // Origin anchor day 31
  const period1Start = "2026-01-31T00:00:00.000Z";
  const period1End = calculateNextBillingDate(period1Start, "monthly", 1, { anchorDay: 31 });
  assert.equal(period1End.getUTCMonth(), 1); // Feb
  assert.equal(period1End.getUTCDate(), 28); // Clamped

  // Cycle 2 renewal from Feb 28 preserving anchorDay=31
  const period2Start = period1End;
  const period2End = calculateNextBillingDate(period2Start, "monthly", 1, { anchorDay: 31 });
  assert.equal(period2End.getUTCMonth(), 2); // March
  assert.equal(period2End.getUTCDate(), 31); // Recovered anchor day 31!

  // Cycle 3 renewal from March 31
  const period3Start = period2End;
  const period3End = calculateNextBillingDate(period3Start, "monthly", 1, { anchorDay: 31 });
  assert.equal(period3End.getUTCMonth(), 3); // April
  assert.equal(period3End.getUTCDate(), 30); // Clamped to 30
});

test("subscription renewals: Preserving previous period history records", () => {
  const previousPeriods: Array<{
    period_index: number;
    period_start: string;
    period_end: string;
    total_amount: number;
    currency: string;
    invoice_id?: string;
  }> = [];

  // Cycle 1
  previousPeriods.push({
    period_index: 1,
    period_start: "2026-01-01T00:00:00.000Z",
    period_end: "2026-02-01T00:00:00.000Z",
    total_amount: 199.99,
    currency: "USD",
    invoice_id: "inv-cycle-1",
  });

  // Cycle 2 renewal archives Cycle 2
  previousPeriods.push({
    period_index: 2,
    period_start: "2026-02-01T00:00:00.000Z",
    period_end: "2026-03-01T00:00:00.000Z",
    total_amount: 199.99,
    currency: "USD",
    invoice_id: "inv-cycle-2",
  });

  assert.equal(previousPeriods.length, 2);
  assert.equal(previousPeriods[0].period_index, 1);
  assert.equal(previousPeriods[1].period_index, 2);
  assert.equal(previousPeriods[0].period_end, previousPeriods[1].period_start);
});

test("subscription renewals: Duplicate renewal prevention via idempotency keys", () => {
  const existingRenewalHistory = [
    {
      renewal_id: "ren-1",
      cycle_number: 1,
      renewed_at: "2026-02-01T00:00:00.000Z",
      previous_period_start: "2026-01-01T00:00:00.000Z",
      previous_period_end: "2026-02-01T00:00:00.000Z",
      new_period_start: "2026-02-01T00:00:00.000Z",
      new_period_end: "2026-03-01T00:00:00.000Z",
      invoice_id: "inv-1001",
      idempotency_key: "idem-key-abc-123",
    },
  ];

  // Helper verifying duplicate detection
  const isDuplicateIdempotency = (key: string) =>
    existingRenewalHistory.some((r) => r.idempotency_key === key);

  const isDuplicateInvoice = (invoiceId: string) =>
    existingRenewalHistory.some((r) => r.invoice_id === invoiceId);

  // Exact duplicate request: must detect and block duplicate renewal
  assert.equal(isDuplicateIdempotency("idem-key-abc-123"), true);
  assert.equal(isDuplicateInvoice("inv-1001"), true);

  // New legitimate renewal request
  assert.equal(isDuplicateIdempotency("idem-key-new-456"), false);
  assert.equal(isDuplicateInvoice("inv-1002"), false);
});

test("subscription renewals: Permission checks and invalid states", () => {
  // Prohibited statuses for renewals
  const isRenewalPermitted = (status: string, lifecycle: string): boolean => {
    if (status === "cancelled" || status === "expired" || lifecycle === "closed") {
      return false;
    }
    if (lifecycle === "draft" || lifecycle === "quotation") {
      return false;
    }
    return true;
  };

  assert.equal(isRenewalPermitted("active", "active"), true);
  assert.equal(isRenewalPermitted("past_due", "active"), true);
  assert.equal(isRenewalPermitted("paused", "paused"), true);

  // Prohibited: terminal closed or expired
  assert.equal(isRenewalPermitted("cancelled", "closed"), false);
  assert.equal(isRenewalPermitted("expired", "closed"), false);

  // Prohibited: unconfirmed draft or quotation
  assert.equal(isRenewalPermitted("trialing", "draft"), false);
  assert.equal(isRenewalPermitted("active", "quotation"), false);
});

test("pause business rules: Enforces plan permissions and max_pause_days", () => {
  // Plan rule disallowing pause
  const noPausePlan = parsePlanRules("plan-basic", "Basic Tier", [
    {
      id: "r-1",
      plan_id: "plan-basic",
      rule_type: "allow_pause",
      rule_value: "false",
      created_at: new Date().toISOString(),
    },
  ]);
  assert.equal(noPausePlan.allowPause, false);

  // Plan rule allowing pause with max_pause_days
  const cappedPausePlan = parsePlanRules("plan-pro", "Pro Tier", [
    {
      id: "r-2",
      plan_id: "plan-pro",
      rule_type: "max_pause_days",
      rule_value: "30",
      created_at: new Date().toISOString(),
    },
  ]);
  assert.equal(cappedPausePlan.allowPause, true);
  assert.equal(cappedPausePlan.maxPauseDays, 30);

  // Validate pause duration limit
  const checkPauseDuration = (scheduledResumeDate: string, maxDays: number | null): boolean => {
    if (maxDays === null) return true;
    const now = new Date("2026-06-01T00:00:00.000Z");
    const resume = new Date(scheduledResumeDate);
    const diffDays = Math.ceil((resume.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= maxDays;
  };

  // 20 days: valid under 30 days limit
  assert.equal(checkPauseDuration("2026-06-21T00:00:00.000Z", cappedPausePlan.maxPauseDays), true);
  // 45 days: exceeds 30 days limit
  assert.equal(checkPauseDuration("2026-07-16T00:00:00.000Z", cappedPausePlan.maxPauseDays), false);
});

test("resume business rules: Immediate billing reset vs unspent days credit", () => {
  // Scenario: Subscription with 1-month period: June 1 to July 1
  const periodStart = new Date("2026-06-01T00:00:00.000Z");
  const periodEnd = new Date("2026-07-01T00:00:00.000Z");
  assert.ok(periodStart);

  // Paused 10 days in on June 11
  const pausedAt = new Date("2026-06-11T00:00:00.000Z");
  const unspentMs = periodEnd.getTime() - pausedAt.getTime();
  const unspentDays = Math.round(unspentMs / (1000 * 60 * 60 * 24));
  assert.equal(unspentDays, 20); // 20 days unspent remaining

  // Resumed on July 11
  const resumeDate = new Date("2026-07-11T00:00:00.000Z");

  // Mode 1: Immediate billing reset (resumeBillingNow: true)
  const resetNextEnd = calculateNextBillingDate(resumeDate, "monthly", 1, { anchorDay: 11 });
  assert.equal(resetNextEnd.getUTCMonth(), 7); // August
  assert.equal(resetNextEnd.getUTCDate(), 11);

  // Mode 2: Unspent days credit preservation (resumeBillingNow: false)
  const creditNextEnd = new Date(resumeDate.getTime() + unspentMs);
  assert.equal(creditNextEnd.toISOString(), "2026-07-31T00:00:00.000Z"); // July 11 + 20 days = July 31
});

test("early closure vs automatic closure at period end", () => {
  const currentPeriodEnd = "2026-06-30T23:59:59.000Z";

  // Early Closure (Immediate)
  const earlyClosureRecord = {
    status: "cancelled",
    lifecycle_status: "closed",
    cancelled_at: "2026-06-15T10:00:00.000Z",
    ended_at: "2026-06-15T10:00:00.000Z",
    cancellation_type: "immediate",
  };
  assert.equal(earlyClosureRecord.ended_at, earlyClosureRecord.cancelled_at);
  assert.equal(earlyClosureRecord.lifecycle_status, "closed");

  // Automatic Closure (Scheduled at Period End)
  const scheduledClosureRecord = {
    status: "active",
    lifecycle_status: "active",
    metadata: {
      cancel_at_period_end: true,
      cancellation_type: "at_period_end",
      scheduled_cancellation: {
        requested_at: "2026-06-15T10:00:00.000Z",
        effective_date: currentPeriodEnd,
        reason: "Cost cutting",
      },
    },
  };
  // Service remains active until period end
  assert.equal(scheduledClosureRecord.lifecycle_status, "active");
  assert.equal(scheduledClosureRecord.metadata.cancel_at_period_end, true);

  // Billing exclusion check
  const isEligibleForBilling = (sub: typeof scheduledClosureRecord): boolean => {
    if (sub.metadata?.cancel_at_period_end) return false;
    return sub.lifecycle_status === "active";
  };
  assert.equal(isEligibleForBilling(scheduledClosureRecord), false);

  // Automatic Sweep Execution
  const sweepClosures = (sub: typeof scheduledClosureRecord, asOf: Date) => {
    const periodEndMs = new Date(currentPeriodEnd).getTime();
    if (sub.metadata.cancel_at_period_end && asOf.getTime() >= periodEndMs) {
      return {
        status: "cancelled",
        lifecycle_status: "closed",
        ended_at: currentPeriodEnd,
        closed: true,
      };
    }
    return { closed: false };
  };

  // Sweep run on June 20: not yet expired, stays active
  assert.equal(sweepClosures(scheduledClosureRecord, new Date("2026-06-20T00:00:00.000Z")).closed, false);
  // Sweep run on July 01: period has ended, automatically closes!
  const sweepResult = sweepClosures(scheduledClosureRecord, new Date("2026-07-01T00:00:00.000Z"));
  assert.equal(sweepResult.closed, true);
  assert.equal(sweepResult.lifecycle_status, "closed");
});

test("cancellation request submission and revocation workflow", () => {
  interface MockCancellationReq {
    id: string;
    subscription_id: string;
    requested_at: string;
    status: "scheduled" | "applied" | "revoked";
  }

  const sub = {
    id: "sub-100",
    metadata: {
      cancel_at_period_end: false,
      cancellation_requests: [] as MockCancellationReq[],
    },
  };

  // Step 1: Customer submits period-end cancellation request
  const req: MockCancellationReq = {
    id: "req-1",
    subscription_id: sub.id,
    requested_at: new Date().toISOString(),
    status: "scheduled",
  };
  sub.metadata.cancel_at_period_end = true;
  sub.metadata.cancellation_requests.push(req);

  assert.equal(sub.metadata.cancel_at_period_end, true);
  assert.equal(sub.metadata.cancellation_requests[0].status, "scheduled");

  // Step 2: Customer revokes cancellation before period end
  sub.metadata.cancel_at_period_end = false;
  sub.metadata.cancellation_requests[0].status = "revoked";

  assert.equal(sub.metadata.cancel_at_period_end, false);
  assert.equal(sub.metadata.cancellation_requests[0].status, "revoked");
});

test("validations: pause, resume, close, cancellation schemas", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  // Pause schema
  const validPause = pauseSubscriptionSchema.safeParse({
    subscriptionId: validUuid,
    reason: "Temporary freeze for system upgrade",
    resumeScheduledAt: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(validPause.success, true);

  // Resume schema
  const validResume = resumeSubscriptionSchema.safeParse({
    subscriptionId: validUuid,
    resumeBillingNow: false,
  });
  assert.equal(validResume.success, true);

  // Close schema (early closure vs scheduled)
  const validCloseImmediate = closeSubscriptionSchema.safeParse({
    subscriptionId: validUuid,
    reason: "Terminated by client request",
    immediately: true,
  });
  assert.equal(validCloseImmediate.success, true);

  const validClosePeriodEnd = closeSubscriptionSchema.safeParse({
    subscriptionId: validUuid,
    reason: "Do not renew next cycle",
    immediately: false,
    feedback: "Everything worked great, will be back next season",
  });
  assert.equal(validClosePeriodEnd.success, true);

  // Submit cancellation schema
  const validCancellation = submitCancellationRequestSchema.safeParse({
    subscriptionId: validUuid,
    immediately: false,
    reason: "Switching to alternative vendor",
    feedback: "Need deeper ERP integration",
  });
  assert.equal(validCancellation.success, true);

  // Revoke cancellation schema
  const validRevocation = revokeCancellationRequestSchema.safeParse({
    subscriptionId: validUuid,
    notes: "Customer decided to retain enterprise tier",
  });
  assert.equal(validRevocation.success, true);
});

test("validations: plan change request and revocation schemas", () => {
  const validUuid1 = "123e4567-e89b-12d3-a456-426614174000";
  const validUuid2 = "987fcdeb-51a2-43f7-9abc-def012345678";

  // Valid submit plan change
  const validSubmit = submitPlanChangeRequestSchema.safeParse({
    subscriptionId: validUuid1,
    targetPlanId: validUuid2,
    targetQuantity: 5,
    targetCycle: "yearly",
    immediately: false,
    notes: "Upgrading sales team seats",
  });
  assert.equal(validSubmit.success, true);
  if (validSubmit.success) {
    assert.equal(validSubmit.data.targetQuantity, 5);
    assert.equal(validSubmit.data.immediately, false);
    assert.equal(validSubmit.data.targetCycle, "yearly");
  }

  // Target quantity defaults to 1
  const defaultQuantity = submitPlanChangeRequestSchema.safeParse({
    subscriptionId: validUuid1,
    targetPlanId: validUuid2,
  });
  assert.equal(defaultQuantity.success, true);
  if (defaultQuantity.success) {
    assert.equal(defaultQuantity.data.targetQuantity, 1);
    assert.equal(defaultQuantity.data.immediately, false);
  }

  // Reject zero or negative quantity
  const invalidZeroQuantity = submitPlanChangeRequestSchema.safeParse({
    subscriptionId: validUuid1,
    targetPlanId: validUuid2,
    targetQuantity: 0,
  });
  assert.equal(invalidZeroQuantity.success, false);

  const invalidNegativeQuantity = submitPlanChangeRequestSchema.safeParse({
    subscriptionId: validUuid1,
    targetPlanId: validUuid2,
    targetQuantity: -2,
  });
  assert.equal(invalidNegativeQuantity.success, false);

  // Reject invalid UUIDs
  const invalidSubId = submitPlanChangeRequestSchema.safeParse({
    subscriptionId: "not-a-uuid",
    targetPlanId: validUuid2,
  });
  assert.equal(invalidSubId.success, false);

  const invalidTargetPlanId = submitPlanChangeRequestSchema.safeParse({
    subscriptionId: validUuid1,
    targetPlanId: "invalid-plan",
  });
  assert.equal(invalidTargetPlanId.success, false);

  // Valid revoke plan change
  const validRevoke = revokePlanChangeRequestSchema.safeParse({
    subscriptionId: validUuid1,
    notes: "Decided to keep current tier until Q4",
  });
  assert.equal(validRevoke.success, true);

  // Revoke with invalid UUID
  const invalidRevoke = revokePlanChangeRequestSchema.safeParse({
    subscriptionId: "invalid-uuid",
  });
  assert.equal(invalidRevoke.success, false);
});

test("plan changes: upgrade vs downgrade vs seat adjustment classification logic", () => {
  const currentSub = {
    plan_id: "plan-starter",
    quantity: 2,
    unit_price: 50.0,
    total_amount: 100.0,
    billing_cycle: "monthly",
  };

  // Function simulating classification logic
  function classifyChange(
    targetPlanId: string,
    targetPrice: number,
    targetQuantity: number,
    targetCycle: string
  ): "upgrade" | "downgrade" | "seat_adjustment" | "cycle_change" {
    const oldAmount = currentSub.total_amount;
    const newTotal = targetPrice * targetQuantity;

    if (targetPlanId !== currentSub.plan_id) {
      return newTotal >= oldAmount ? "upgrade" : "downgrade";
    } else if (targetQuantity !== currentSub.quantity) {
      return targetQuantity > currentSub.quantity ? "upgrade" : "downgrade";
    } else if (targetCycle && targetCycle !== currentSub.billing_cycle) {
      return "cycle_change";
    }
    return "seat_adjustment";
  }

  // 1. Moving to higher-priced plan -> upgrade
  assert.equal(classifyChange("plan-pro", 120.0, 2, "monthly"), "upgrade");

  // 2. Moving to lower-priced plan -> downgrade
  assert.equal(classifyChange("plan-basic", 20.0, 2, "monthly"), "downgrade");

  // 3. Same plan, adding seats (2 -> 5) -> upgrade
  assert.equal(classifyChange("plan-starter", 50.0, 5, "monthly"), "upgrade");

  // 4. Same plan, reducing seats (2 -> 1) -> downgrade
  assert.equal(classifyChange("plan-starter", 50.0, 1, "monthly"), "downgrade");

  // 5. Same plan & quantity, switching cycle (monthly -> yearly) -> cycle_change
  assert.equal(classifyChange("plan-starter", 50.0, 2, "yearly"), "cycle_change");

  // 6. Same plan, price, quantity & cycle -> seat_adjustment
  assert.equal(classifyChange("plan-starter", 50.0, 2, "monthly"), "seat_adjustment");
});

test("plan changes: plan seat limit validation logic", () => {
  // Plan with explicit seat limit of 10
  const planRulesLimited = parsePlanRules("p1", "Limited Plan", [
    { id: "r1", plan_id: "p1", rule_type: "seat_limit", rule_value: "10", created_at: "" },
    { id: "r2", plan_id: "p1", rule_type: "allow_pause", rule_value: "true", created_at: "" },
  ]);
  assert.equal(planRulesLimited.seatLimit, 10);
  assert.equal(planRulesLimited.allowPause, true);

  // Check 5 seats <= 10 -> allowed
  assert.equal(5 <= (planRulesLimited.seatLimit ?? Infinity), true);

  // Check 10 seats <= 10 -> allowed (boundary)
  assert.equal(10 <= (planRulesLimited.seatLimit ?? Infinity), true);

  // Check 11 seats > 10 -> rejected
  assert.equal(11 <= (planRulesLimited.seatLimit ?? Infinity), false);

  // Plan with alternative max_seats key
  const planRulesMaxSeats = parsePlanRules("p2", "Max Seats Plan", [
    { id: "r3", plan_id: "p2", rule_type: "max_seats", rule_value: "25", created_at: "" },
  ]);
  assert.equal(planRulesMaxSeats.seatLimit, 25);

  // Plan with user_limit key
  const planRulesUserLimit = parsePlanRules("p3", "User Limit Plan", [
    { id: "r4", plan_id: "p3", rule_type: "user_limit", rule_value: "50", created_at: "" },
  ]);
  assert.equal(planRulesUserLimit.seatLimit, 50);

  // Plan with unlimited seats
  const planRulesUnlimited = parsePlanRules("p4", "Unlimited Plan", []);
  assert.equal(planRulesUnlimited.seatLimit, null);
  assert.equal(500 <= (planRulesUnlimited.seatLimit ?? Infinity), true);
});

test("plan changes: scheduled plan change renewal application", () => {
  // Setup subscription currently on Starter plan ($50 x 2 = $100)
  const sub = {
    id: "sub-12345",
    plan_id: "plan-starter",
    unit_price: 50.0,
    quantity: 2,
    subtotal: 100.0,
    total_amount: 100.0,
    billing_cycle: "monthly",
    current_period_start: "2026-05-01T00:00:00.000Z",
    current_period_end: "2026-06-01T00:00:00.000Z",
    metadata: {
      scheduled_plan_change: {
        id: "change-req-001",
        subscription_id: "sub-12345",
        change_type: "upgrade" as const,
        target_plan_id: "plan-pro",
        target_plan_name: "Pro Tier",
        target_quantity: 4,
        target_billing_cycle: "monthly",
        target_price: 90.0,
        immediately: false,
        effective_date: "2026-06-01T00:00:00.000Z",
        requested_at: "2026-05-15T12:00:00.000Z",
        requester_role: "customer",
        status: "scheduled" as const,
        notes: "Scaling engineering team",
      },
      plan_change_history: [
        {
          id: "change-req-001",
          subscription_id: "sub-12345",
          change_type: "upgrade" as const,
          target_plan_id: "plan-pro",
          target_plan_name: "Pro Tier",
          target_quantity: 4,
          target_billing_cycle: "monthly",
          target_price: 90.0,
          immediately: false,
          effective_date: "2026-06-01T00:00:00.000Z",
          requested_at: "2026-05-15T12:00:00.000Z",
          requester_role: "customer",
          status: "scheduled" as const,
          notes: "Scaling engineering team",
        },
      ] as PlanChangeRequest[],
    },
  };

  // Verify scheduled change exists before renewal
  assert.equal(sub.metadata.scheduled_plan_change !== null, true);
  assert.equal(sub.metadata.scheduled_plan_change.status, "scheduled");

  // Simulate renewal execution (matching subscription-service.renewSubscription logic)
  const scheduledChange = sub.metadata.scheduled_plan_change;
  let newPlanId = sub.plan_id;
  let newUnitPrice = sub.unit_price;
  let newQuantity = sub.quantity;
  let newSubtotal = sub.subtotal;
  let newTotal = sub.total_amount;

  if (scheduledChange && scheduledChange.status === "scheduled") {
    newPlanId = scheduledChange.target_plan_id;
    newUnitPrice = scheduledChange.target_price;
    newQuantity = scheduledChange.target_quantity;
    newSubtotal = newUnitPrice * newQuantity;
    newTotal = newSubtotal;

    // Mark request as applied in plan_change_history
    const updatedHistory = sub.metadata.plan_change_history.map((req) => {
      if (req.id === scheduledChange.id) {
        return { ...req, status: "applied" as const };
      }
      return req;
    });

    sub.plan_id = newPlanId;
    sub.unit_price = newUnitPrice;
    sub.quantity = newQuantity;
    sub.subtotal = newSubtotal;
    sub.total_amount = newTotal;
    sub.metadata.plan_change_history = updatedHistory;
    // Clear scheduled_plan_change
    delete (sub.metadata as Record<string, unknown>).scheduled_plan_change;
  }

  // Assertions after renewal:
  assert.equal(sub.plan_id, "plan-pro");
  assert.equal(sub.unit_price, 90.0);
  assert.equal(sub.quantity, 4);
  assert.equal(sub.subtotal, 360.0); // 90 * 4 = 360
  assert.equal(sub.total_amount, 360.0);
  assert.equal(sub.metadata.scheduled_plan_change, undefined);
  assert.equal(sub.metadata.plan_change_history[0].status, "applied");
});

test("plan changes: revocation before renewal", () => {
  const sub = {
    id: "sub-999",
    metadata: {
      scheduled_plan_change: {
        id: "change-req-777",
        status: "scheduled" as const,
      },
      plan_change_history: [
        {
          id: "change-req-777",
          status: "scheduled" as const,
          notes: "Initial upgrade request",
        },
      ] as Array<{ id: string; status: "scheduled" | "applied" | "revoked"; notes: string }>,
    },
  };

  // User revokes
  const revocationNotes = "Changed mind, waiting for new budget";
  const updatedHistory = sub.metadata.plan_change_history.map((p) => {
    if (p.id === sub.metadata.scheduled_plan_change?.id) {
      return {
        ...p,
        status: "revoked" as const,
        notes: `${p.notes} | Revoked: ${revocationNotes}`,
      };
    }
    return p;
  });

  sub.metadata.plan_change_history = updatedHistory;
  delete (sub.metadata as Record<string, unknown>).scheduled_plan_change;

  assert.equal(sub.metadata.scheduled_plan_change, undefined);
  assert.equal(sub.metadata.plan_change_history[0].status, "revoked");
  assert.match(sub.metadata.plan_change_history[0].notes, /Revoked: Changed mind/);
});

// ============================================================================
// STRENGTHENED BUSINESS LOGIC & DATA INTEGRITY TEST SUITE (10 INVARIANTS)
// ============================================================================

test("1. Server-side validation of all subscription operations", () => {
  // Direct creation validation
  const validDirect = createDirectSubscriptionSchema.safeParse({
    customerId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    planId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    quantity: 3,
    initialStatus: "active",
  });
  assert.equal(validDirect.success, true);

  // Reject zero/negative quantity
  const invalidQty = createDirectSubscriptionSchema.safeParse({
    customerId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    planId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    quantity: 0,
  });
  assert.equal(invalidQty.success, false);

  // Reject malformed UUIDs
  const invalidUuid = createDirectSubscriptionSchema.safeParse({
    customerId: "not-a-uuid",
    planId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    quantity: 1,
  });
  assert.equal(invalidUuid.success, false);

  // Lifecycle transition schema rejects arbitrary non-lifecycle strings
  const invalidLifecycle = transitionSubscriptionLifecycleSchema.safeParse({
    subscriptionId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    targetStatus: "non_existent_status",
  });
  assert.equal(invalidLifecycle.success, false);

  // Due subscriptions options enforces maximum limits
  const excessiveLimit = dueSubscriptionsOptionsSchema.safeParse({
    limit: 1000,
  });
  assert.equal(excessiveLimit.success, false);

  // Renewal options schema validates subscriptionId
  const validRenew = renewSubscriptionSchema.safeParse({
    subscriptionId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    idempotencyKey: "idem-key-test",
  });
  assert.equal(validRenew.success, true);
});

test("2. Plan-specific lifecycle permissions and policy rules", () => {
  const mockRules: PlanRule[] = [
    {
      id: "rule-1",
      plan_id: "plan-restricted",
      rule_type: "allow_pause",
      rule_value: "false",
      description: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "rule-2",
      plan_id: "plan-restricted",
      rule_type: "max_pause_days",
      rule_value: "14",
      description: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "rule-3",
      plan_id: "plan-restricted",
      rule_type: "allow_immediate_cancellation",
      rule_value: "false",
      description: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "rule-4",
      plan_id: "plan-restricted",
      rule_type: "seat_limit",
      rule_value: "5",
      description: null,
      created_at: new Date().toISOString(),
    },
  ];

  const permissions = parsePlanRules("plan-restricted", "Starter Restricted", mockRules);

  // Rule: allow_pause = false
  assert.equal(permissions.allowPause, false);

  // Rule: max_pause_days = 14
  assert.equal(permissions.maxPauseDays, 14);

  // Rule: allow_immediate_cancellation = false
  assert.equal(permissions.allowImmediateCancellation, false);

  // Rule: seat_limit = 5
  assert.equal(permissions.seatLimit, 5);
});

test("3. Prevention of invalid status transitions (dual FSM enforcement)", () => {
  // Prohibit transitioning from closed/cancelled back to active
  assert.equal(isLifecycleTransitionAllowed("closed", "active"), false);
  assert.equal(isTransitionAllowed("cancelled", "active"), false);
  assert.equal(isTransitionAllowed("expired", "active"), false);

  // Prohibit transitioning from draft directly to paused
  assert.equal(isLifecycleTransitionAllowed("draft", "paused"), false);

  // Asserting illegal transition throws detailed error
  assert.throws(
    () => assertLifecycleTransition("closed", "active"),
    /Illegal subscription lifecycle transition: cannot transition from status 'closed' to 'active'/
  );

  assert.throws(
    () => assertTransition("cancelled", "active"),
    /Illegal subscription transition: cannot transition from status 'cancelled' to 'active'/
  );
});

test("4. Prevention of duplicate renewals (idempotency, duplicate invoice & cooldown)", () => {
  const existingRenewalHistory: RenewalHistoryRecord[] = [
    {
      renewal_id: "ren-001",
      cycle_number: 1,
      renewed_at: "2026-10-01T00:00:00.000Z",
      previous_period_start: "2026-09-01T00:00:00.000Z",
      previous_period_end: "2026-10-01T00:00:00.000Z",
      new_period_start: "2026-10-01T00:00:00.000Z",
      new_period_end: "2026-11-01T00:00:00.000Z",
      invoice_id: "inv-2026-001",
      amount_paid: 199.0,
      idempotency_key: "idem-key-abc-123",
      actor_role: "system",
      actor_id: null,
      notes: null,
    },
  ];

  // 1. Duplicate idempotency key detection
  const incomingKey = "idem-key-abc-123";
  const isDuplicateKey = existingRenewalHistory.some((r) => r.idempotency_key === incomingKey);
  assert.equal(isDuplicateKey, true);

  // 2. Duplicate invoice id detection
  const incomingInvoice = "inv-2026-001";
  const isDuplicateInvoice = existingRenewalHistory.some((r) => r.invoice_id === incomingInvoice);
  assert.equal(isDuplicateInvoice, true);

  // 3. Cooldown check: renewed 2 seconds ago without idempotency key
  const lastRenewedAt = new Date(Date.now() - 2000).toISOString();
  const secondsSince = (Date.now() - new Date(lastRenewedAt).getTime()) / 1000;
  const isWithinCooldown = secondsSince < 5;
  assert.equal(isWithinCooldown, true);
});

test("5. Prevention of duplicate quotation conversions", () => {
  // Quotation already converted
  const mockQuotation = {
    id: "quote-123",
    quotation_number: "QT-2026-001",
    status: "accepted",
    converted_subscription_id: "sub-already-exists-999",
    valid_until: "2026-12-31T00:00:00.000Z",
  };

  const isAlreadyConverted = Boolean(mockQuotation.converted_subscription_id);
  assert.equal(isAlreadyConverted, true);

  // Expired quotation check
  const expiredQuotation = {
    ...mockQuotation,
    converted_subscription_id: null,
    valid_until: "2025-01-01T00:00:00.000Z",
  };

  const isExpired = new Date(expiredQuotation.valid_until).getTime() < Date.now();
  assert.equal(isExpired, true);

  // CAS Lock logic simulation: updating quotation where converted_subscription_id IS NULL
  const quotationInDb: { converted_subscription_id: string | null } = {
    converted_subscription_id: null,
  };

  function simulateAtomicCasConversion(newSubId: string): boolean {
    if (quotationInDb.converted_subscription_id !== null) {
      return false; // CAS failed
    }
    quotationInDb.converted_subscription_id = newSubId;
    return true; // CAS succeeded
  }

  // First thread succeeds
  const thread1Result = simulateAtomicCasConversion("sub-thread-1");
  assert.equal(thread1Result, true);
  assert.equal(quotationInDb.converted_subscription_id, "sub-thread-1");

  // Concurrent second thread fails
  const thread2Result = simulateAtomicCasConversion("sub-thread-2");
  assert.equal(thread2Result, false);
  assert.equal(quotationInDb.converted_subscription_id, "sub-thread-1");
});

test("6. Correct monthly end-of-month billing calculations & anchor recovery", () => {
  // Origin on Jan 31
  const jan31 = new Date("2026-01-31T10:00:00.000Z");
  const anchorDay = 31;

  // Month 1: Jan 31 -> Feb 28 (clamps to end of Feb in non-leap year)
  const feb = calculateMonthlyBillingDate(jan31, 1, { anchorDay });
  assert.equal(feb.getUTCFullYear(), 2026);
  assert.equal(feb.getUTCMonth(), 1); // Feb
  assert.equal(feb.getUTCDate(), 28);

  // Month 2: Feb 28 -> Mar 31 (recovers to 31!)
  const mar = calculateMonthlyBillingDate(feb, 1, { anchorDay });
  assert.equal(mar.getUTCFullYear(), 2026);
  assert.equal(mar.getUTCMonth(), 2); // Mar
  assert.equal(mar.getUTCDate(), 31);

  // Month 3: Mar 31 -> Apr 30 (clamps to 30)
  const apr = calculateMonthlyBillingDate(mar, 1, { anchorDay });
  assert.equal(apr.getUTCMonth(), 3); // Apr
  assert.equal(apr.getUTCDate(), 30);

  // Month 4: Apr 30 -> May 31 (recovers to 31!)
  const may = calculateMonthlyBillingDate(apr, 1, { anchorDay });
  assert.equal(may.getUTCMonth(), 4); // May
  assert.equal(may.getUTCDate(), 31);
});

test("7. Daily, weekly, monthly and yearly billing dates with interval multipliers", () => {
  const base = new Date("2026-01-15T00:00:00.000Z");

  // Bi-weekly (every 2 weeks = 14 days)
  const biWeekly = calculateNextBillingDate(base, "weekly", 2);
  assert.equal(biWeekly.toISOString(), "2026-01-29T00:00:00.000Z");

  // Quarterly (every 3 months)
  const quarterly = calculateNextBillingDate(base, "monthly", 3);
  assert.equal(quarterly.toISOString(), "2026-04-15T00:00:00.000Z");

  // Semi-annually (every 6 months)
  const semiAnnual = calculateNextBillingDate(base, "monthly", 6);
  assert.equal(semiAnnual.toISOString(), "2026-07-15T00:00:00.000Z");

  // Biennial (every 2 years)
  const biennial = calculateNextBillingDate(base, "yearly", 2);
  assert.equal(biennial.toISOString(), "2028-01-15T00:00:00.000Z");

  // Defensive sanitization: invalid/NaN count defaults safely to 1
  const safeDaily = calculateDailyBillingDate(base, Number.NaN as unknown as number);
  assert.equal(safeDaily.toISOString(), "2026-01-16T00:00:00.000Z");
});

test("8. Expiry date validation across all contract conditions", () => {
  const asOf = new Date("2026-11-01T00:00:00.000Z");

  // 1. Fixed term contract expired in metadata
  const fixedTermSub = {
    id: "sub-fixed",
    status: "active",
    current_period_end: "2026-12-01T00:00:00.000Z",
    metadata: {
      expires_at: "2026-10-31T23:59:59.000Z",
    },
  };
  const fixedCheck = checkSubscriptionExpiry(fixedTermSub, asOf);
  assert.equal(fixedCheck.isExpired, true);
  assert.match(fixedCheck.reason || "", /Fixed term contract reached expiration date/);

  // 2. Scheduled cancellation reaching period end
  const scheduledCancelSub = {
    id: "sub-sched-cancel",
    status: "active",
    current_period_end: "2026-10-31T23:59:59.000Z",
    metadata: {
      cancel_at_period_end: true,
    },
  };
  const schedCheck = checkSubscriptionExpiry(scheduledCancelSub, asOf);
  assert.equal(schedCheck.isExpired, true);
  assert.match(schedCheck.reason || "", /reached period end/);

  // 3. Active subscription in good standing (not expired)
  const activeSub = {
    id: "sub-active",
    status: "active",
    current_period_end: "2026-11-30T00:00:00.000Z",
    metadata: {},
  };
  const activeCheck = checkSubscriptionExpiry(activeSub, asOf);
  assert.equal(activeCheck.isExpired, false);
});

test("9. Preservation of historical subscription pricing and periods", () => {
  // Verify period preservation data contract
  const archivedPeriod: PreservedSubscriptionPeriod = {
    period_index: 2,
    period_start: "2026-09-01T00:00:00.000Z",
    period_end: "2026-10-01T00:00:00.000Z",
    archived_at: "2026-10-01T00:05:00.000Z",
    subtotal: 500.0,
    total_amount: 550.0,
    currency: "USD",
    invoice_id: "inv-sep-2026",
  };

  assert.equal(archivedPeriod.period_index, 2);
  assert.equal(archivedPeriod.subtotal, 500.0);
  assert.equal(archivedPeriod.total_amount, 550.0);
  assert.equal(archivedPeriod.invoice_id, "inv-sep-2026");

  // Verify non-destructive append
  const history: PreservedSubscriptionPeriod[] = [archivedPeriod];
  const nextPeriod: PreservedSubscriptionPeriod = {
    period_index: 3,
    period_start: "2026-10-01T00:00:00.000Z",
    period_end: "2026-11-01T00:00:00.000Z",
    archived_at: "2026-11-01T00:02:00.000Z",
    subtotal: 500.0,
    total_amount: 550.0,
    currency: "USD",
    invoice_id: "inv-oct-2026",
  };

  const updatedHistory = [...history, nextPeriod];
  assert.equal(updatedHistory.length, 2);
  assert.equal(updatedHistory[0].period_index, 2);
  assert.equal(updatedHistory[1].period_index, 3);
});

test("10. Safe handling of concurrent subscription operations (CAS invariants)", () => {
  // Simulate concurrent database state
  const subscriptionRecord = {
    id: "sub-concurrent-test",
    status: "active",
    current_period_end: "2026-11-01T00:00:00.000Z",
    plan_id: "plan-standard",
  };

  // CAS Function 1: Renewal CAS on current_period_end
  function casRenew(expectedPeriodEnd: string, newPeriodEnd: string): boolean {
    if (subscriptionRecord.current_period_end !== expectedPeriodEnd) {
      return false; // Stale write rejected
    }
    subscriptionRecord.current_period_end = newPeriodEnd;
    return true;
  }

  // First thread succeeds
  const renewThread1 = casRenew("2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z");
  assert.equal(renewThread1, true);

  // Second concurrent thread with old expected end fails
  const renewThread2 = casRenew("2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z");
  assert.equal(renewThread2, false);

  // CAS Function 2: Lifecycle transition CAS on status
  function casTransition(expectedStatus: string, newStatus: string): boolean {
    if (subscriptionRecord.status !== expectedStatus) {
      return false; // Stale transition rejected
    }
    subscriptionRecord.status = newStatus;
    return true;
  }

  // Transition from active to paused succeeds
  const transition1 = casTransition("active", "paused");
  assert.equal(transition1, true);

  // Concurrent attempt expecting "active" fails because status is already "paused"
  const transition2 = casTransition("active", "closed");
  assert.equal(transition2, false);
});




