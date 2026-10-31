import { createClient } from "@/lib/supabase/server";
import { PlanPermissions, PlanRule, SubscriptionLifecycleStatus } from "./types";

/**
 * Parses and maps raw plan_rules database entries into typed PlanPermissions.
 */
export function parsePlanRules(
  planId: string,
  planName: string | undefined,
  rules: PlanRule[]
): PlanPermissions {
  let seatLimit: number | null = null;
  let allowPause = true;
  let maxPauseDays: number | null = null;
  let allowImmediateCancellation = true;
  let minCommitmentDays: number | null = null;
  let requiresApproval = false;
  const customRules: Record<string, string> = {};

  for (const rule of rules) {
    const type = rule.rule_type.toLowerCase().trim();
    const val = rule.rule_value.trim();

    if (type === "seat_limit" || type === "max_seats" || type === "user_limit") {
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        seatLimit = parsed;
      }
    } else if (type === "allow_pause" || type === "can_pause") {
      if (val.toLowerCase() === "false" || val === "0" || val.toLowerCase() === "disabled") {
        allowPause = false;
      }
    } else if (type === "max_pause_days") {
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        maxPauseDays = parsed;
      }
    } else if (
      type === "allow_immediate_cancellation" ||
      type === "allow_early_cancellation" ||
      type === "can_cancel_early"
    ) {
      if (val.toLowerCase() === "false" || val === "0" || val.toLowerCase() === "disabled") {
        allowImmediateCancellation = false;
      }
    } else if (type === "min_commitment_days" || type === "min_term_days") {
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        minCommitmentDays = parsed;
      }
    } else if (type === "requires_approval") {
      if (val.toLowerCase() === "true" || val === "1") {
        requiresApproval = true;
      }
    } else {
      customRules[type] = val;
    }
  }

  return {
    planId,
    planName,
    seatLimit,
    allowPause,
    maxPauseDays,
    allowImmediateCancellation,
    minCommitmentDays,
    requiresApproval,
    rules,
    customRules,
  };
}

/**
 * Loads and parses plan rules from the database table 'plan_rules'.
 */
export async function getPlanPermissions(
  planId: string,
  customClient?: Awaited<ReturnType<typeof createClient>>
): Promise<PlanPermissions> {
  const supabase = customClient || (await createClient());

  // Fetch plan details
  const { data: plan } = await supabase
    .from("plans")
    .select("id, name")
    .eq("id", planId)
    .maybeSingle();

  // Fetch plan rules
  const { data: rulesData, error } = await supabase
    .from("plan_rules")
    .select("*")
    .eq("plan_id", planId);

  if (error || !rulesData) {
    return {
      planId,
      planName: plan?.name,
      seatLimit: null,
      allowPause: true,
      maxPauseDays: null,
      requiresApproval: false,
      rules: [],
      customRules: {},
    };
  }

  return parsePlanRules(planId, plan?.name, rulesData as PlanRule[]);
}

/**
 * Validates whether a requested subscription seat quantity complies with plan rules.
 */
export async function validatePlanSeatLimit(
  planId: string,
  requestedQuantity: number,
  customClient?: Awaited<ReturnType<typeof createClient>>
): Promise<{ allowed: boolean; seatLimit: number | null; error?: string }> {
  const permissions = await getPlanPermissions(planId, customClient);

  if (permissions.seatLimit !== null && requestedQuantity > permissions.seatLimit) {
    return {
      allowed: false,
      seatLimit: permissions.seatLimit,
      error: `Requested quantity (${requestedQuantity}) exceeds plan '${permissions.planName || planId}' limit of ${permissions.seatLimit} seats.`,
    };
  }

  return {
    allowed: true,
    seatLimit: permissions.seatLimit,
  };
}

/**
 * Validates plan-specific permissions for lifecycle status transitions.
 * e.g. Verifies whether pausing is allowed by plan policy.
 */
export async function validatePlanTransition(params: {
  planId: string;
  currentStatus: SubscriptionLifecycleStatus;
  targetStatus: SubscriptionLifecycleStatus;
  quantity?: number;
  resumeScheduledAt?: string;
  customClient?: Awaited<ReturnType<typeof createClient>>;
}): Promise<{ allowed: boolean; error?: string }> {
  const { planId, targetStatus, quantity, resumeScheduledAt, customClient } = params;
  const permissions = await getPlanPermissions(planId, customClient);

  // Check 1: Pausing permission
  if (targetStatus === "paused") {
    if (!permissions.allowPause) {
      return {
        allowed: false,
        error: `Subscriptions on plan '${permissions.planName || planId}' cannot be paused according to plan policy.`,
      };
    }

    if (resumeScheduledAt && permissions.maxPauseDays !== null) {
      const now = new Date();
      const scheduled = new Date(resumeScheduledAt);
      const diffMs = scheduled.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > permissions.maxPauseDays) {
        return {
          allowed: false,
          error: `Requested pause duration (${diffDays} days) exceeds maximum allowed pause limit of ${permissions.maxPauseDays} days for plan '${permissions.planName || planId}'.`,
        };
      }
    }
  }

  // Check 2: Seat limit compliance on activation / confirmation
  if (
    (targetStatus === "confirmed" || targetStatus === "active") &&
    typeof quantity === "number" &&
    permissions.seatLimit !== null
  ) {
    if (quantity > permissions.seatLimit) {
      return {
        allowed: false,
        error: `Cannot transition subscription: quantity (${quantity}) exceeds plan '${permissions.planName || planId}' seat limit (${permissions.seatLimit}).`,
      };
    }
  }

  // Check 3: Immediate closure permission
  if (targetStatus === "closed") {
    if (permissions.allowImmediateCancellation === false) {
      return {
        allowed: false,
        error: `Subscriptions on plan '${permissions.planName || planId}' do not permit immediate early closure by plan policy. Please request cancellation at the end of the current billing period.`,
      };
    }
  }

  return { allowed: true };
}

