import type { BillingCycle } from "../products/types";
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionLifecycleStatus,
  SubscriptionWithDetails,
} from "./types";
import { ApiResponse } from "@/lib/api-response";
import type {
  NextBillingDateOptions,
  SubscriptionExpiryCheckResult,
} from "./date-utils";

/**
 * A discrete billing line item produced by a subscription for Member 4's invoice generator
 */
export interface SubscriptionBillingLine {
  id: string; // Line ID (plan line or subscription_item ID)
  subscription_id: string;
  product_id: string;
  plan_id?: string | null;
  description: string;
  quantity: number;
  unit_amount: number; // NUMERIC(14,2)
  discount_amount: number; // NUMERIC(14,2)
  tax_rate: number; // e.g. 7.25 (%)
  tax_amount: number; // NUMERIC(14,2)
  total_amount: number; // NUMERIC(14,2)
  is_recurring: boolean;
}

/**
 * Verified subscription payload ready for Member 4's billing cycle execution
 */
export interface SubscriptionForBilling {
  subscription_id: string;
  subscription_number: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  currency: string;
  period_start: string;
  period_end: string;
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

/**
 * Validation result returned before initiating billing cycle execution
 */
export interface SubscriptionBillingValidation {
  subscription_id: string;
  is_valid: boolean;
  can_proceed_to_billing: boolean;
  reasons: string[];
  warnings: string[];
  validated_at: string;
}

/**
 * Options for finding subscriptions due for billing
 */
export interface DueSubscriptionsOptions {
  asOfDate?: Date | string;
  limit?: number;
  offset?: number;
  currency?: string;
}

/**
 * Options for creating a subscription from an accepted quotation
 */
export interface CreateFromQuotationOptions {
  quotationId: string;
  startDate?: string;
  overrideCycle?: BillingCycle;
  notes?: string;
}

/**
 * Options for subscription lifecycle changes
 */
export interface PauseSubscriptionOptions {
  reason?: string;
  resumeScheduledAt?: string;
  actorRole?: string;
  actorId?: string;
}

export interface ResumeSubscriptionOptions {
  resumeBillingNow?: boolean;
  actorRole?: string;
  actorId?: string;
}

export interface CloseSubscriptionOptions {
  reason?: string;
  immediately?: boolean;
  actorRole?: string;
  actorId?: string;
  feedback?: string;
}

export interface SubmitCancellationRequestOptions {
  subscriptionId: string;
  immediately?: boolean;
  reason: string;
  feedback?: string;
  actorRole?: string;
  actorId?: string;
}

export interface RevokeCancellationRequestOptions {
  subscriptionId?: string;
  notes?: string;
  actorRole?: string;
  actorId?: string;
}

export interface SubmitPlanChangeRequestOptions {
  subscriptionId: string;
  targetPlanId: string;
  targetQuantity?: number;
  targetCycle?: BillingCycle;
  immediately?: boolean; // true = apply immediately; false = schedule for next renewal
  notes?: string;
  actorRole?: string;
  actorId?: string;
}

export interface RevokePlanChangeRequestOptions {
  subscriptionId?: string;
  notes?: string;
  actorRole?: string;
  actorId?: string;
}

export interface RenewSubscriptionOptions {
  advancePeriod?: boolean;
  idempotencyKey?: string;
  invoiceId?: string;
  amountPaid?: number;
  actorRole?: string;
  actorId?: string;
  notes?: string;
}

/**
 * Formal Service Contract Interface provided by Member 3 to Member 4 (Billing Engine)
 */
export interface ISubscriptionServiceContracts {
  createSubscriptionFromQuotation(
    quotationId: string,
    options?: Partial<CreateFromQuotationOptions>
  ): Promise<ApiResponse<SubscriptionWithDetails>>;

  getSubscriptionById(
    id: string
  ): Promise<ApiResponse<SubscriptionWithDetails>>;

  getDueSubscriptions(
    options?: DueSubscriptionsOptions
  ): Promise<ApiResponse<SubscriptionForBilling[]>>;

  getSubscriptionForBilling(
    subscriptionId: string
  ): Promise<ApiResponse<SubscriptionForBilling>>;

  getSubscriptionBillingLines(
    subscriptionId: string
  ): Promise<ApiResponse<SubscriptionBillingLine[]>>;

  validateSubscriptionForBilling(
    subscriptionId: string
  ): Promise<ApiResponse<SubscriptionBillingValidation>>;

  calculateNextBillingDate(
    currentPeriodEnd: Date | string,
    cycle: BillingCycle,
    intervalCount?: number,
    options?: NextBillingDateOptions
  ): Date;

  checkSubscriptionExpiry(
    subscriptionId: string,
    asOf?: Date | string
  ): Promise<ApiResponse<SubscriptionExpiryCheckResult>>;

  processExpiredSubscriptions(
    asOf?: Date | string
  ): Promise<ApiResponse<{ expiredCount: number; updatedSubscriptionIds: string[] }>>;

  pauseSubscription(
    subscriptionId: string,
    options?: PauseSubscriptionOptions
  ): Promise<ApiResponse<Subscription>>;

  resumeSubscription(
    subscriptionId: string,
    options?: ResumeSubscriptionOptions
  ): Promise<ApiResponse<Subscription>>;

  closeSubscription(
    subscriptionId: string,
    options?: CloseSubscriptionOptions
  ): Promise<ApiResponse<Subscription>>;

  submitCancellationRequest(
    options: SubmitCancellationRequestOptions
  ): Promise<ApiResponse<Subscription>>;

  revokeCancellationRequest(
    subscriptionId: string,
    options?: RevokeCancellationRequestOptions
  ): Promise<ApiResponse<Subscription>>;

  processAutomaticClosures(
    asOf?: Date | string
  ): Promise<ApiResponse<{ closedCount: number; closedSubscriptionIds: string[] }>>;

  submitPlanChangeRequest(
    options: SubmitPlanChangeRequestOptions
  ): Promise<ApiResponse<SubscriptionWithDetails>>;

  revokePlanChangeRequest(
    subscriptionId: string,
    options?: RevokePlanChangeRequestOptions
  ): Promise<ApiResponse<SubscriptionWithDetails>>;

  approvePlanChangeRequest(
    subscriptionId: string,
    options?: { notes?: string; actorId?: string }
  ): Promise<ApiResponse<SubscriptionWithDetails>>;

  renewSubscription(
    subscriptionId: string,
    options?: RenewSubscriptionOptions
  ): Promise<ApiResponse<Subscription>>;

  transitionSubscriptionLifecycle(
    subscriptionId: string,
    targetStatus: SubscriptionLifecycleStatus,
    options?: {
      reason?: string;
      actorRole?: string;
      actorId?: string;
      resumeScheduledAt?: string;
      resumeBillingNow?: boolean;
    }
  ): Promise<ApiResponse<SubscriptionWithDetails>>;
}
