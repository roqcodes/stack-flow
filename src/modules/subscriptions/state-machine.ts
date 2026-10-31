import type { SubscriptionStatus, SubscriptionLifecycleStatus } from "./types";

/**
 * Formal Finite State Machine defining permissible low-level database subscription transitions.
 * Enforces Rule 11: "Never allow arbitrary status transitions."
 */
export const VALID_SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  readonly SubscriptionStatus[]
> = {
  trialing: ["active", "cancelled", "expired"],
  active: ["paused", "past_due", "cancelled", "expired"],
  paused: ["active", "cancelled"],
  past_due: ["active", "cancelled", "expired"],
  cancelled: [], // Terminal state
  expired: [], // Terminal state
};

/**
 * Formal Lifecycle Finite State Machine for Brightloop business operations.
 * Permissible transitions:
 * - draft -> quotation, confirmed, closed
 * - quotation -> confirmed, closed
 * - confirmed -> active, closed
 * - active -> paused, closed
 * - paused -> active, closed
 * - closed -> none (terminal state)
 */
export const VALID_LIFECYCLE_TRANSITIONS: Record<
  SubscriptionLifecycleStatus,
  readonly SubscriptionLifecycleStatus[]
> = {
  draft: ["quotation", "confirmed", "closed"],
  quotation: ["confirmed", "closed"],
  confirmed: ["active", "closed"],
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: [], // Terminal state
};

/**
 * All valid lifecycle status identifiers
 */
export const LIFECYCLE_STATUSES: readonly SubscriptionLifecycleStatus[] = [
  "draft",
  "quotation",
  "confirmed",
  "active",
  "paused",
  "closed",
] as const;

/**
 * Checks whether transitioning from currentStatus to targetStatus is permitted.
 */
export function isTransitionAllowed(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): boolean {
  if (from === to) return true; // Idempotent no-op
  const allowed = VALID_SUBSCRIPTION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Asserts that a low-level status transition is permitted, throwing a detailed Error if invalid.
 */
export function assertTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): void {
  if (!isTransitionAllowed(from, to)) {
    const allowed = VALID_SUBSCRIPTION_TRANSITIONS[from] || [];
    const allowedText =
      allowed.length > 0 ? allowed.join(", ") : "none (terminal state)";
    throw new Error(
      `Illegal subscription transition: cannot transition from status '${from}' to '${to}'. Permitted transitions from '${from}': [${allowedText}].`
    );
  }
}

/**
 * Checks whether transitioning between lifecycle statuses is permitted.
 */
export function isLifecycleTransitionAllowed(
  from: SubscriptionLifecycleStatus,
  to: SubscriptionLifecycleStatus
): boolean {
  if (from === to) return true; // Idempotent no-op
  const allowed = VALID_LIFECYCLE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Asserts that a lifecycle status transition is permitted, throwing a detailed Error if invalid.
 */
export function assertLifecycleTransition(
  from: SubscriptionLifecycleStatus,
  to: SubscriptionLifecycleStatus
): void {
  if (!isLifecycleTransitionAllowed(from, to)) {
    const allowed = VALID_LIFECYCLE_TRANSITIONS[from] || [];
    const allowedText =
      allowed.length > 0 ? allowed.join(", ") : "none (terminal state)";
    throw new Error(
      `Illegal subscription lifecycle transition: cannot transition from status '${from}' to '${to}'. Permitted transitions from '${from}': [${allowedText}].`
    );
  }
}

/**
 * Returns permissible next statuses for a given state
 */
export function getAllowedTransitions(
  status: SubscriptionStatus
): readonly SubscriptionStatus[] {
  return VALID_SUBSCRIPTION_TRANSITIONS[status] || [];
}

/**
 * Returns permissible next lifecycle statuses for a given state
 */
export function getAllowedLifecycleTransitions(
  status: SubscriptionLifecycleStatus
): readonly SubscriptionLifecycleStatus[] {
  return VALID_LIFECYCLE_TRANSITIONS[status] || [];
}

/**
 * Maps a domain lifecycle status to the underlying database enum status
 */
export function mapLifecycleToDbStatus(
  lifecycle: SubscriptionLifecycleStatus
): SubscriptionStatus {
  switch (lifecycle) {
    case "draft":
      return "trialing";
    case "quotation":
      return "active";
    case "confirmed":
      return "active";
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "closed":
      return "cancelled";
    default:
      return "active";
  }
}

/**
 * Resolves the domain lifecycle status from database record fields.
 * Checks metadata.lifecycle_status first, falling back to mapping from status column.
 */
export function resolveLifecycleStatus(
  dbStatus: SubscriptionStatus,
  metadata?: Record<string, unknown> | null
): SubscriptionLifecycleStatus {
  const metaStatus = metadata?.lifecycle_status as string | undefined;

  if (metaStatus && (LIFECYCLE_STATUSES as readonly string[]).includes(metaStatus)) {
    return metaStatus as SubscriptionLifecycleStatus;
  }

  switch (dbStatus) {
    case "paused":
      return "paused";
    case "cancelled":
    case "expired":
      return "closed";
    case "active":
    case "trialing":
    case "past_due":
    default:
      return "active";
  }
}
