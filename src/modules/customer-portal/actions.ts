"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, getCurrentProfile } from "@/modules/auth/auth-utils";
import { apiSuccess, apiError, ApiResponse, ERROR_CODES } from "@/lib/api-response";
import {
  CustomerPortalData,
  PortalInvoiceSummary,
  PortalPaymentSummary,
} from "./types";
import { subscriptionService } from "@/modules/subscriptions/subscription-service";
import {
  SubscriptionWithDetails,
  Subscription,
  SubscriptionPlan,
} from "@/modules/subscriptions/types";
import { resolveLifecycleStatus } from "@/modules/subscriptions/state-machine";

/**
 * Loads comprehensive customer portal data for the authenticated session
 */
export async function getCustomerPortalDataAction(
  targetCustomerId?: string
): Promise<ApiResponse<CustomerPortalData>> {
  try {
    const user = await requireAuth();
    const profile = await getCurrentProfile();
    const supabase = await createClient();

    let customerId: string | null = null;

    if (profile?.role === "admin" || profile?.role === "staff") {
      // Staff/Admin can preview a specified customer or fallback to first available
      if (targetCustomerId) {
        customerId = targetCustomerId;
      } else {
        const { data: firstCust } = await supabase
          .from("customers")
          .select("id")
          .limit(1)
          .single();
        customerId = firstCust?.id || null;
      }
    } else {
      // Customer role strictly resolved from auth profile
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .single();
      customerId = cust?.id || null;
    }

    if (!customerId) {
      return apiError(
        ERROR_CODES.NOT_FOUND,
        "No customer organization profile associated with your account."
      );
    }

    // 1. Fetch Customer Record
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (custErr || !customer) {
      return apiError(ERROR_CODES.NOT_FOUND, "Customer record not found.");
    }

    // 2. Fetch Subscriptions
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*, plans(*)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    let activeSubWithDetails: SubscriptionWithDetails | null = null;
    const historySubs: Subscription[] = [];

    const activeSub = (subs || []).find(
      (s) => s.status === "active" || s.status === "trialing" || s.status === "paused"
    );

    if (activeSub) {
      const detailRes = await subscriptionService.getSubscriptionById(activeSub.id);
      if (detailRes.success) {
        activeSubWithDetails = detailRes.data;
      }
    }

    (subs || []).forEach((s) => {
      if (!activeSub || s.id !== activeSub.id) {
        historySubs.push({
          ...s,
          lifecycle_status: resolveLifecycleStatus(s.status, s.metadata),
        } as unknown as Subscription);
      }
    });

    // 3. Fetch Invoices (Read-only statements)
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, total_amount, amount_paid, amount_due, currency, issue_date, due_date, paid_at")
      .eq("customer_id", customerId)
      .order("issue_date", { ascending: false })
      .limit(20);

    const invoiceSummaries: PortalInvoiceSummary[] = (invoices || []).map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      status: inv.status,
      total_amount: Number(inv.total_amount),
      amount_paid: Number(inv.amount_paid),
      amount_due: Number(inv.amount_due),
      currency: inv.currency,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      paid_at: inv.paid_at,
    }));

    // 4. Fetch Payments & Allocations (Read-only transaction ledger)
    const { data: payments } = await supabase
      .from("payments")
      .select(`
        id,
        payment_number,
        customer_id,
        amount,
        currency,
        status,
        payment_method_type,
        transaction_reference,
        failure_reason,
        refunded_amount,
        paid_at,
        created_at,
        payment_allocations (
          allocated_amount,
          invoice_id,
          invoices (invoice_number)
        )
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(30);

    const paymentSummaries: PortalPaymentSummary[] = (payments || []).map((pay) => {
      const allocations = (pay.payment_allocations as unknown as Array<{
        allocated_amount: number;
        invoice_id: string;
        invoices: { invoice_number: string } | null;
      }>) || [];
      const primaryAlloc = allocations[0];

      return {
        id: pay.id,
        payment_number: pay.payment_number,
        customer_id: pay.customer_id,
        amount: Number(pay.amount),
        currency: pay.currency,
        status: pay.status,
        payment_method_type: pay.payment_method_type,
        transaction_reference: pay.transaction_reference,
        failure_reason: pay.failure_reason,
        refunded_amount: Number(pay.refunded_amount || 0),
        paid_at: pay.paid_at,
        created_at: pay.created_at,
        allocated_invoice_number: primaryAlloc?.invoices?.invoice_number || null,
        allocated_invoice_id: primaryAlloc?.invoice_id || null,
      };
    });

    // 5. Fetch Active Plans for customer self-service upgrade/downgrade selection
    const { data: plans } = await supabase
      .from("plans")
      .select("id, product_id, name, code, billing_cycle, billing_interval_count, currency, price, trial_period_days, setup_fee, is_active, status")
      .eq("is_active", true)
      .order("price", { ascending: true });

    return apiSuccess({
      customer: {
        id: customer.id,
        company_name: customer.company_name,
        contact_name: customer.contact_name,
        email: customer.email,
        business_number: customer.business_number,
        currency: customer.currency,
        billing_address_line1: customer.billing_address_line1,
        billing_city: customer.billing_city,
        billing_state: customer.billing_state,
        billing_postal_code: customer.billing_postal_code,
        billing_country: customer.billing_country,
        status: customer.status,
      },
      activeSubscription: activeSubWithDetails,
      subscriptionHistory: historySubs,
      invoices: invoiceSummaries,
      payments: paymentSummaries,
      availablePlans: (plans || []) as unknown as SubscriptionPlan[],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load portal data";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Customer Self-Service: Submit an upgrade / downgrade / seat change request
 */
export async function submitPortalPlanChangeAction(params: {
  subscriptionId: string;
  targetPlanId: string;
  targetQuantity?: number;
  immediately?: boolean;
  notes?: string;
}): Promise<ApiResponse<SubscriptionWithDetails>> {
  const user = await requireAuth();
  const profile = await getCurrentProfile();

  const res = await subscriptionService.submitPlanChangeRequest({
    subscriptionId: params.subscriptionId,
    targetPlanId: params.targetPlanId,
    targetQuantity: params.targetQuantity,
    immediately: params.immediately,
    notes: params.notes,
    actorRole: profile?.role || "customer",
    actorId: user.id,
  });

  if (res.success) {
    revalidatePath("/portal");
    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${params.subscriptionId}`);
  }

  return res;
}

/**
 * Customer Self-Service: Revoke a pending or scheduled plan change request
 */
export async function revokePortalPlanChangeAction(params: {
  subscriptionId: string;
  notes?: string;
}): Promise<ApiResponse<SubscriptionWithDetails>> {
  const user = await requireAuth();
  const profile = await getCurrentProfile();

  const res = await subscriptionService.revokePlanChangeRequest(params.subscriptionId, {
    notes: params.notes || "Revoked by customer in portal",
    actorRole: profile?.role || "customer",
    actorId: user.id,
  });

  if (res.success) {
    revalidatePath("/portal");
    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${params.subscriptionId}`);
  }

  return res;
}

/**
 * Customer Self-Service: Submit a cancellation request (immediate or at period end)
 */
export async function submitPortalCancellationAction(params: {
  subscriptionId: string;
  immediately: boolean;
  reason: string;
  feedback?: string;
}): Promise<ApiResponse<Subscription>> {
  const user = await requireAuth();
  const profile = await getCurrentProfile();

  const res = await subscriptionService.submitCancellationRequest({
    subscriptionId: params.subscriptionId,
    immediately: params.immediately,
    reason: params.reason,
    feedback: params.feedback,
    actorRole: profile?.role || "customer",
    actorId: user.id,
  });

  if (res.success) {
    revalidatePath("/portal");
    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${params.subscriptionId}`);
  }

  return res;
}

/**
 * Customer Self-Service: Revoke a scheduled period-end cancellation
 */
export async function revokePortalCancellationAction(params: {
  subscriptionId: string;
  notes?: string;
}): Promise<ApiResponse<Subscription>> {
  const user = await requireAuth();
  const profile = await getCurrentProfile();

  const res = await subscriptionService.revokeCancellationRequest(params.subscriptionId, {
    notes: params.notes || "Revoked by customer in portal",
    actorRole: profile?.role || "customer",
    actorId: user.id,
  });

  if (res.success) {
    revalidatePath("/portal");
    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${params.subscriptionId}`);
  }

  return res;
}

