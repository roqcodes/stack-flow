import type { BillingCycle } from "../products/types";

/**
 * Low-level database subscription statuses (PostgreSQL subscription_status enum)
 */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired";

/**
 * Domain subscription lifecycle statuses requested for Brightloop
 * Enforces business lifecycle: draft -> quotation -> confirmed -> active -> paused -> closed
 */
export type SubscriptionLifecycleStatus =
  | "draft"
  | "quotation"
  | "confirmed"
  | "active"
  | "paused"
  | "closed";

export interface Subscription {
  id: string;
  subscription_number: string;
  customer_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  lifecycle_status: SubscriptionLifecycleStatus;
  billing_cycle: BillingCycle;
  currency: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  trial_start?: string | null;
  trial_end?: string | null;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  ended_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionItem {
  id: string;
  subscription_id: string;
  product_id: string;
  plan_id?: string | null;
  variant_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}

/**
 * Historical record of a successful subscription renewal cycle
 */
export interface RenewalHistoryRecord {
  renewal_id: string;
  cycle_number: number;
  renewed_at: string;
  previous_period_start: string;
  previous_period_end: string;
  new_period_start: string;
  new_period_end: string;
  invoice_id?: string | null;
  amount_paid?: number | null;
  idempotency_key?: string | null;
  actor_role?: string | null;
  actor_id?: string | null;
  notes?: string | null;
}

/**
 * Historical preserved subscription period
 */
export interface PreservedSubscriptionPeriod {
  period_index: number;
  period_start: string;
  period_end: string;
  archived_at: string;
  subtotal: number;
  total_amount: number;
  currency: string;
  invoice_id?: string | null;
}

/**
 * Historical record of a subscription pause event
 */
export interface SubscriptionPauseRecord {
  paused_at: string;
  reason: string;
  actor_role: string;
  actor_id?: string | null;
  resume_scheduled_at?: string | null;
}

/**
 * Historical record of a subscription resume event
 */
export interface SubscriptionResumeRecord {
  resumed_at: string;
  actor_role: string;
  actor_id?: string | null;
  resume_billing_now: boolean;
  adjusted_period_end: string;
  unspent_days_restored?: number | null;
}

/**
 * Structured cancellation request record
 */
export interface CancellationRequest {
  id: string;
  subscription_id: string;
  requested_at: string;
  requested_by?: string | null;
  requester_role?: string | null;
  immediately: boolean;
  effective_date: string;
  reason: string;
  feedback?: string | null;
  status: "applied" | "scheduled" | "revoked";
  revoked_at?: string | null;
  revoked_by?: string | null;
  revocation_notes?: string | null;
}

/**
 * Plan upgrade / downgrade / seat adjustment request record
 */
export type PlanChangeType =
  | "upgrade"
  | "downgrade"
  | "seat_adjustment"
  | "cycle_change";

export interface PlanChangeRequest {
  id: string;
  subscription_id: string;
  change_type: PlanChangeType;
  target_plan_id: string;
  target_plan_name?: string;
  target_quantity: number;
  target_billing_cycle?: BillingCycle;
  target_price?: number;
  immediately: boolean;
  effective_date: string;
  requested_at: string;
  requested_by?: string | null;
  requester_role?: string | null;
  status: "applied" | "scheduled" | "pending_approval" | "rejected" | "revoked";
  notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

/**
 * Customer organization snapshot attached to subscription views
 */
export interface SubscriptionCustomer {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  business_number?: string | null;
  currency: string;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
  status: string;
}

/**
 * Plan snapshot attached to subscription views
 */
export interface SubscriptionPlan {
  id: string;
  product_id: string;
  name: string;
  code: string;
  billing_cycle: BillingCycle;
  billing_interval_count: number;
  currency: string;
  price: number;
  trial_period_days: number;
  setup_fee: number;
  is_active: boolean;
  status: string;
}

/**
 * Full composite subscription model for detail view
 */
export interface SubscriptionWithDetails extends Subscription {
  customer?: SubscriptionCustomer | null;
  plan?: SubscriptionPlan | null;
  items: SubscriptionItem[];
}

/**
 * Raw plan rule record from database table 'plan_rules'
 */
export interface PlanRule {
  id: string;
  plan_id: string;
  rule_type: string;
  rule_value: string;
  description?: string | null;
  created_at: string;
}

/**
 * Parsed plan permissions and capability limits
 */
export interface PlanPermissions {
  planId: string;
  planName?: string;
  seatLimit: number | null; // null represents unlimited
  allowPause: boolean;
  maxPauseDays: number | null;
  allowImmediateCancellation?: boolean;
  minCommitmentDays?: number | null;
  requiresApproval: boolean;
  rules: PlanRule[];
  customRules: Record<string, string>;
}

/**
 * Filter criteria for subscription listings
 */
export interface SubscriptionFilters {
  search?: string;
  status?: SubscriptionLifecycleStatus | SubscriptionStatus | "all";
  billingCycle?: BillingCycle | "all";
  customerId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Executive subscription metrics
 */
export interface SubscriptionStats {
  totalSubscriptions: number;
  activeCount: number;
  trialingCount: number;
  pausedCount: number;
  pastDueCount: number;
  cancelledCount: number;
  draftCount: number;
  quotationCount: number;
  confirmedCount: number;
  closedCount: number;
  dueForBillingCount: number;
  monthlyRecurringRevenue: number;
}
