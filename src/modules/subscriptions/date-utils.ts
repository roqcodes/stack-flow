import type { BillingCycle } from "../products/types";

/**
 * Options for fine-grained next billing date calculation
 */
export interface NextBillingDateOptions {
  /**
   * The original day-of-month anchor (1-31) when the subscription was initially created.
   * e.g. If a customer subscribed on Jan 31st, anchorDay=31 ensures that after Feb 28th,
   * the March billing date recovers back to March 31st instead of drifting to March 28th.
   */
  anchorDay?: number;
  /**
   * Whether to explicitly snap the result to the last calendar day of the target month.
   */
  snapToEndOfMonth?: boolean;
}

/**
 * Structured result of calculating subscription periods
 */
export interface BillingPeriodResult {
  periodStart: Date;
  periodEnd: Date;
  nextBillingDate: Date;
  anchorDay: number;
}

/**
 * Diagnostic result of checking subscription expiry
 */
export interface SubscriptionExpiryCheckResult {
  isExpired: boolean;
  isTrialExpired: boolean;
  reason?: string;
  expiryDate?: Date;
}

/**
 * Determines whether a year is a leap year (Gregorian calendar rules)
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the exact number of calendar days in a given month (0-indexed month: 0=Jan, 11=Dec)
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Checks whether a given date is the final calendar day of its month (in UTC)
 */
export function isEndOfMonth(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getUTCDate();
  const maxDays = getDaysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  return day === maxDays;
}

/**
 * Returns a new Date set to the final calendar day of the given month, preserving time
 */
export function getEndOfMonth(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date provided to getEndOfMonth: ${date}`);
  }
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const lastDay = getDaysInMonth(year, month);

  return new Date(
    Date.UTC(
      year,
      month,
      lastDay,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    )
  );
}

/**
 * 1. Daily Next Billing Date Calculation
 * Adds intervalCount days (UTC) to anchor date.
 */
export function calculateDailyBillingDate(
  fromDate: Date | string,
  intervalCount: number = 1
): Date {
  const count = Math.max(1, Math.floor(intervalCount));
  const base = typeof fromDate === "string" ? new Date(fromDate) : new Date(fromDate.getTime());

  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid fromDate provided to calculateDailyBillingDate: ${fromDate}`);
  }

  const result = new Date(base.getTime());
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

/**
 * 2. Weekly Next Billing Date Calculation
 * Adds intervalCount * 7 days (UTC) to anchor date.
 */
export function calculateWeeklyBillingDate(
  fromDate: Date | string,
  intervalCount: number = 1
): Date {
  const count = Math.max(1, Math.floor(intervalCount));
  const base = typeof fromDate === "string" ? new Date(fromDate) : new Date(fromDate.getTime());

  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid fromDate provided to calculateWeeklyBillingDate: ${fromDate}`);
  }

  const result = new Date(base.getTime());
  result.setUTCDate(result.getUTCDate() + count * 7);
  return result;
}

/**
 * 3. Monthly Next Billing Date Calculation with End-of-Month & Anchor Day Clamping
 *
 * Implements standard recurring billing engine calendar arithmetic:
 * - Prevents month-skipping bugs (e.g. JavaScript native Jan 31 + 1 month -> March 3).
 * - Restores anchor day if the origin subscription day was 31 (Jan 31 -> Feb 28 -> March 31).
 * - Snaps to end of month if snapToEndOfMonth is true or if origin was month-end.
 */
export function calculateMonthlyBillingDate(
  fromDate: Date | string,
  intervalCount: number = 1,
  options?: NextBillingDateOptions
): Date {
  const count = Math.max(1, Math.floor(intervalCount));
  const base = typeof fromDate === "string" ? new Date(fromDate) : new Date(fromDate.getTime());

  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid fromDate provided to calculateMonthlyBillingDate: ${fromDate}`);
  }

  const currentYear = base.getUTCFullYear();
  const currentMonth = base.getUTCMonth();
  const baseDay = base.getUTCDate();

  // Determine anchor day: use explicitly passed anchorDay, or base day
  const effectiveAnchorDay =
    typeof options?.anchorDay === "number" && options.anchorDay >= 1 && options.anchorDay <= 31
      ? Math.floor(options.anchorDay)
      : baseDay;

  const totalMonths = currentMonth + count;
  const targetYear = currentYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  const maxDaysInTargetMonth = getDaysInMonth(targetYear, targetMonth);

  let targetDay: number;
  if (options?.snapToEndOfMonth) {
    targetDay = maxDaysInTargetMonth;
  } else {
    // Clamp to max available days in target month (e.g. day 31 becomes 28 in Feb, 30 in Apr)
    targetDay = Math.min(effectiveAnchorDay, maxDaysInTargetMonth);
  }

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds()
    )
  );
}

/**
 * 4. Yearly Next Billing Date Calculation
 *
 * Adds intervalCount years, safely handling February 29 leap day clamping:
 * - 2024-02-29 + 1 year -> 2025-02-28
 * - 2024-02-29 + 4 years -> 2028-02-29 (recovers leap day)
 */
export function calculateYearlyBillingDate(
  fromDate: Date | string,
  intervalCount: number = 1,
  options?: NextBillingDateOptions
): Date {
  const count = Math.max(1, Math.floor(intervalCount));
  const base = typeof fromDate === "string" ? new Date(fromDate) : new Date(fromDate.getTime());

  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid fromDate provided to calculateYearlyBillingDate: ${fromDate}`);
  }

  const targetYear = base.getUTCFullYear() + count;
  const targetMonth = base.getUTCMonth();
  const baseDay = base.getUTCDate();

  const effectiveAnchorDay =
    typeof options?.anchorDay === "number" && options.anchorDay >= 1 && options.anchorDay <= 31
      ? Math.floor(options.anchorDay)
      : baseDay;

  const maxDaysInTargetMonth = getDaysInMonth(targetYear, targetMonth);
  const targetDay = options?.snapToEndOfMonth
    ? maxDaysInTargetMonth
    : Math.min(effectiveAnchorDay, maxDaysInTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds()
    )
  );
}

/**
 * Unified deterministic next billing date calculation
 * Supports daily, weekly, monthly, and yearly cycles with end-of-month calendar accuracy.
 */
export function calculateNextBillingDate(
  fromDate: Date | string,
  cycle: BillingCycle,
  intervalCount: number = 1,
  options?: NextBillingDateOptions
): Date {
  switch (cycle) {
    case "daily":
      return calculateDailyBillingDate(fromDate, intervalCount);
    case "weekly":
      return calculateWeeklyBillingDate(fromDate, intervalCount);
    case "monthly":
      return calculateMonthlyBillingDate(fromDate, intervalCount, options);
    case "yearly":
      return calculateYearlyBillingDate(fromDate, intervalCount, options);
    default:
      return calculateMonthlyBillingDate(fromDate, intervalCount, options);
  }
}

/**
 * Calculates a complete billing period (start, end, next billing date, and anchor day)
 */
export function calculateBillingPeriod(
  currentStart: Date | string,
  cycle: BillingCycle,
  intervalCount: number = 1,
  options?: NextBillingDateOptions
): BillingPeriodResult {
  const start = typeof currentStart === "string" ? new Date(currentStart) : new Date(currentStart.getTime());
  const anchorDay = options?.anchorDay ?? start.getUTCDate();
  const nextDate = calculateNextBillingDate(start, cycle, intervalCount, {
    anchorDay,
    snapToEndOfMonth: options?.snapToEndOfMonth,
  });

  return {
    periodStart: start,
    periodEnd: nextDate,
    nextBillingDate: nextDate,
    anchorDay,
  };
}

/**
 * Calculates initial period and trial dates for new subscriptions
 */
export function calculateInitialSubscriptionPeriod(params: {
  startDate?: Date | string;
  cycle: BillingCycle;
  trialPeriodDays?: number;
  intervalCount?: number;
  anchorDay?: number;
}): {
  trialStart: Date | null;
  trialEnd: Date | null;
  periodStart: Date;
  periodEnd: Date;
  nextBillingDate: Date;
  anchorDay: number;
} {
  const { startDate, cycle, trialPeriodDays = 0, intervalCount = 1, anchorDay } = params;
  const start = startDate ? new Date(startDate) : new Date();

  if (trialPeriodDays > 0) {
    const trialStart = start;
    const trialEnd = new Date(start.getTime());
    trialEnd.setUTCDate(trialEnd.getUTCDate() + trialPeriodDays);

    const effAnchor = anchorDay ?? trialEnd.getUTCDate();
    const periodEnd = calculateNextBillingDate(trialEnd, cycle, intervalCount, { anchorDay: effAnchor });

    return {
      trialStart,
      trialEnd,
      periodStart: trialEnd,
      periodEnd,
      nextBillingDate: trialEnd, // First billing occurs upon trial expiration
      anchorDay: effAnchor,
    };
  }

  const effAnchor = anchorDay ?? start.getUTCDate();
  const periodEnd = calculateNextBillingDate(start, cycle, intervalCount, { anchorDay: effAnchor });

  return {
    trialStart: null,
    trialEnd: null,
    periodStart: start,
    periodEnd,
    nextBillingDate: periodEnd,
    anchorDay: effAnchor,
  };
}

/**
 * Checks whether a trial period has expired
 */
export function isTrialExpired(
  trialEnd?: Date | string | null,
  asOf: Date = new Date()
): boolean {
  if (!trialEnd) return false;
  const end = typeof trialEnd === "string" ? new Date(trialEnd) : trialEnd;
  return end.getTime() <= asOf.getTime();
}

/**
 * Checks whether a subscription has reached expiration or ended
 */
export function isSubscriptionExpired(
  subscription: {
    ended_at?: string | null;
    current_period_end?: string | null;
    status?: string;
    metadata?: Record<string, unknown> | null;
  },
  asOf: Date = new Date()
): boolean {
  const now = asOf.getTime();

  // 1. Explicitly recorded ended_at
  if (subscription.ended_at) {
    const ended = new Date(subscription.ended_at).getTime();
    if (ended <= now) return true;
  }

  // 2. Status is already expired
  if (subscription.status === "expired") {
    return true;
  }

  // 3. Metadata fixed term expiration (e.g. 1-year contract end)
  const metaExpiresAt = subscription.metadata?.expires_at as string | undefined;
  if (metaExpiresAt) {
    const exp = new Date(metaExpiresAt).getTime();
    if (exp <= now) return true;
  }

  // 4. Cancelled subscription that has elapsed its final paid period end
  if (subscription.status === "cancelled" && subscription.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end).getTime();
    if (periodEnd <= now) return true;
  }

  return false;
}

/**
 * Comprehensive diagnostic check of subscription expiry and trial standing
 */
export function checkSubscriptionExpiry(
  subscription: {
    id: string;
    status: string;
    trial_end?: string | null;
    current_period_end: string;
    ended_at?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  asOf: Date = new Date()
): SubscriptionExpiryCheckResult {
  const now = asOf.getTime();
  const trialExpired = isTrialExpired(subscription.trial_end, asOf);

  // Check 1: Explicit ended_at
  if (subscription.ended_at) {
    const ended = new Date(subscription.ended_at);
    if (ended.getTime() <= now) {
      return {
        isExpired: true,
        isTrialExpired: trialExpired,
        reason: `Subscription ended on ${ended.toISOString()}`,
        expiryDate: ended,
      };
    }
  }

  // Check 2: Fixed-term expiration in metadata
  const metaExpiresAt = subscription.metadata?.expires_at as string | undefined;
  if (metaExpiresAt) {
    const expDate = new Date(metaExpiresAt);
    if (expDate.getTime() <= now) {
      return {
        isExpired: true,
        isTrialExpired: trialExpired,
        reason: `Fixed term contract reached expiration date (${metaExpiresAt})`,
        expiryDate: expDate,
      };
    }
  }

  // Check 3: Cancelled subscription past period end
  if (subscription.status === "cancelled" && subscription.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end);
    if (periodEnd.getTime() <= now) {
      return {
        isExpired: true,
        isTrialExpired: trialExpired,
        reason: `Cancelled subscription exceeded final billing cycle period (${periodEnd.toISOString()})`,
        expiryDate: periodEnd,
      };
    }
  }

  // Check 4: Status flag
  if (subscription.status === "expired") {
    return {
      isExpired: true,
      isTrialExpired: trialExpired,
      reason: "Subscription status is expired",
      expiryDate: new Date(subscription.current_period_end),
    };
  }

  return {
    isExpired: false,
    isTrialExpired: trialExpired,
  };
}

/**
 * Checks whether a given subscription billing date has arrived or is overdue
 */
export function isBillingDue(nextBillingDate: Date | string, asOf: Date = new Date()): boolean {
  const due = typeof nextBillingDate === "string" ? new Date(nextBillingDate) : nextBillingDate;
  return due.getTime() <= asOf.getTime();
}

/**
 * Formats an ISO string representation of UTC dates
 */
export function toIsoUtc(date: Date): string {
  return date.toISOString();
}
