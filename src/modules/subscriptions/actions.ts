"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole, getCurrentProfile } from "@/modules/auth/auth-utils";
import { apiSuccess, apiError, ApiResponse, ERROR_CODES } from "@/lib/api-response";
import { subscriptionService } from "./subscription-service";
import {
  Subscription,
  SubscriptionWithDetails,
  SubscriptionFilters,
  SubscriptionStats,
  SubscriptionLifecycleStatus,
  PlanPermissions,
} from "./types";
import {
  SubscriptionBillingLine,
  SubscriptionForBilling,
  SubscriptionBillingValidation,
} from "./service-contracts";
import {
  createSubscriptionFromQuotationSchema,
  CreateSubscriptionFromQuotationInput,
  createDirectSubscriptionSchema,
  CreateDirectSubscriptionInput,
  transitionSubscriptionLifecycleSchema,
  TransitionSubscriptionLifecycleInput,
  pauseSubscriptionSchema,
  PauseSubscriptionInput,
  resumeSubscriptionSchema,
  ResumeSubscriptionInput,
  closeSubscriptionSchema,
  CloseSubscriptionInput,
  submitCancellationRequestSchema,
  SubmitCancellationRequestInput,
  revokeCancellationRequestSchema,
  RevokeCancellationRequestInput,
  submitPlanChangeRequestSchema,
  SubmitPlanChangeRequestInput,
  revokePlanChangeRequestSchema,
  RevokePlanChangeRequestInput,
  renewSubscriptionSchema,
  RenewSubscriptionInput,
  subscriptionFiltersSchema,
} from "./validations";
import {
  calculateNextBillingDate,
  SubscriptionExpiryCheckResult,
} from "./date-utils";
import { resolveLifecycleStatus } from "./state-machine";
import { validatePlanSeatLimit, getPlanPermissions } from "./plan-permissions";
import { BillingCycle } from "../products/types";

/**
 * Lists subscriptions with role-based filtering
 */
export async function listSubscriptionsAction(
  filters: SubscriptionFilters = {}
): Promise<
  ApiResponse<{
    subscriptions: SubscriptionWithDetails[];
    totalCount: number;
    stats: SubscriptionStats;
  }>
> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = subscriptionFiltersSchema.safeParse(filters);
    const validFilters: SubscriptionFilters = validation.success
      ? { ...validation.data }
      : {};

    // Customer role is strictly restricted to their own entity
    if (profile?.role === "customer") {
      const supabase = await createClient();
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!customer) {
        return apiSuccess({
          subscriptions: [],
          totalCount: 0,
          stats: {
            totalSubscriptions: 0,
            activeCount: 0,
            trialingCount: 0,
            pausedCount: 0,
            pastDueCount: 0,
            cancelledCount: 0,
            draftCount: 0,
            quotationCount: 0,
            confirmedCount: 0,
            closedCount: 0,
            dueForBillingCount: 0,
            monthlyRecurringRevenue: 0,
          },
        });
      }

      validFilters.customerId = customer.id;
    }

    return await subscriptionService.listSubscriptions(validFilters);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication error";
    return apiError(ERROR_CODES.UNAUTHENTICATED, message);
  }
}

/**
 * Retrieves full details for a single subscription
 */
export async function getSubscriptionByIdAction(
  id: string
): Promise<ApiResponse<SubscriptionWithDetails>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const result = await subscriptionService.getSubscriptionById(id);
    if (!result.success) return result;

    // Enforce customer boundary
    if (profile?.role === "customer" && result.data.customer?.id) {
      const supabase = await createClient();
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!customer || customer.id !== result.data.customer.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Access to this subscription is denied.");
      }
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load subscription";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Converts an accepted quotation into an active subscription (Admin & Staff)
 */
export async function createSubscriptionFromQuotationAction(
  input: CreateSubscriptionFromQuotationInput
): Promise<ApiResponse<SubscriptionWithDetails>> {
  try {
    await requireRole(["admin", "staff"]);

    const validation = createSubscriptionFromQuotationSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    const res = await subscriptionService.createSubscriptionFromQuotation(
      validation.data.quotationId,
      {
        startDate: validation.data.startDate,
        overrideCycle: validation.data.overrideCycle,
        notes: validation.data.notes,
      }
    );

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath("/quotations");
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Conversion failed";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Direct subscription creation from customer and plan (Admin & Staff)
 * Supports initial status 'draft' or 'active', enforcing Plan Rules.
 */
export async function createDirectSubscriptionAction(
  input: CreateDirectSubscriptionInput
): Promise<ApiResponse<Subscription>> {
  try {
    const { profile } = await requireRole(["admin", "staff"]);

    const validation = createDirectSubscriptionSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    const { customerId, planId, quantity, initialStatus, startDate, notes } =
      validation.data;
    const supabase = await createClient();

    // Verify Customer
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (custErr || !customer) {
      return apiError(ERROR_CODES.NOT_FOUND, "Customer not found.");
    }

    // Verify Plan
    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planErr || !plan) {
      return apiError(ERROR_CODES.NOT_FOUND, "Plan not found.");
    }

    // Enforce Plan Seat Limits
    const seatCheck = await validatePlanSeatLimit(planId, quantity, supabase);
    if (!seatCheck.allowed) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        seatCheck.error || `Quantity (${quantity}) exceeds plan seat limit.`
      );
    }

    const start = startDate ? new Date(startDate) : new Date();
    const cycle = plan.billing_cycle as BillingCycle;
    const intervalCount = plan.billing_interval_count || 1;

    let dbStatus: "trialing" | "active" = "active";
    let trialStart: string | null = null;
    let trialEnd: string | null = null;
    let end: Date;

    const targetLifecycle: SubscriptionLifecycleStatus = initialStatus || "active";

    if (targetLifecycle === "draft") {
      dbStatus = "trialing";
      end = calculateNextBillingDate(start, cycle, intervalCount);
    } else if (plan.trial_period_days > 0) {
      dbStatus = "trialing";
      trialStart = start.toISOString();
      const tEnd = new Date(start.getTime());
      tEnd.setUTCDate(tEnd.getUTCDate() + plan.trial_period_days);
      trialEnd = tEnd.toISOString();
      end = tEnd;
    } else {
      end = calculateNextBillingDate(start, cycle, intervalCount);
    }

    const unitPrice = Number(plan.price);
    const subtotal = Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100;
    const subNumber = `SUB-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const nowIso = new Date().toISOString();
    const { data: newSub, error: insertErr } = await supabase
      .from("subscriptions")
      .insert({
        subscription_number: subNumber,
        customer_id: customerId,
        plan_id: planId,
        status: dbStatus,
        billing_cycle: cycle,
        currency: plan.currency || "USD",
        unit_price: unitPrice,
        quantity,
        subtotal,
        discount_amount: 0.0,
        tax_amount: 0.0,
        total_amount: subtotal,
        trial_start: trialStart,
        trial_end: trialEnd,
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        next_billing_date: end.toISOString(),
        metadata: {
          lifecycle_status: targetLifecycle,
          status_history: [
            {
              from: "initial",
              to: targetLifecycle,
              at: nowIso,
              reason: targetLifecycle === "draft" ? "Created as draft" : "Direct subscription creation",
              actorRole: profile?.role || "staff",
            },
          ],
          notes: notes || null,
        },
      })
      .select()
      .single();

    if (insertErr || !newSub) {
      return apiError(ERROR_CODES.DATABASE_ERROR, insertErr?.message || "Failed to create subscription.");
    }

    // Insert primary item
    await supabase.from("subscription_items").insert({
      subscription_id: newSub.id,
      product_id: plan.product_id,
      plan_id: plan.id,
      description: `${plan.name} (${cycle})`,
      quantity,
      unit_price: unitPrice,
      subtotal,
    });

    revalidatePath("/subscriptions");
    return apiSuccess({
      ...newSub,
      lifecycle_status: resolveLifecycleStatus(newSub.status, newSub.metadata),
    } as Subscription);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Creation failed";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Formally transitions a subscription through its business lifecycle statuses:
 * draft -> quotation -> confirmed -> active -> paused -> closed
 * Enforces Role-based permissions, Finite State Machine, and Plan-Specific Rules.
 */
export async function transitionSubscriptionLifecycleAction(
  input: TransitionSubscriptionLifecycleInput
): Promise<ApiResponse<SubscriptionWithDetails>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = transitionSubscriptionLifecycleSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    const { subscriptionId, targetStatus, reason } = validation.data;

    // Check ownership & role restrictions if user is customer
    if (profile?.role === "customer") {
      const subCheck = await subscriptionService.getSubscriptionById(subscriptionId);
      if (!subCheck.success) return subCheck;

      const supabase = await createClient();
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!cust || cust.id !== subCheck.data.customer?.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Unauthorized action on subscription.");
      }

      // Customers may ONLY transition to 'paused' or 'closed'
      if (targetStatus !== "paused" && targetStatus !== "closed") {
        return apiError(
          ERROR_CODES.FORBIDDEN,
          `Customers are not authorized to transition subscriptions to '${targetStatus}'. Please contact support.`
        );
      }
    }

    const res = await subscriptionService.transitionSubscriptionLifecycle(
      subscriptionId,
      targetStatus,
      {
        reason,
        actorRole: profile?.role || "user",
        actorId: user.id,
      }
    );

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to transition subscription lifecycle";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Retrieves parsed plan permissions & rules for a plan
 */
export async function getPlanPermissionsAction(
  planId: string
): Promise<ApiResponse<PlanPermissions>> {
  try {
    await requireAuth();
    const permissions = await getPlanPermissions(planId);
    return apiSuccess(permissions);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load plan permissions";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Pauses an active subscription (Admin, Staff, or Customer for own)
 */
export async function pauseSubscriptionAction(
  input: PauseSubscriptionInput
): Promise<ApiResponse<Subscription>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = pauseSubscriptionSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    // Check ownership if customer
    if (profile?.role === "customer") {
      const subCheck = await subscriptionService.getSubscriptionById(validation.data.subscriptionId);
      if (!subCheck.success) return subCheck as ApiResponse<Subscription>;
      
      const supabase = await createClient();
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!cust || cust.id !== subCheck.data.customer?.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Unauthorized action.");
      }
    }

    const res = await subscriptionService.pauseSubscription(validation.data.subscriptionId, {
      reason: validation.data.reason,
      resumeScheduledAt: validation.data.resumeScheduledAt,
      actorRole: profile?.role || "user",
      actorId: user.id,
    });

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${validation.data.subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to pause subscription";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Resumes a paused subscription
 */
export async function resumeSubscriptionAction(
  input: ResumeSubscriptionInput
): Promise<ApiResponse<Subscription>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = resumeSubscriptionSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    // Check ownership if customer
    if (profile?.role === "customer") {
      const subCheck = await subscriptionService.getSubscriptionById(validation.data.subscriptionId);
      if (!subCheck.success) return subCheck as ApiResponse<Subscription>;

      const supabase = await createClient();
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!cust || cust.id !== subCheck.data.customer?.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Unauthorized action.");
      }
    }

    const res = await subscriptionService.resumeSubscription(validation.data.subscriptionId, {
      resumeBillingNow: validation.data.resumeBillingNow,
      actorRole: profile?.role || "user",
      actorId: user.id,
    });

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${validation.data.subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to resume subscription";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Cancels / Closes a subscription
 */
export async function closeSubscriptionAction(
  input: CloseSubscriptionInput
): Promise<ApiResponse<Subscription>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = closeSubscriptionSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    // Check ownership if customer
    if (profile?.role === "customer") {
      const subCheck = await subscriptionService.getSubscriptionById(validation.data.subscriptionId);
      if (!subCheck.success) return subCheck as ApiResponse<Subscription>;

      const supabase = await createClient();
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!cust || cust.id !== subCheck.data.customer?.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Unauthorized action.");
      }
    }

    const res = await subscriptionService.closeSubscription(validation.data.subscriptionId, {
      reason: validation.data.reason,
      immediately: validation.data.immediately,
      feedback: validation.data.feedback,
      actorRole: profile?.role || "user",
      actorId: user.id,
    });

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${validation.data.subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to close subscription";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Submits a cancellation request (immediate early closure or scheduled at period end)
 */
export async function submitCancellationRequestAction(
  input: SubmitCancellationRequestInput
): Promise<ApiResponse<Subscription>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = submitCancellationRequestSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    // Check ownership if customer
    if (profile?.role === "customer") {
      const subCheck = await subscriptionService.getSubscriptionById(validation.data.subscriptionId);
      if (!subCheck.success) return subCheck as ApiResponse<Subscription>;

      const supabase = await createClient();
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!cust || cust.id !== subCheck.data.customer?.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Unauthorized action.");
      }
    }

    const res = await subscriptionService.submitCancellationRequest({
      subscriptionId: validation.data.subscriptionId,
      immediately: validation.data.immediately,
      reason: validation.data.reason,
      feedback: validation.data.feedback,
      actorRole: profile?.role || "user",
      actorId: user.id,
    });

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${validation.data.subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to submit cancellation request";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Revokes a pending period-end scheduled cancellation request
 */
export async function revokeCancellationRequestAction(
  input: RevokeCancellationRequestInput
): Promise<ApiResponse<Subscription>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = revokeCancellationRequestSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    // Check ownership if customer
    if (profile?.role === "customer") {
      const subCheck = await subscriptionService.getSubscriptionById(validation.data.subscriptionId);
      if (!subCheck.success) return subCheck as ApiResponse<Subscription>;

      const supabase = await createClient();
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!cust || cust.id !== subCheck.data.customer?.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Unauthorized action.");
      }
    }

    const res = await subscriptionService.revokeCancellationRequest(
      validation.data.subscriptionId,
      {
        notes: validation.data.notes,
        actorRole: profile?.role || "user",
        actorId: user.id,
      }
    );

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${validation.data.subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to revoke cancellation request";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Sweeps and marks automatic closures for subscriptions reaching period end or fixed contract term (Admin/Staff only)
 */
export async function processAutomaticClosuresAction(
  asOf?: string
): Promise<ApiResponse<{ closedCount: number; closedSubscriptionIds: string[] }>> {
  try {
    await requireRole(["admin", "staff"]);
    const res = await subscriptionService.processAutomaticClosures(asOf);
    if (res.success && res.data.closedCount > 0) {
      revalidatePath("/subscriptions");
      revalidatePath("/portal");
    }
    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to process automatic closures";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Submits an upgrade, downgrade, or seat change request
 */
export async function submitPlanChangeRequestAction(
  input: SubmitPlanChangeRequestInput
): Promise<ApiResponse<SubscriptionWithDetails>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = submitPlanChangeRequestSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    // Check ownership if customer
    if (profile?.role === "customer") {
      const subCheck = await subscriptionService.getSubscriptionById(validation.data.subscriptionId);
      if (!subCheck.success) return subCheck;

      const supabase = await createClient();
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!cust || cust.id !== subCheck.data.customer?.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Unauthorized action.");
      }
    }

    const res = await subscriptionService.submitPlanChangeRequest({
      subscriptionId: validation.data.subscriptionId,
      targetPlanId: validation.data.targetPlanId,
      targetQuantity: validation.data.targetQuantity,
      targetCycle: validation.data.targetCycle,
      immediately: validation.data.immediately,
      notes: validation.data.notes,
      actorRole: profile?.role || "customer",
      actorId: user.id,
    });

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${validation.data.subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to submit plan change request";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Revokes a pending or scheduled plan change request
 */
export async function revokePlanChangeRequestAction(
  input: RevokePlanChangeRequestInput
): Promise<ApiResponse<SubscriptionWithDetails>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();

    const validation = revokePlanChangeRequestSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    // Check ownership if customer
    if (profile?.role === "customer") {
      const subCheck = await subscriptionService.getSubscriptionById(validation.data.subscriptionId);
      if (!subCheck.success) return subCheck;

      const supabase = await createClient();
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (!cust || cust.id !== subCheck.data.customer?.id) {
        return apiError(ERROR_CODES.FORBIDDEN, "Unauthorized action.");
      }
    }

    const res = await subscriptionService.revokePlanChangeRequest(
      validation.data.subscriptionId,
      {
        notes: validation.data.notes,
        actorRole: profile?.role || "user",
        actorId: user.id,
      }
    );

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${validation.data.subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to revoke plan change request";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Approves a plan change request pending approval (Admin/Staff only)
 */
export async function approvePlanChangeRequestAction(
  subscriptionIdOrOptions: string | { subscriptionId: string; notes?: string },
  maybeNotes?: string
): Promise<ApiResponse<SubscriptionWithDetails>> {
  try {
    const { user } = await requireRole(["admin", "staff"]);
    const subscriptionId =
      typeof subscriptionIdOrOptions === "string"
        ? subscriptionIdOrOptions
        : subscriptionIdOrOptions.subscriptionId;
    const notes =
      typeof subscriptionIdOrOptions === "string"
        ? maybeNotes
        : subscriptionIdOrOptions.notes;

    const res = await subscriptionService.approvePlanChangeRequest(subscriptionId, {
      notes,
      actorId: user.id,
    });

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to approve plan change request";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Advances subscription period (Renewal)
 * Enforces permission checks (Admin & Staff) and duplicate renewal prevention.
 */
export async function renewSubscriptionAction(
  input: RenewSubscriptionInput
): Promise<ApiResponse<Subscription>> {
  try {
    const { user, profile } = await requireRole(["admin", "staff"]);

    const validation = renewSubscriptionSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation error",
        validation.error.flatten().fieldErrors
      );
    }

    const res = await subscriptionService.renewSubscription(validation.data.subscriptionId, {
      advancePeriod: validation.data.advancePeriod,
      idempotencyKey: validation.data.idempotencyKey,
      invoiceId: validation.data.invoiceId,
      amountPaid: validation.data.amountPaid,
      notes: validation.data.notes,
      actorRole: profile.role,
      actorId: user.id,
    });

    if (res.success) {
      revalidatePath("/subscriptions");
      revalidatePath(`/subscriptions/${validation.data.subscriptionId}`);
      revalidatePath("/portal");
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to renew subscription";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Tests Member 4's billing readiness contract live from UI
 */
export async function validateSubscriptionForBillingAction(
  subscriptionId: string
): Promise<ApiResponse<SubscriptionBillingValidation>> {
  try {
    await requireRole(["admin", "staff"]);
    return await subscriptionService.validateSubscriptionForBilling(subscriptionId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Validation check failed";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Tests Member 4's subscription billing payload contract
 */
export async function getSubscriptionForBillingAction(
  subscriptionId: string
): Promise<ApiResponse<SubscriptionForBilling>> {
  try {
    await requireRole(["admin", "staff"]);
    return await subscriptionService.getSubscriptionForBilling(subscriptionId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load billing payload";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Tests Member 4's billing lines contract
 */
export async function getSubscriptionBillingLinesAction(
  subscriptionId: string
): Promise<ApiResponse<SubscriptionBillingLine[]>> {
  try {
    await requireRole(["admin", "staff"]);
    return await subscriptionService.getSubscriptionBillingLines(subscriptionId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load billing lines";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Loads accepted quotations ready to be converted into subscriptions
 */
export async function getAcceptedQuotationsForConversionAction(): Promise<
  ApiResponse<
    Array<{
      id: string;
      quotation_number: string;
      customer_id: string;
      customer_name: string;
      total_amount: number;
      currency: string;
      valid_until: string;
      accepted_at: string | null;
    }>
  >
> {
  try {
    await requireRole(["admin", "staff"]);
    const supabase = await createClient();

    const { data: quotes, error } = await supabase
      .from("quotations")
      .select("id, quotation_number, customer_id, total_amount, currency, valid_until, accepted_at, converted_subscription_id, customers(company_name)")
      .eq("status", "accepted")
      .is("converted_subscription_id", null)
      .order("accepted_at", { ascending: false });

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    const formatted = (quotes || []).map((q) => {
      const cust = q.customers as unknown as { company_name: string } | null;
      return {
        id: q.id,
        quotation_number: q.quotation_number,
        customer_id: q.customer_id,
        customer_name: cust?.company_name || "Unknown Company",
        total_amount: Number(q.total_amount),
        currency: q.currency,
        valid_until: q.valid_until,
        accepted_at: q.accepted_at,
      };
    });

    return apiSuccess(formatted);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load accepted quotations";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Loads active customers and plans for subscription creation
 */
export async function getActivePlansAndCustomersAction(): Promise<
  ApiResponse<{
    customers: Array<{ id: string; company_name: string; email: string }>;
    plans: Array<{
      id: string;
      name: string;
      code: string;
      price: number;
      billing_cycle: string;
      trial_period_days: number;
    }>;
  }>
> {
  try {
    await requireRole(["admin", "staff"]);
    const supabase = await createClient();

    const [custRes, planRes] = await Promise.all([
      supabase.from("customers").select("id, company_name, email").eq("is_active", true).order("company_name"),
      supabase.from("plans").select("id, name, code, price, billing_cycle, trial_period_days").eq("is_active", true).order("name"),
    ]);

    return apiSuccess({
      customers: (custRes.data || []).map((c) => ({
        id: c.id,
        company_name: c.company_name,
        email: c.email,
      })),
      plans: (planRes.data || []).map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        price: Number(p.price),
        billing_cycle: p.billing_cycle,
        trial_period_days: p.trial_period_days,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load catalog data";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Checks subscription expiration standing
 */
export async function checkSubscriptionExpiryAction(
  subscriptionId: string
): Promise<ApiResponse<SubscriptionExpiryCheckResult>> {
  try {
    await requireAuth();
    return await subscriptionService.checkSubscriptionExpiry(subscriptionId);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to check subscription expiry";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Sweeps and marks expired subscriptions (Admin/Staff only)
 */
export async function processExpiredSubscriptionsAction(
  asOf?: string
): Promise<ApiResponse<{ expiredCount: number; updatedSubscriptionIds: string[] }>> {
  try {
    await requireRole(["admin", "staff"]);
    const res = await subscriptionService.processExpiredSubscriptions(asOf);
    if (res.success && res.data.expiredCount > 0) {
      revalidatePath("/subscriptions");
    }
    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to process expired subscriptions";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

