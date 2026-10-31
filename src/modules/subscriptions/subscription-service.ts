import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, ApiResponse, ERROR_CODES } from "@/lib/api-response";
import type { BillingCycle } from "../products/types";
import {
  Subscription,
  SubscriptionItem,
  SubscriptionWithDetails,
  SubscriptionCustomer,
  SubscriptionPlan,
  SubscriptionStats,
  SubscriptionFilters,
  SubscriptionLifecycleStatus,
  RenewalHistoryRecord,
  PreservedSubscriptionPeriod,
  SubscriptionPauseRecord,
  SubscriptionResumeRecord,
  CancellationRequest,
  PlanChangeRequest,
  PlanChangeType,
} from "./types";
import {
  ISubscriptionServiceContracts,
  SubscriptionBillingLine,
  SubscriptionForBilling,
  SubscriptionBillingValidation,
  DueSubscriptionsOptions,
  CreateFromQuotationOptions,
  PauseSubscriptionOptions,
  ResumeSubscriptionOptions,
  CloseSubscriptionOptions,
  RenewSubscriptionOptions,
  SubmitCancellationRequestOptions,
  RevokeCancellationRequestOptions,
  SubmitPlanChangeRequestOptions,
  RevokePlanChangeRequestOptions,
} from "./service-contracts";
import {
  calculateNextBillingDate,
  checkSubscriptionExpiry,
  NextBillingDateOptions,
  SubscriptionExpiryCheckResult,
} from "./date-utils";
import {
  assertLifecycleTransition,
  resolveLifecycleStatus,
  mapLifecycleToDbStatus,
} from "./state-machine";
import {
  validatePlanSeatLimit,
  validatePlanTransition,
  getPlanPermissions,
} from "./plan-permissions";

/**
 * Rounds a monetary number to 2 decimal places (NUMERIC(14,2) precision)
 */
function roundFinancial(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Generates an enterprise-standard sequential/unique subscription identifier with collision check
 */
async function generateUniqueSubscriptionNumber(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const candidate = `SUB-${year}-${randomSuffix}`;
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("subscription_number", candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }
  // High-entropy fallback
  return `SUB-${year}-${Date.now().toString().slice(-6)}`;
}

export class SubscriptionService implements ISubscriptionServiceContracts {
  /**
   * 1. createSubscriptionFromQuotation
   * Converts an accepted sales quote into an active or trialing subscription.
   * Links quotation via converted_subscription_id.
   */
  async createSubscriptionFromQuotation(
    quotationId: string,
    options?: Partial<CreateFromQuotationOptions>
  ): Promise<ApiResponse<SubscriptionWithDetails>> {
    try {
      const supabase = await createClient();

      // Step 1: Verify quotation existence and acceptance status
      const { data: quotation, error: quoteError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .single();

      if (quoteError || !quotation) {
        return apiError(
          ERROR_CODES.NOT_FOUND,
          `Quotation ${quotationId} not found.`
        );
      }

      if (quotation.status !== "accepted") {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          `Cannot convert quotation ${quotation.quotation_number}: status is '${quotation.status}', must be 'accepted'.`
        );
      }

      // Hard check: prevent duplicate conversion via converted_subscription_id
      if (quotation.converted_subscription_id) {
        return apiError(
          ERROR_CODES.CONFLICT,
          `Quotation ${quotation.quotation_number} has already been converted to subscription ${quotation.converted_subscription_id}. Duplicate conversion prevented.`
        );
      }

      // Secondary check: verify if an active subscription already points to this quotation in metadata
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id, subscription_number")
        .eq("metadata->>converted_from_quotation_id", quotationId)
        .maybeSingle();

      if (existingSub) {
        // Heal quotation pointer if out-of-sync
        await supabase
          .from("quotations")
          .update({ converted_subscription_id: existingSub.id })
          .eq("id", quotationId);

        return apiError(
          ERROR_CODES.CONFLICT,
          `Quotation ${quotation.quotation_number} has already been converted to subscription ${existingSub.subscription_number}. Duplicate conversion prevented.`
        );
      }

      // Step 2: Verify Customer standing & information
      const { data: customer, error: custError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", quotation.customer_id)
        .single();

      if (custError || !customer) {
        return apiError(
          ERROR_CODES.NOT_FOUND,
          `Customer ${quotation.customer_id} does not exist.`
        );
      }

      if (customer.status === "archived") {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          `Cannot create subscription for customer '${customer.company_name}': account status is archived.`
        );
      }

      // Step 3: Fetch Quotation Line Items
      const { data: quoteItems, error: itemsError } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId);

      if (itemsError || !quoteItems || quoteItems.length === 0) {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          `Quotation ${quotation.quotation_number} has no line items.`
        );
      }

      // Step 4: Identify primary plan item
      const planItem = quoteItems.find((item) => Boolean(item.plan_id)) || quoteItems[0];
      if (!planItem || !planItem.plan_id) {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          `Quotation does not include a valid plan reference.`
        );
      }

      // Step 5: Fetch Plan configuration
      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", planItem.plan_id)
        .single();

      if (planError || !plan) {
        return apiError(
          ERROR_CODES.NOT_FOUND,
          `Plan ${planItem.plan_id} associated with quotation line does not exist.`
        );
      }

      // Step 6: Compute dates and initial status
      const startDate = options?.startDate
        ? new Date(options.startDate)
        : new Date();
      const billingCycle: BillingCycle =
        options?.overrideCycle || (plan.billing_cycle as BillingCycle);
      const intervalCount = plan.billing_interval_count || 1;

      let initialStatus: "trialing" | "active" = "active";
      let trialStart: string | null = null;
      let trialEnd: string | null = null;
      const currentPeriodStart = startDate;
      let currentPeriodEnd: Date;
      let nextBillingDate: Date;

      if (plan.trial_period_days > 0) {
        initialStatus = "trialing";
        trialStart = startDate.toISOString();
        const tEnd = new Date(startDate.getTime());
        tEnd.setUTCDate(tEnd.getUTCDate() + plan.trial_period_days);
        trialEnd = tEnd.toISOString();
        currentPeriodEnd = tEnd;
        nextBillingDate = tEnd;
      } else {
        currentPeriodEnd = calculateNextBillingDate(
          startDate,
          billingCycle,
          intervalCount
        );
        nextBillingDate = currentPeriodEnd;
      }

      // Step 7: Preserve exact agreed pricing from quotation and quotation line items
      const quantity = Math.max(1, planItem.quantity || 1);
      const agreedUnitPrice = roundFinancial(Number(planItem.unit_price ?? plan.price));
      
      let subtotal: number;
      let discountAmount: number;
      let taxAmount: number;
      let totalAmount: number;

      if (Number(quotation.total_amount) > 0) {
        // Preserve exact agreed financials from quotation header
        subtotal = roundFinancial(Number(quotation.subtotal));
        discountAmount = roundFinancial(Number(quotation.discount_amount || 0));
        taxAmount = roundFinancial(Number(quotation.tax_amount || 0));
        totalAmount = roundFinancial(Number(quotation.total_amount));
      } else {
        // Fallback: sum quotation line items
        subtotal = roundFinancial(
          quoteItems.reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0)
        );
        discountAmount = roundFinancial(
          quoteItems.reduce((acc, it) => acc + Number(it.discount_amount || 0), 0)
        );
        taxAmount = roundFinancial(
          quoteItems.reduce((acc, it) => acc + Number(it.tax_amount || 0), 0)
        );
        totalAmount = roundFinancial(subtotal - discountAmount + taxAmount);
      }

      // Validate plan seat limits before creating subscription
      const seatCheck = await validatePlanSeatLimit(plan.id, quantity, supabase);
      if (!seatCheck.allowed) {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          seatCheck.error || `Quantity (${quantity}) exceeds plan seat limit.`
        );
      }

      // Generate unique subscription number with collision guard
      const subscriptionNumber = await generateUniqueSubscriptionNumber(supabase);

      // Snapshot customer information and agreed billing terms in metadata
      const customerSnapshot = {
        id: customer.id,
        company_name: customer.company_name,
        contact_name: customer.contact_name,
        email: customer.email,
        phone: customer.phone,
        business_number: customer.business_number,
        currency: quotation.currency || customer.currency || "USD",
        billing_address_line1: customer.billing_address_line1,
        billing_city: customer.billing_city,
        billing_state: customer.billing_state,
        billing_postal_code: customer.billing_postal_code,
        billing_country: customer.billing_country,
      };

      const agreedBillingTerms = {
        terms: quotation.terms || null,
        notes: options?.notes || quotation.notes || null,
        valid_until: quotation.valid_until,
        accepted_at: quotation.accepted_at,
        billing_cycle: billingCycle,
        billing_interval_count: intervalCount,
        currency: quotation.currency || plan.currency || "USD",
      };

      const nowIso = new Date().toISOString();

      // Step 8: Insert into subscriptions table with confirmed lifecycle status
      const { data: newSub, error: subInsertError } = await supabase
        .from("subscriptions")
        .insert({
          subscription_number: subscriptionNumber,
          customer_id: quotation.customer_id,
          plan_id: plan.id,
          status: initialStatus,
          billing_cycle: billingCycle,
          currency: quotation.currency || plan.currency || "USD",
          unit_price: agreedUnitPrice,
          quantity: quantity,
          subtotal: subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          trial_start: trialStart,
          trial_end: trialEnd,
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          next_billing_date: nextBillingDate.toISOString(),
          metadata: {
            converted_from_quotation_id: quotation.id,
            converted_from_quotation_number: quotation.quotation_number,
            conversion_timestamp: nowIso,
            lifecycle_status: "confirmed",
            confirmed_at: nowIso,
            status_history: [
              {
                from: "quotation",
                to: "confirmed",
                at: nowIso,
                reason: "Converted from accepted quotation",
                actorRole: "system",
              },
            ],
            agreed_terms: agreedBillingTerms,
            customer_snapshot: customerSnapshot,
          },
        })
        .select()
        .single();

      if (subInsertError || !newSub) {
        return apiError(
          ERROR_CODES.DATABASE_ERROR,
          `Failed to create subscription: ${subInsertError?.message}`
        );
      }

      // Step 9: Preserve product lines — clone quotation items into subscription_items
      const lineItemInserts = quoteItems.map((item) => ({
        subscription_id: newSub.id,
        product_id: item.product_id || plan.product_id,
        plan_id: item.plan_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: roundFinancial(Number(item.unit_price)),
        subtotal: roundFinancial(Number(item.total_amount || item.unit_price * item.quantity)),
      }));

      const { data: insertedItems } = await supabase
        .from("subscription_items")
        .insert(lineItemInserts)
        .select();

      // Step 10: Atomic CAS lock on quotation to guarantee zero duplicate conversions
      const { data: updatedQuote, error: quoteUpdateErr } = await supabase
        .from("quotations")
        .update({
          converted_subscription_id: newSub.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quotationId)
        .is("converted_subscription_id", null)
        .select()
        .maybeSingle();

      if (quoteUpdateErr || !updatedQuote) {
        // Concurrency guard: another request updated converted_subscription_id in the interim
        // Rollback inserted subscription to maintain strict integrity
        await supabase.from("subscriptions").delete().eq("id", newSub.id);
        return apiError(
          ERROR_CODES.CONFLICT,
          `Quotation ${quotation.quotation_number} was converted concurrently by another request. Duplicate conversion prevented.`
        );
      }

      // Return composite result with typed lifecycle_status
      const composite: SubscriptionWithDetails = {
        ...newSub,
        lifecycle_status: resolveLifecycleStatus(newSub.status, newSub.metadata),
        customer: customer as SubscriptionCustomer,
        plan: plan as SubscriptionPlan,
        items: (insertedItems as SubscriptionItem[]) || [],
      };

      return apiSuccess(composite);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected failure in createSubscriptionFromQuotation";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 2. getSubscriptionById
   * Retrieves full subscription details with linked customer, plan, and line items.
   */
  async getSubscriptionById(id: string): Promise<ApiResponse<SubscriptionWithDetails>> {
    try {
      const supabase = await createClient();

      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (subError || !sub) {
        return apiError(
          ERROR_CODES.NOT_FOUND,
          `Subscription ${id} was not found.`
        );
      }

      // Fetch customer
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", sub.customer_id)
        .single();

      // Fetch plan
      const { data: plan } = await supabase
        .from("plans")
        .select("*")
        .eq("id", sub.plan_id)
        .single();

      // Fetch items
      const { data: items } = await supabase
        .from("subscription_items")
        .select("*")
        .eq("subscription_id", id)
        .order("created_at", { ascending: true });

      const composite: SubscriptionWithDetails = {
        ...sub,
        lifecycle_status: resolveLifecycleStatus(sub.status, sub.metadata),
        customer: (customer as SubscriptionCustomer) || null,
        plan: (plan as SubscriptionPlan) || null,
        items: (items as SubscriptionItem[]) || [],
      };

      return apiSuccess(composite);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch subscription";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 3. getDueSubscriptions
   * Primary service for Member 4's automated recurring billing engine.
   * Finds all active subscriptions whose next_billing_date has arrived.
   */
  async getDueSubscriptions(
    options: DueSubscriptionsOptions = {}
  ): Promise<ApiResponse<SubscriptionForBilling[]>> {
    try {
      const supabase = await createClient();
      const asOf = options.asOfDate
        ? new Date(options.asOfDate)
        : new Date();
      const asOfIso = asOf.toISOString();
      const limit = Math.min(500, Math.max(1, options.limit || 50));
      const offset = Math.max(0, options.offset || 0);

      // Query active subscriptions whose billing date has arrived
      let query = supabase
        .from("subscriptions")
        .select(`
          *,
          customers (*),
          plans (*)
        `)
        .in("status", ["active", "trialing"])
        .lte("next_billing_date", asOfIso)
        .order("next_billing_date", { ascending: true })
        .range(offset, offset + limit - 1);

      if (options.currency) {
        query = query.eq("currency", options.currency);
      }

      const { data: records, error } = await query;

      if (error) {
        return apiError(
          ERROR_CODES.DATABASE_ERROR,
          `Failed to query due subscriptions: ${error.message}`
        );
      }

      if (!records || records.length === 0) {
        return apiSuccess([]);
      }

      // Filter to only eligible active subscriptions (must not be draft, quotation, paused, closed, or scheduled for cancellation at period end)
      const eligibleRecords = records.filter((r) => {
        const lifecycle = resolveLifecycleStatus(r.status, r.metadata);
        const meta = (r.metadata as Record<string, unknown>) || {};
        if (meta.cancel_at_period_end === true) {
          return false;
        }
        return lifecycle === "active" || lifecycle === "confirmed";
      });

      if (eligibleRecords.length === 0) {
        return apiSuccess([]);
      }

      // Fetch all subscription items for the batch
      const subIds = eligibleRecords.map((r) => r.id);
      const { data: allItems } = await supabase
        .from("subscription_items")
        .select("*")
        .in("subscription_id", subIds);

      const itemsBySub = new Map<string, SubscriptionItem[]>();
      (allItems || []).forEach((item) => {
        const list = itemsBySub.get(item.subscription_id) || [];
        list.push(item as SubscriptionItem);
        itemsBySub.set(item.subscription_id, list);
      });

      // Transform to SubscriptionForBilling format
      const dueList: SubscriptionForBilling[] = eligibleRecords.map((r) => {
        const cust = r.customers as unknown as SubscriptionCustomer;
        const pl = r.plans as unknown as SubscriptionPlan;
        const subItems = itemsBySub.get(r.id) || [];

        const lines: SubscriptionBillingLine[] = [
          // Primary plan line
          {
            id: `line-${r.id}-plan`,
            subscription_id: r.id,
            product_id: pl.product_id,
            plan_id: pl.id,
            description: `${pl.name} (${r.billing_cycle})`,
            quantity: r.quantity,
            unit_amount: roundFinancial(Number(r.unit_price)),
            discount_amount: roundFinancial(Number(r.discount_amount)),
            tax_rate: 0,
            tax_amount: roundFinancial(Number(r.tax_amount)),
            total_amount: roundFinancial(Number(r.total_amount)),
            is_recurring: true,
          },
          // Add-on lines
          ...subItems.map((item) => ({
            id: item.id,
            subscription_id: r.id,
            product_id: item.product_id,
            plan_id: item.plan_id || null,
            description: item.description,
            quantity: item.quantity,
            unit_amount: roundFinancial(Number(item.unit_price)),
            discount_amount: 0,
            tax_rate: 0,
            tax_amount: 0,
            total_amount: roundFinancial(Number(item.subtotal)),
            is_recurring: true,
          })),
        ];

        return {
          subscription_id: r.id,
          subscription_number: r.subscription_number,
          status: r.status,
          billing_cycle: r.billing_cycle as BillingCycle,
          currency: r.currency,
          period_start: r.current_period_start,
          period_end: r.current_period_end,
          next_billing_date: r.next_billing_date,
          customer: {
            id: cust.id,
            company_name: cust.company_name,
            contact_name: cust.contact_name,
            email: cust.email,
            business_number: cust.business_number,
            currency: cust.currency,
            billing_address_line1: cust.billing_address_line1,
            billing_city: cust.billing_city,
            billing_state: cust.billing_state,
            billing_postal_code: cust.billing_postal_code,
            billing_country: cust.billing_country,
          },
          plan: {
            id: pl.id,
            name: pl.name,
            code: pl.code,
            billing_cycle: pl.billing_cycle as BillingCycle,
            billing_interval_count: pl.billing_interval_count || 1,
            price: Number(pl.price),
          },
          totals: {
            subtotal: roundFinancial(Number(r.subtotal)),
            discount_amount: roundFinancial(Number(r.discount_amount)),
            tax_amount: roundFinancial(Number(r.tax_amount)),
            total_amount: roundFinancial(Number(r.total_amount)),
          },
          billing_lines: lines,
        };
      });

      return apiSuccess(dueList);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to query due subscriptions";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 4. getSubscriptionForBilling
   * Retrieves verified subscription payload for a single billing run.
   */
  async getSubscriptionForBilling(
    subscriptionId: string
  ): Promise<ApiResponse<SubscriptionForBilling>> {
    try {
      const detailRes = await this.getSubscriptionById(subscriptionId);
      if (!detailRes.success) {
        return detailRes as ApiResponse<SubscriptionForBilling>;
      }

      const sub = detailRes.data;
      if (!sub.customer || !sub.plan) {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          `Subscription ${subscriptionId} has missing customer or plan relationships.`
        );
      }

      const linesRes = await this.getSubscriptionBillingLines(subscriptionId);
      const lines = linesRes.success ? linesRes.data : [];

      const result: SubscriptionForBilling = {
        subscription_id: sub.id,
        subscription_number: sub.subscription_number,
        status: sub.status,
        billing_cycle: sub.billing_cycle,
        currency: sub.currency,
        period_start: sub.current_period_start,
        period_end: sub.current_period_end,
        next_billing_date: sub.next_billing_date,
        customer: {
          id: sub.customer.id,
          company_name: sub.customer.company_name,
          contact_name: sub.customer.contact_name,
          email: sub.customer.email,
          business_number: sub.customer.business_number,
          currency: sub.customer.currency,
          billing_address_line1: sub.customer.billing_address_line1,
          billing_city: sub.customer.billing_city,
          billing_state: sub.customer.billing_state,
          billing_postal_code: sub.customer.billing_postal_code,
          billing_country: sub.customer.billing_country,
        },
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          code: sub.plan.code,
          billing_cycle: sub.plan.billing_cycle,
          billing_interval_count: sub.plan.billing_interval_count || 1,
          price: sub.plan.price,
        },
        totals: {
          subtotal: sub.subtotal,
          discount_amount: sub.discount_amount,
          tax_amount: sub.tax_amount,
          total_amount: sub.total_amount,
        },
        billing_lines: lines,
      };

      return apiSuccess(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed in getSubscriptionForBilling";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 5. getSubscriptionBillingLines
   * Returns exact billing line items ready to snapshot into invoice_items.
   */
  async getSubscriptionBillingLines(
    subscriptionId: string
  ): Promise<ApiResponse<SubscriptionBillingLine[]>> {
    try {
      const supabase = await createClient();

      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select(`*, plans(*)`)
        .eq("id", subscriptionId)
        .single();

      if (subError || !sub) {
        return apiError(
          ERROR_CODES.NOT_FOUND,
          `Subscription ${subscriptionId} not found.`
        );
      }

      const plan = sub.plans as unknown as SubscriptionPlan;

      // Base line for the primary subscription plan
      const lines: SubscriptionBillingLine[] = [
        {
          id: `line-${sub.id}-base`,
          subscription_id: sub.id,
          product_id: plan.product_id,
          plan_id: plan.id,
          description: `${plan.name} (${sub.billing_cycle} tier)`,
          quantity: sub.quantity,
          unit_amount: roundFinancial(Number(sub.unit_price)),
          discount_amount: roundFinancial(Number(sub.discount_amount)),
          tax_rate: 0,
          tax_amount: roundFinancial(Number(sub.tax_amount)),
          total_amount: roundFinancial(Number(sub.total_amount)),
          is_recurring: true,
        },
      ];

      // Add-on lines from subscription_items
      const { data: addOns } = await supabase
        .from("subscription_items")
        .select("*")
        .eq("subscription_id", subscriptionId);

      if (addOns && addOns.length > 0) {
        for (const item of addOns) {
          lines.push({
            id: item.id,
            subscription_id: sub.id,
            product_id: item.product_id,
            plan_id: item.plan_id || null,
            description: item.description,
            quantity: item.quantity,
            unit_amount: roundFinancial(Number(item.unit_price)),
            discount_amount: 0,
            tax_rate: 0,
            tax_amount: 0,
            total_amount: roundFinancial(Number(item.subtotal)),
            is_recurring: true,
          });
        }
      }

      return apiSuccess(lines);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load billing lines";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 6. validateSubscriptionForBilling
   * Pre-flight checks before Member 4 generates an invoice or attempts a charge.
   */
  async validateSubscriptionForBilling(
    subscriptionId: string
  ): Promise<ApiResponse<SubscriptionBillingValidation>> {
    try {
      const supabase = await createClient();

      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select(`*, customers(*)`)
        .eq("id", subscriptionId)
        .single();

      const reasons: string[] = [];
      const warnings: string[] = [];

      if (subError || !sub) {
        return apiSuccess({
          subscription_id: subscriptionId,
          is_valid: false,
          can_proceed_to_billing: false,
          reasons: [`Subscription record ${subscriptionId} does not exist.`],
          warnings: [],
          validated_at: new Date().toISOString(),
        });
      }

      const customer = sub.customers as unknown as SubscriptionCustomer;

      // Customer Standing Check
      if (!customer) {
        reasons.push("Customer profile does not exist.");
      } else if (customer.status === "suspended") {
        reasons.push(`Customer '${customer.company_name}' is currently suspended.`);
      } else if (customer.status === "archived") {
        reasons.push(`Customer '${customer.company_name}' is archived.`);
      }

      // Domain Lifecycle Status Check
      const lifecycle = resolveLifecycleStatus(sub.status, sub.metadata);
      if (lifecycle === "draft") {
        reasons.push("Subscription is in draft status. Cannot bill until confirmed and activated.");
      } else if (lifecycle === "quotation") {
        reasons.push("Subscription is in quotation status. Awaiting customer acceptance.");
      } else if (lifecycle === "paused" || sub.status === "paused") {
        reasons.push("Subscription is currently paused. Billing is suspended.");
      } else if (lifecycle === "closed" || sub.status === "cancelled" || sub.status === "expired") {
        reasons.push("Subscription has been closed or cancelled. Cannot generate new recurring invoice.");
      }

      // Scheduled Period-End Cancellation Check
      const subMetadata = (sub.metadata as Record<string, unknown>) || {};
      if (subMetadata.cancel_at_period_end === true) {
        reasons.push(
          "Subscription is scheduled for cancellation at period end. Recurring renewal billing is suspended."
        );
      }

      // Expiry & Term Diagnostics Check
      const expiryCheck = checkSubscriptionExpiry(sub);
      if (expiryCheck.isExpired) {
        reasons.push(expiryCheck.reason || "Subscription term has expired.");
      }

      // Trial Period Check
      if (sub.status === "trialing" && sub.trial_end) {
        const trialEndDate = new Date(sub.trial_end);
        if (trialEndDate.getTime() > Date.now()) {
          reasons.push(`Subscription is still in active trial until ${sub.trial_end}.`);
        }
      }

      // Period dates sanity check
      const periodStart = new Date(sub.current_period_start);
      const periodEnd = new Date(sub.current_period_end);
      if (periodEnd.getTime() < periodStart.getTime()) {
        reasons.push("Invalid subscription periods: period_end is before period_start.");
      }

      // Financial totals sanity
      if (Number(sub.total_amount) < 0) {
        reasons.push("Negative total amount is prohibited.");
      }

      if (customer && !customer.billing_country) {
        warnings.push("Customer does not have a registered billing country code.");
      }

      const canProceed = reasons.length === 0;

      return apiSuccess({
        subscription_id: subscriptionId,
        is_valid: canProceed,
        can_proceed_to_billing: canProceed,
        reasons,
        warnings,
        validated_at: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Validation failure";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 7. calculateNextBillingDate
   * Deterministic calendar calculation supporting daily, weekly, monthly, and yearly cycles,
   * end-of-month calendar clamping, and anchor day preservation.
   */
  calculateNextBillingDate(
    currentPeriodEnd: Date | string,
    cycle: BillingCycle,
    intervalCount: number = 1,
    options?: NextBillingDateOptions
  ): Date {
    return calculateNextBillingDate(currentPeriodEnd, cycle, intervalCount, options);
  }

  /**
   * Checks subscription expiry status and trial status against a reference date
   */
  async checkSubscriptionExpiry(
    subscriptionId: string,
    asOf?: Date | string
  ): Promise<ApiResponse<SubscriptionExpiryCheckResult>> {
    try {
      const supabase = await createClient();
      const { data: sub, error } = await supabase
        .from("subscriptions")
        .select("id, status, trial_end, current_period_end, ended_at, metadata")
        .eq("id", subscriptionId)
        .single();

      if (error || !sub) {
        return apiError(ERROR_CODES.NOT_FOUND, "Subscription not found.");
      }

      const asOfDate = asOf ? new Date(asOf) : new Date();
      const result = checkSubscriptionExpiry(sub, asOfDate);
      return apiSuccess(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to check subscription expiry";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * Scans and updates expired subscriptions (e.g. cancelled past period end or fixed terms reached)
   */
  async processExpiredSubscriptions(
    asOf?: Date | string
  ): Promise<ApiResponse<{ expiredCount: number; updatedSubscriptionIds: string[] }>> {
    try {
      const supabase = await createClient();
      const asOfDate = asOf ? new Date(asOf) : new Date();
      const nowIso = asOfDate.toISOString();

      const { data: candidates, error } = await supabase
        .from("subscriptions")
        .select("id, status, trial_end, current_period_end, ended_at, metadata")
        .in("status", ["active", "trialing", "cancelled"]);

      if (error || !candidates) {
        return apiError(
          ERROR_CODES.DATABASE_ERROR,
          error?.message || "Failed to query subscriptions for expiry processing"
        );
      }

      const updatedIds: string[] = [];

      for (const sub of candidates) {
        const check = checkSubscriptionExpiry(sub, asOfDate);
        if (check.isExpired && sub.status !== "expired") {
          const existingMeta = (sub.metadata as Record<string, unknown>) || {};
          const statusHistory = (existingMeta.status_history as unknown[]) || [];

          const updatedMeta = {
            ...existingMeta,
            lifecycle_status: "closed",
            status_history: [
              ...statusHistory,
              {
                from: existingMeta.lifecycle_status || sub.status,
                to: "closed",
                at: nowIso,
                reason: check.reason || "Subscription term expired",
                actorRole: "system",
              },
            ],
          };

          const { error: updateErr } = await supabase
            .from("subscriptions")
            .update({
              status: "expired",
              ended_at: check.expiryDate?.toISOString() || nowIso,
              metadata: updatedMeta,
              updated_at: nowIso,
            })
            .eq("id", sub.id);

          if (!updateErr) {
            updatedIds.push(sub.id);
          }
        }
      }

      return apiSuccess({
        expiredCount: updatedIds.length,
        updatedSubscriptionIds: updatedIds,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to process expired subscriptions";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 8. pauseSubscription
   * Transitions status from active to paused.
   * Enforces State Machine, Plan Permissions (allow_pause, max_pause_days),
   * and preserves audit history in metadata.pause_history.
   */
  async pauseSubscription(
    subscriptionId: string,
    options?: PauseSubscriptionOptions
  ): Promise<ApiResponse<Subscription>> {
    const res = await this.transitionSubscriptionLifecycle(
      subscriptionId,
      "paused",
      {
        reason: options?.reason,
        actorRole: options?.actorRole || "user",
        actorId: options?.actorId,
        resumeScheduledAt: options?.resumeScheduledAt,
      }
    );

    if (!res.success) {
      return res as unknown as ApiResponse<Subscription>;
    }
    return apiSuccess(res.data);
  }

  /**
   * 9. resumeSubscription
   * Transitions status from paused back to active, updating billing dates.
   * Supports immediate billing reset (resumeBillingNow: true) or unspent days credit (resumeBillingNow: false).
   * Enforces State Machine and Plan Permissions.
   */
  async resumeSubscription(
    subscriptionId: string,
    options?: ResumeSubscriptionOptions
  ): Promise<ApiResponse<Subscription>> {
    const resumeBillingNow = options?.resumeBillingNow ?? true;
    const res = await this.transitionSubscriptionLifecycle(
      subscriptionId,
      "active",
      {
        reason: resumeBillingNow
          ? "Resumed with immediate billing reset"
          : "Resumed with unspent days credit",
        actorRole: options?.actorRole || "user",
        actorId: options?.actorId,
        resumeBillingNow,
      }
    );

    if (!res.success) {
      return res as unknown as ApiResponse<Subscription>;
    }
    return apiSuccess(res.data);
  }

  /**
   * 10. closeSubscription
   * Closes a subscription.
   * If options.immediately is false, delegates to submitCancellationRequest for automatic closure at period end.
   * If options.immediately is true (default), terminates immediately as early closure.
   */
  async closeSubscription(
    subscriptionId: string,
    options?: CloseSubscriptionOptions
  ): Promise<ApiResponse<Subscription>> {
    const immediately = options?.immediately ?? true;

    if (!immediately) {
      return await this.submitCancellationRequest({
        subscriptionId,
        immediately: false,
        reason: options?.reason || "Closed at period end",
        feedback: options?.feedback,
        actorRole: options?.actorRole || "user",
        actorId: options?.actorId,
      });
    }

    const res = await this.transitionSubscriptionLifecycle(
      subscriptionId,
      "closed",
      {
        reason: options?.reason || "Early closure requested",
        actorRole: options?.actorRole || "user",
        actorId: options?.actorId,
      }
    );

    if (!res.success) {
      return res as unknown as ApiResponse<Subscription>;
    }
    return apiSuccess(res.data);
  }

  /**
   * Submits a structured cancellation request (immediate early closure or scheduled at period end)
   */
  async submitCancellationRequest(
    options: SubmitCancellationRequestOptions
  ): Promise<ApiResponse<Subscription>> {
    try {
      const supabase = await createClient();
      const { subscriptionId, immediately, reason, feedback, actorRole, actorId } = options;

      const currentRes = await this.getSubscriptionById(subscriptionId);
      if (!currentRes.success) {
        return currentRes as unknown as ApiResponse<Subscription>;
      }
      const sub = currentRes.data;

      if (
        sub.lifecycle_status === "closed" ||
        sub.status === "cancelled" ||
        sub.status === "expired"
      ) {
        return apiError(
          ERROR_CODES.CONFLICT,
          "Cannot request cancellation for an already closed or expired subscription."
        );
      }

      if (immediately) {
        return await this.closeSubscription(subscriptionId, {
          immediately: true,
          reason,
          feedback,
          actorRole,
          actorId,
        });
      }

      // Schedule at current_period_end
      const nowIso = new Date().toISOString();
      const existingMeta = (sub.metadata as Record<string, unknown>) || {};
      const requestsHistory =
        (existingMeta.cancellation_requests as CancellationRequest[]) || [];

      const requestId = `cancel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const requestRecord: CancellationRequest = {
        id: requestId,
        subscription_id: subscriptionId,
        requested_at: nowIso,
        requested_by: actorId || null,
        requester_role: actorRole || "customer",
        immediately: false,
        effective_date: sub.current_period_end,
        reason,
        feedback: feedback || null,
        status: "scheduled",
      };

      const updatedMeta = {
        ...existingMeta,
        cancel_at_period_end: true,
        cancellation_type: "at_period_end",
        scheduled_cancellation: requestRecord,
        cancellation_requests: [...requestsHistory, requestRecord],
      };

      const { data: updated, error } = await supabase
        .from("subscriptions")
        .update({
          metadata: updatedMeta,
          updated_at: nowIso,
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (error || !updated) {
        return apiError(
          ERROR_CODES.DATABASE_ERROR,
          error?.message || "Failed to schedule cancellation."
        );
      }

      return apiSuccess({
        ...updated,
        lifecycle_status: resolveLifecycleStatus(updated.status, updated.metadata),
      } as Subscription);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to submit cancellation request";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * Revokes a pending period-end cancellation request before it becomes effective
   */
  async revokeCancellationRequest(
    subscriptionId: string,
    options?: RevokeCancellationRequestOptions
  ): Promise<ApiResponse<Subscription>> {
    try {
      const supabase = await createClient();
      const currentRes = await this.getSubscriptionById(subscriptionId);
      if (!currentRes.success) {
        return currentRes as unknown as ApiResponse<Subscription>;
      }
      const sub = currentRes.data;

      const existingMeta = (sub.metadata as Record<string, unknown>) || {};
      if (!existingMeta.cancel_at_period_end) {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          "This subscription does not have an active scheduled cancellation to revoke."
        );
      }

      const nowIso = new Date().toISOString();
      const requestsHistory =
        (existingMeta.cancellation_requests as CancellationRequest[]) || [];

      const updatedRequests = requestsHistory.map((req) => {
        if (req.status === "scheduled") {
          return {
            ...req,
            status: "revoked" as const,
            revoked_at: nowIso,
            revoked_by: options?.actorId || null,
            revocation_notes: options?.notes || "Revoked by user",
          };
        }
        return req;
      });

      const updatedMeta = {
        ...existingMeta,
        cancel_at_period_end: false,
        cancellation_type: null,
        scheduled_cancellation: null,
        cancellation_requests: updatedRequests,
      };

      const { data: updated, error } = await supabase
        .from("subscriptions")
        .update({
          metadata: updatedMeta,
          updated_at: nowIso,
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (error || !updated) {
        return apiError(
          ERROR_CODES.DATABASE_ERROR,
          error?.message || "Failed to revoke scheduled cancellation."
        );
      }

      return apiSuccess({
        ...updated,
        lifecycle_status: resolveLifecycleStatus(updated.status, updated.metadata),
      } as Subscription);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to revoke cancellation request";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * Scans and executes automatic closures for subscriptions reaching period end with cancel_at_period_end === true,
   * as well as fixed-term contract expirations.
   */
  async processAutomaticClosures(
    asOf?: Date | string
  ): Promise<ApiResponse<{ closedCount: number; closedSubscriptionIds: string[] }>> {
    try {
      const supabase = await createClient();
      const asOfDate = asOf ? new Date(asOf) : new Date();
      const nowIso = asOfDate.toISOString();

      const { data: candidates, error } = await supabase
        .from("subscriptions")
        .select("*")
        .in("status", ["active", "trialing", "paused"]);

      if (error || !candidates) {
        return apiError(
          ERROR_CODES.DATABASE_ERROR,
          error?.message || "Failed to query active subscriptions for automatic closure."
        );
      }

      const closedIds: string[] = [];

      for (const sub of candidates) {
        const meta = (sub.metadata as Record<string, unknown>) || {};
        const cancelAtPeriodEnd = meta.cancel_at_period_end === true;
        const periodEnd = new Date(sub.current_period_end);

        const shouldCloseAtPeriodEnd =
          cancelAtPeriodEnd && asOfDate.getTime() >= periodEnd.getTime();

        const expiresAtStr = meta.expires_at as string | undefined;
        const isFixedTermExpired =
          expiresAtStr && asOfDate.getTime() >= new Date(expiresAtStr).getTime();

        if (shouldCloseAtPeriodEnd || isFixedTermExpired) {
          const scheduled = meta.scheduled_cancellation as CancellationRequest | undefined;
          const reason =
            scheduled?.reason ||
            (isFixedTermExpired
              ? "Fixed term contract expired"
              : "Automatic closure executed at period end");

          const statusHistory = (meta.status_history as unknown[]) || [];
          const updatedHistory = [
            ...statusHistory,
            {
              from: sub.status,
              to: "closed",
              at: nowIso,
              reason,
              actorRole: "system",
            },
          ];

          const updatedRequests = (
            (meta.cancellation_requests as CancellationRequest[]) || []
          ).map((req) => {
            if (req.status === "scheduled") {
              return { ...req, status: "applied" as const };
            }
            return req;
          });

          const updatedMeta = {
            ...meta,
            lifecycle_status: "closed",
            cancel_at_period_end: false,
            scheduled_cancellation: null,
            cancellation_requests: updatedRequests,
            status_history: updatedHistory,
          };

          const effectiveEnd =
            isFixedTermExpired && expiresAtStr ? expiresAtStr : sub.current_period_end;

          const { error: updateErr } = await supabase
            .from("subscriptions")
            .update({
              status: "cancelled",
              cancelled_at: scheduled?.requested_at || nowIso,
              cancel_reason: reason,
              ended_at: effectiveEnd,
              metadata: updatedMeta,
              updated_at: nowIso,
            })
            .eq("id", sub.id);

          if (!updateErr) {
            closedIds.push(sub.id);
          }
        }
      }

      return apiSuccess({
        closedCount: closedIds.length,
        closedSubscriptionIds: closedIds,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to process automatic closures";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * Submits a plan upgrade, downgrade, or seat adjustment request
   */
  async submitPlanChangeRequest(
    options: SubmitPlanChangeRequestOptions
  ): Promise<ApiResponse<SubscriptionWithDetails>> {
    try {
      const supabase = await createClient();
      const {
        subscriptionId,
        targetPlanId,
        targetQuantity,
        targetCycle,
        immediately,
        notes,
        actorRole,
        actorId,
      } = options;

      // 1. Fetch current subscription
      const currentRes = await this.getSubscriptionById(subscriptionId);
      if (!currentRes.success) {
        return currentRes;
      }
      const sub = currentRes.data;

      if (
        sub.lifecycle_status === "closed" ||
        sub.status === "cancelled" ||
        sub.status === "expired"
      ) {
        return apiError(
          ERROR_CODES.CONFLICT,
          "Cannot modify a closed or expired subscription."
        );
      }

      // 2. Fetch target plan
      const { data: targetPlan, error: planErr } = await supabase
        .from("plans")
        .select("*")
        .eq("id", targetPlanId)
        .eq("is_active", true)
        .single();

      if (planErr || !targetPlan) {
        return apiError(
          ERROR_CODES.NOT_FOUND,
          "The requested target plan does not exist or is inactive."
        );
      }

      const requestedQuantity =
        typeof targetQuantity === "number" && targetQuantity >= 1
          ? targetQuantity
          : sub.quantity;

      // 3. Seat limit compliance check
      const seatCheck = await validatePlanSeatLimit(
        targetPlanId,
        requestedQuantity,
        supabase
      );
      if (!seatCheck.allowed) {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          seatCheck.error || `Requested quantity (${requestedQuantity}) exceeds plan limit.`
        );
      }

      // 4. Determine change type
      const oldAmount = Number(sub.total_amount);
      const newUnitPrice = roundFinancial(Number(targetPlan.price));
      const newSubtotal = roundFinancial(newUnitPrice * requestedQuantity);
      const newTotal = newSubtotal;

      let changeType: PlanChangeType = "seat_adjustment";
      if (targetPlanId !== sub.plan_id) {
        changeType = newTotal >= oldAmount ? "upgrade" : "downgrade";
      } else if (requestedQuantity !== sub.quantity) {
        changeType = requestedQuantity > sub.quantity ? "upgrade" : "downgrade";
      } else if (targetCycle && targetCycle !== sub.billing_cycle) {
        changeType = "cycle_change";
      }

      // 5. Plan governance check (approval requirement)
      const permissions = await getPlanPermissions(targetPlanId, supabase);
      const now = new Date();
      const nowIso = now.toISOString();
      const requestId = `change-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const existingMeta = (sub.metadata as Record<string, unknown>) || {};
      const planHistory = (existingMeta.plan_change_history as PlanChangeRequest[]) || [];

      if (permissions.requiresApproval && actorRole !== "admin" && actorRole !== "staff") {
        // Must hold for staff/admin approval
        const requestRecord: PlanChangeRequest = {
          id: requestId,
          subscription_id: subscriptionId,
          change_type: changeType,
          target_plan_id: targetPlanId,
          target_plan_name: targetPlan.name,
          target_quantity: requestedQuantity,
          target_billing_cycle: targetCycle || (targetPlan.billing_cycle as BillingCycle),
          target_price: newUnitPrice,
          immediately: !!immediately,
          effective_date: immediately ? nowIso : sub.current_period_end,
          requested_at: nowIso,
          requested_by: actorId || null,
          requester_role: actorRole || "customer",
          status: "pending_approval",
          notes: notes || null,
        };

        const updatedMeta = {
          ...existingMeta,
          pending_plan_change: requestRecord,
          plan_change_history: [...planHistory, requestRecord],
        };

        await supabase
          .from("subscriptions")
          .update({
            metadata: updatedMeta,
            updated_at: nowIso,
          })
          .eq("id", subscriptionId);

        return await this.getSubscriptionById(subscriptionId);
      }

      // 6. If no approval needed:
      if (immediately) {
        // Immediate application
        const requestRecord: PlanChangeRequest = {
          id: requestId,
          subscription_id: subscriptionId,
          change_type: changeType,
          target_plan_id: targetPlanId,
          target_plan_name: targetPlan.name,
          target_quantity: requestedQuantity,
          target_billing_cycle: targetCycle || (targetPlan.billing_cycle as BillingCycle),
          target_price: newUnitPrice,
          immediately: true,
          effective_date: nowIso,
          requested_at: nowIso,
          requested_by: actorId || null,
          requester_role: actorRole || "customer",
          status: "applied",
          notes: notes || null,
        };

        const updatedMeta: Record<string, unknown> = {
          ...existingMeta,
          plan_change_history: [...planHistory, requestRecord],
        };
        delete updatedMeta.scheduled_plan_change;
        delete updatedMeta.pending_plan_change;

        const cycle = targetCycle || (targetPlan.billing_cycle as BillingCycle);
        const { error: updateErr } = await supabase
          .from("subscriptions")
          .update({
            plan_id: targetPlanId,
            unit_price: newUnitPrice,
            quantity: requestedQuantity,
            subtotal: newSubtotal,
            total_amount: newTotal,
            billing_cycle: cycle,
            metadata: updatedMeta,
            updated_at: nowIso,
          })
          .eq("id", subscriptionId);

        if (updateErr) {
          return apiError(ERROR_CODES.DATABASE_ERROR, updateErr.message);
        }

        // Update primary subscription item
        await supabase
          .from("subscription_items")
          .update({
            product_id: targetPlan.product_id,
            plan_id: targetPlanId,
            description: `${targetPlan.name} (${cycle})`,
            quantity: requestedQuantity,
            unit_price: newUnitPrice,
            subtotal: newSubtotal,
            updated_at: nowIso,
          })
          .eq("subscription_id", subscriptionId)
          .eq("plan_id", sub.plan_id);

        return await this.getSubscriptionById(subscriptionId);
      } else {
        // Scheduled for next renewal at current_period_end
        const requestRecord: PlanChangeRequest = {
          id: requestId,
          subscription_id: subscriptionId,
          change_type: changeType,
          target_plan_id: targetPlanId,
          target_plan_name: targetPlan.name,
          target_quantity: requestedQuantity,
          target_billing_cycle: targetCycle || (targetPlan.billing_cycle as BillingCycle),
          target_price: newUnitPrice,
          immediately: false,
          effective_date: sub.current_period_end,
          requested_at: nowIso,
          requested_by: actorId || null,
          requester_role: actorRole || "customer",
          status: "scheduled",
          notes: notes || null,
        };

        const updatedMeta: Record<string, unknown> = {
          ...existingMeta,
          scheduled_plan_change: requestRecord,
          plan_change_history: [...planHistory, requestRecord],
        };
        delete updatedMeta.pending_plan_change;

        await supabase
          .from("subscriptions")
          .update({
            metadata: updatedMeta,
            updated_at: nowIso,
          })
          .eq("id", subscriptionId);

        return await this.getSubscriptionById(subscriptionId);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to submit plan change request";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * Revokes a pending or scheduled plan change request
   */
  async revokePlanChangeRequest(
    subscriptionId: string,
    options?: RevokePlanChangeRequestOptions
  ): Promise<ApiResponse<SubscriptionWithDetails>> {
    try {
      const supabase = await createClient();
      const currentRes = await this.getSubscriptionById(subscriptionId);
      if (!currentRes.success) return currentRes;
      const sub = currentRes.data;

      const existingMeta = (sub.metadata as Record<string, unknown>) || {};
      if (!existingMeta.scheduled_plan_change && !existingMeta.pending_plan_change) {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          "No pending or scheduled plan change request found to revoke."
        );
      }

      const nowIso = new Date().toISOString();
      const planHistory = (existingMeta.plan_change_history as PlanChangeRequest[]) || [];
      const updatedPlanHistory = planHistory.map((p) => {
        if (p.status === "scheduled" || p.status === "pending_approval") {
          return {
            ...p,
            status: "revoked" as const,
            notes: options?.notes
              ? `${p.notes ? p.notes + " | " : ""}Revoked: ${options.notes}`
              : "Revoked by user",
          };
        }
        return p;
      });

      const updatedMeta: Record<string, unknown> = {
        ...existingMeta,
        plan_change_history: updatedPlanHistory,
      };
      delete updatedMeta.scheduled_plan_change;
      delete updatedMeta.pending_plan_change;

      const { error: updateErr } = await supabase
        .from("subscriptions")
        .update({
          metadata: updatedMeta,
          updated_at: nowIso,
        })
        .eq("id", subscriptionId);

      if (updateErr) {
        return apiError(ERROR_CODES.DATABASE_ERROR, updateErr.message);
      }

      return await this.getSubscriptionById(subscriptionId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to revoke plan change request";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * Approves a plan change request that was pending administrator approval
   */
  async approvePlanChangeRequest(
    subscriptionId: string,
    options?: { notes?: string; actorId?: string }
  ): Promise<ApiResponse<SubscriptionWithDetails>> {
    try {
      const currentRes = await this.getSubscriptionById(subscriptionId);
      if (!currentRes.success) return currentRes;
      const sub = currentRes.data;

      const existingMeta = (sub.metadata as Record<string, unknown>) || {};
      const pending = existingMeta.pending_plan_change as PlanChangeRequest | undefined;
      if (!pending || pending.status !== "pending_approval") {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          "No plan change request pending approval was found on this subscription."
        );
      }

      return await this.submitPlanChangeRequest({
        subscriptionId,
        targetPlanId: pending.target_plan_id,
        targetQuantity: pending.target_quantity,
        targetCycle: pending.target_billing_cycle,
        immediately: pending.immediately,
        notes: options?.notes || "Approved by administrator",
        actorRole: "admin",
        actorId: options?.actorId,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to approve plan change request";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 11. renewSubscription
   * Advances the subscription cycle period. Called by Member 4 upon invoice payment
   * or by authorized administrators.
   * Enforces:
   * - Permission & status checks (cannot renew closed/expired/draft/quotation)
   * - Duplicate renewal prevention (idempotency key & invoice ID checks)
   * - Preserves previous subscription periods in metadata.period_history
   * - Preserves full renewal history in metadata.renew_history
   * - Preserves calendar anchor days (e.g. Jan 31 -> Feb 28 -> Mar 31)
   * - Atomic Compare-And-Swap concurrency guard on current_period_end
   */
  async renewSubscription(
    subscriptionId: string,
    options?: RenewSubscriptionOptions
  ): Promise<ApiResponse<Subscription>> {
    try {
      const supabase = await createClient();

      // Step 1: Fetch current subscription
      const { data: sub, error: fetchErr } = await supabase
        .from("subscriptions")
        .select("*, plans(*)")
        .eq("id", subscriptionId)
        .single();

      if (fetchErr || !sub) {
        return apiError(ERROR_CODES.NOT_FOUND, "Subscription not found.");
      }

      // Step 2: Permission & lifecycle standing checks
      const lifecycle = resolveLifecycleStatus(sub.status, sub.metadata);

      if (sub.status === "cancelled" || sub.status === "expired" || lifecycle === "closed") {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          `Cannot renew a subscription in terminal status '${lifecycle}'.`
        );
      }

      if (lifecycle === "draft" || lifecycle === "quotation") {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          `Cannot renew subscription in '${lifecycle}' lifecycle status. Subscription must be confirmed or active.`
        );
      }

      const existingMeta = (sub.metadata as Record<string, unknown>) || {};
      const existingRenewHistory = (existingMeta.renew_history as RenewalHistoryRecord[]) || [];
      const existingPeriodHistory = (existingMeta.period_history as PreservedSubscriptionPeriod[]) || [];

      // Step 3: Duplicate renewal prevention (Idempotency Checks)
      if (options?.idempotencyKey) {
        const duplicate = existingRenewHistory.find(
          (r) => r.idempotency_key === options.idempotencyKey
        );
        if (duplicate) {
          // Idempotent hit: return existing subscription without double-advancing period
          return apiSuccess({
            ...sub,
            lifecycle_status: resolveLifecycleStatus(sub.status, sub.metadata),
          } as Subscription);
        }
      }

      if (options?.invoiceId) {
        const duplicateInvoice = existingRenewHistory.find(
          (r) => r.invoice_id === options.invoiceId
        );
        if (duplicateInvoice) {
          // Already renewed for this invoice: return existing subscription
          return apiSuccess({
            ...sub,
            lifecycle_status: resolveLifecycleStatus(sub.status, sub.metadata),
          } as Subscription);
        }
      }

      const plan = sub.plans as unknown as SubscriptionPlan;
      const billingCycle = sub.billing_cycle as BillingCycle;
      const intervalCount = plan?.billing_interval_count || 1;

      // Step 4: Advance period while preserving anchor day
      const oldStart = sub.current_period_start;
      const oldEnd = sub.current_period_end;
      const anchorDay =
        typeof existingMeta.anchor_day === "number"
          ? existingMeta.anchor_day
          : new Date(oldStart).getUTCDate();

      const newStart = options?.advancePeriod === false ? new Date(oldStart) : new Date(oldEnd);
      const newEnd = calculateNextBillingDate(newStart, billingCycle, intervalCount, {
        anchorDay,
      });

      const now = new Date();
      const nowIso = now.toISOString();
      const renewalId = `ren-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Step 5: Archive historical period record & renewal record
      const preservedPeriod: PreservedSubscriptionPeriod = {
        period_index: existingPeriodHistory.length + 1,
        period_start: oldStart,
        period_end: oldEnd,
        archived_at: nowIso,
        subtotal: Number(sub.subtotal),
        total_amount: Number(sub.total_amount),
        currency: sub.currency,
        invoice_id: options?.invoiceId || null,
      };

      const renewalRecord: RenewalHistoryRecord = {
        renewal_id: renewalId,
        cycle_number: existingRenewHistory.length + 1,
        renewed_at: nowIso,
        previous_period_start: oldStart,
        previous_period_end: oldEnd,
        new_period_start: newStart.toISOString(),
        new_period_end: newEnd.toISOString(),
        invoice_id: options?.invoiceId || null,
        amount_paid: typeof options?.amountPaid === "number" ? roundFinancial(options.amountPaid) : null,
        idempotency_key: options?.idempotencyKey || null,
        actor_role: options?.actorRole || "system",
        actor_id: options?.actorId || null,
        notes: options?.notes || null,
      };

      const existingStatusHistory = (existingMeta.status_history as unknown[]) || [];
      const updatedMeta: Record<string, unknown> = {
        ...existingMeta,
        lifecycle_status: "active",
        anchor_day: anchorDay,
        renewal_count: existingRenewHistory.length + 1,
        last_renewed_at: nowIso,
        renew_history: [...existingRenewHistory, renewalRecord],
        period_history: [...existingPeriodHistory, preservedPeriod],
        status_history: [
          ...existingStatusHistory,
          {
            from: sub.status,
            to: "active",
            at: nowIso,
            reason: options?.notes || `Subscription renewed for cycle ${existingRenewHistory.length + 1}`,
            actorRole: options?.actorRole || "system",
            actorId: options?.actorId,
          },
        ],
      };

      // Check for scheduled plan change to apply on renewal
      const scheduledPlanChange = existingMeta.scheduled_plan_change as PlanChangeRequest | undefined;
      let newPlanId = sub.plan_id;
      let newUnitPrice = sub.unit_price;
      let newQuantity = sub.quantity;
      let newCycle = sub.billing_cycle;
      let newSubtotal = sub.subtotal;
      let newTotal = sub.total_amount;

      if (scheduledPlanChange && scheduledPlanChange.status === "scheduled") {
        newPlanId = scheduledPlanChange.target_plan_id;
        newQuantity = scheduledPlanChange.target_quantity;
        if (scheduledPlanChange.target_billing_cycle) {
          newCycle = scheduledPlanChange.target_billing_cycle;
        }
        if (typeof scheduledPlanChange.target_price === "number") {
          newUnitPrice = scheduledPlanChange.target_price;
        }
        newSubtotal = roundFinancial(Number(newUnitPrice) * newQuantity);
        newTotal = newSubtotal;

        const planHistory = (existingMeta.plan_change_history as PlanChangeRequest[]) || [];
        const updatedPlanHistory = planHistory.map((p) => {
          if (p.id === scheduledPlanChange.id) {
            return { ...p, status: "applied" as const };
          }
          return p;
        });

        updatedMeta.plan_change_history = updatedPlanHistory;
        delete updatedMeta.scheduled_plan_change;
      }

      // Step 6: Atomic Compare-And-Swap (CAS) update on current_period_end
      const { data: updated, error: updateErr } = await supabase
        .from("subscriptions")
        .update({
          status: "active", // Resets past_due to active on renewal
          plan_id: newPlanId,
          unit_price: newUnitPrice,
          quantity: newQuantity,
          billing_cycle: newCycle,
          subtotal: newSubtotal,
          total_amount: newTotal,
          current_period_start: newStart.toISOString(),
          current_period_end: newEnd.toISOString(),
          next_billing_date: newEnd.toISOString(),
          metadata: updatedMeta,
          updated_at: nowIso,
        })
        .eq("id", subscriptionId)
        .eq("current_period_end", oldEnd) // CAS concurrency condition: guarantees period wasn't modified concurrently
        .select()
        .maybeSingle();

      if (updateErr) {
        return apiError(
          ERROR_CODES.DATABASE_ERROR,
          updateErr.message || "Failed to renew subscription."
        );
      }

      if (newPlanId !== sub.plan_id) {
        await supabase
          .from("subscription_items")
          .update({
            plan_id: newPlanId,
            quantity: newQuantity,
            unit_price: newUnitPrice,
            subtotal: newSubtotal,
            updated_at: nowIso,
          })
          .eq("subscription_id", subscriptionId)
          .eq("plan_id", sub.plan_id);
      }

      if (!updated) {
        // CAS failed: another concurrent thread has modified or already renewed this subscription
        const { data: freshSub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("id", subscriptionId)
          .single();

        if (freshSub && freshSub.current_period_end !== oldEnd) {
          // Concurrent renewal succeeded; return up-to-date subscription without duplicate period advancement
          return apiSuccess({
            ...freshSub,
            lifecycle_status: resolveLifecycleStatus(freshSub.status, freshSub.metadata),
          } as Subscription);
        }

        return apiError(
          ERROR_CODES.CONFLICT,
          "Concurrent renewal detected or subscription period changed concurrently. Duplicate renewal prevented."
        );
      }

      return apiSuccess({
        ...updated,
        lifecycle_status: resolveLifecycleStatus(updated.status, updated.metadata),
      } as Subscription);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to renew subscription";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }

  /**
   * 12. transitionSubscriptionLifecycle
   * Formally transitions a subscription through its business lifecycle statuses:
   * draft -> quotation -> confirmed -> active -> paused -> closed
   * Enforces Rule 11 (Finite State Machine) and plan-specific permission rules (Plan Rules).
   */
  async transitionSubscriptionLifecycle(
    subscriptionId: string,
    targetStatus: SubscriptionLifecycleStatus,
    options?: {
      reason?: string;
      actorRole?: string;
      actorId?: string;
      resumeScheduledAt?: string;
      resumeBillingNow?: boolean;
    }
  ): Promise<ApiResponse<SubscriptionWithDetails>> {
    try {
      const supabase = await createClient();

      // Step 1: Fetch current subscription
      const currentRes = await this.getSubscriptionById(subscriptionId);
      if (!currentRes.success) {
        return currentRes;
      }

      const currentSub = currentRes.data;
      const currentLifecycle = currentSub.lifecycle_status;

      // Idempotent no-op
      if (currentLifecycle === targetStatus) {
        return apiSuccess(currentSub);
      }

      // Step 2: Enforce Finite State Machine transitions
      assertLifecycleTransition(currentLifecycle, targetStatus);

      // Step 3: Enforce Plan-Specific Permissions (plan_rules table)
      const planValidation = await validatePlanTransition({
        planId: currentSub.plan_id,
        currentStatus: currentLifecycle,
        targetStatus,
        quantity: currentSub.quantity,
        resumeScheduledAt: options?.resumeScheduledAt,
        customClient: supabase,
      });

      if (!planValidation.allowed) {
        return apiError(
          ERROR_CODES.VALIDATION_ERROR,
          planValidation.error ||
            `Transition to '${targetStatus}' rejected by plan permissions.`
        );
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const existingMeta = (currentSub.metadata as Record<string, unknown>) || {};
      const existingHistory = (existingMeta.status_history as unknown[]) || [];

      const historyEntry = {
        from: currentLifecycle,
        to: targetStatus,
        at: nowIso,
        reason: options?.reason || `Transitioned to ${targetStatus}`,
        actorRole: options?.actorRole || "system",
        actorId: options?.actorId,
      };

      const updatedMeta: Record<string, unknown> = {
        ...existingMeta,
        lifecycle_status: targetStatus,
        status_history: [...existingHistory, historyEntry],
      };

      const updatePayload: Record<string, unknown> = {
        status: mapLifecycleToDbStatus(targetStatus),
        metadata: updatedMeta,
        updated_at: nowIso,
      };

      // State-specific mutations
      if (targetStatus === "paused") {
        const pauseHistory = (existingMeta.pause_history as SubscriptionPauseRecord[]) || [];
        const pauseRecord: SubscriptionPauseRecord = {
          paused_at: nowIso,
          reason: options?.reason || "Subscription paused",
          actor_role: options?.actorRole || "user",
          actor_id: options?.actorId || null,
          resume_scheduled_at: options?.resumeScheduledAt || null,
        };
        updatedMeta.pause_history = [...pauseHistory, pauseRecord];
        updatedMeta.paused_at = nowIso;
        if (options?.resumeScheduledAt) {
          updatedMeta.resume_scheduled_at = options.resumeScheduledAt;
        }
      } else if (targetStatus === "closed") {
        updatePayload.cancelled_at = nowIso;
        updatePayload.cancel_reason = options?.reason || "Closed";
        updatePayload.ended_at = nowIso;
        updatedMeta.cancellation_type = "immediate";
      } else if (targetStatus === "active") {
        // If resuming from paused, handle billing dates and unspent credit
        if (currentLifecycle === "paused") {
          const resumeBillingNow = options?.resumeBillingNow ?? true;
          let unspentDaysRestored: number | null = null;

          if (resumeBillingNow) {
            // Immediate billing reset: restart cycle from today with anchor preservation
            const cycle = currentSub.billing_cycle;
            const intervalCount = currentSub.plan?.billing_interval_count || 1;
            const anchorDay = (existingMeta.anchor_day as number) || new Date(currentSub.current_period_start).getUTCDate();
            const newPeriodEnd = calculateNextBillingDate(now, cycle, intervalCount, { anchorDay });

            updatePayload.current_period_start = nowIso;
            updatePayload.current_period_end = newPeriodEnd.toISOString();
            updatePayload.next_billing_date = newPeriodEnd.toISOString();
          } else {
            // Unspent days credit preservation
            const pauseHistory = (existingMeta.pause_history as SubscriptionPauseRecord[]) || [];
            const lastPause = pauseHistory[pauseHistory.length - 1];
            const pausedAtStr = (existingMeta.paused_at as string) || lastPause?.paused_at;
            const pauseMs = pausedAtStr ? new Date(pausedAtStr).getTime() : now.getTime();
            const periodEndMs = new Date(currentSub.current_period_end).getTime();
            const unspentMs = Math.max(0, periodEndMs - pauseMs);

            if (unspentMs > 0) {
              const newPeriodEnd = new Date(now.getTime() + unspentMs);
              updatePayload.current_period_start = nowIso;
              updatePayload.current_period_end = newPeriodEnd.toISOString();
              updatePayload.next_billing_date = newPeriodEnd.toISOString();
              unspentDaysRestored = Math.round((unspentMs / (1000 * 60 * 60 * 24)) * 10) / 10;
            } else {
              const cycle = currentSub.billing_cycle;
              const intervalCount = currentSub.plan?.billing_interval_count || 1;
              const newPeriodEnd = calculateNextBillingDate(now, cycle, intervalCount);
              updatePayload.current_period_start = nowIso;
              updatePayload.current_period_end = newPeriodEnd.toISOString();
              updatePayload.next_billing_date = newPeriodEnd.toISOString();
            }
          }

          delete updatedMeta.paused_at;
          delete updatedMeta.resume_scheduled_at;

          const resumeHistory = (existingMeta.resume_history as SubscriptionResumeRecord[]) || [];
          const resumeRecord: SubscriptionResumeRecord = {
            resumed_at: nowIso,
            actor_role: options?.actorRole || "user",
            actor_id: options?.actorId || null,
            resume_billing_now: resumeBillingNow,
            adjusted_period_end: updatePayload.current_period_end as string,
            unspent_days_restored: unspentDaysRestored,
          };
          updatedMeta.resume_history = [...resumeHistory, resumeRecord];
        } else if (currentLifecycle === "confirmed" || currentLifecycle === "draft") {
          updatedMeta.activated_at = nowIso;
        }
      } else if (targetStatus === "confirmed") {
        updatedMeta.confirmed_at = nowIso;
      } else if (targetStatus === "quotation") {
        updatedMeta.quotation_at = nowIso;
      }

      const { data: updated, error: updateErr } = await supabase
        .from("subscriptions")
        .update(updatePayload)
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateErr || !updated) {
        return apiError(
          ERROR_CODES.DATABASE_ERROR,
          updateErr?.message || `Failed to transition subscription to ${targetStatus}`
        );
      }

      // Re-fetch composite with all details and updated lifecycle_status
      return await this.getSubscriptionById(subscriptionId);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to transition subscription to ${targetStatus}`;
      return apiError(ERROR_CODES.VALIDATION_ERROR, message);
    }
  }

  /**
   * Helper: Query subscriptions list with filters, pagination & counts
   */
  async listSubscriptions(
    filters: SubscriptionFilters = {}
  ): Promise<ApiResponse<{ subscriptions: SubscriptionWithDetails[]; totalCount: number; stats: SubscriptionStats }>> {
    try {
      const supabase = await createClient();

      let query = supabase
        .from("subscriptions")
        .select(`
          *,
          customers (*),
          plans (*)
        `, { count: "exact" });

      if (filters.status && filters.status !== "all") {
        if (
          filters.status === "draft" ||
          filters.status === "quotation" ||
          filters.status === "confirmed"
        ) {
          query = query.eq("metadata->>lifecycle_status", filters.status);
        } else if (filters.status === "paused") {
          query = query.or("status.eq.paused,metadata->>lifecycle_status.eq.paused");
        } else if (filters.status === "closed") {
          query = query.or("status.in.(cancelled,expired),metadata->>lifecycle_status.eq.closed");
        } else if (filters.status === "active") {
          query = query.eq("status", "active");
        } else {
          query = query.eq("status", filters.status);
        }
      }

      if (filters.billingCycle && filters.billingCycle !== "all") {
        query = query.eq("billing_cycle", filters.billingCycle);
      }

      if (filters.customerId) {
        query = query.eq("customer_id", filters.customerId);
      }

      if (filters.search) {
        const term = `%${filters.search}%`;
        query = query.ilike("subscription_number", term);
      }

      const page = Math.max(1, filters.page || 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize || 10));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data: rows, count, error } = await query;

      if (error) {
        return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
      }

      // Fetch all items for the page
      const subIds = (rows || []).map((r) => r.id);
      const itemsBySub = new Map<string, SubscriptionItem[]>();
      if (subIds.length > 0) {
        const { data: items } = await supabase
          .from("subscription_items")
          .select("*")
          .in("subscription_id", subIds);

        (items || []).forEach((item) => {
          const list = itemsBySub.get(item.subscription_id) || [];
          list.push(item as SubscriptionItem);
          itemsBySub.set(item.subscription_id, list);
        });
      }

      const compositeList: SubscriptionWithDetails[] = (rows || []).map((r) => ({
        ...r,
        lifecycle_status: resolveLifecycleStatus(r.status, r.metadata),
        customer: (r.customers as unknown as SubscriptionCustomer) || null,
        plan: (r.plans as unknown as SubscriptionPlan) || null,
        items: itemsBySub.get(r.id) || [],
      }));

      // Compute executive statistics
      const { data: allSubs } = await supabase
        .from("subscriptions")
        .select("status, metadata, total_amount, next_billing_date, billing_cycle");

      const stats: SubscriptionStats = {
        totalSubscriptions: allSubs?.length || 0,
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
      };

      const now = new Date();
      (allSubs || []).forEach((s) => {
        const lifecycle = resolveLifecycleStatus(s.status, s.metadata);
        if (lifecycle === "draft") stats.draftCount++;
        else if (lifecycle === "quotation") stats.quotationCount++;
        else if (lifecycle === "confirmed") stats.confirmedCount++;
        else if (lifecycle === "active") stats.activeCount++;
        else if (lifecycle === "paused") stats.pausedCount++;
        else if (lifecycle === "closed") stats.closedCount++;

        if (s.status === "trialing") stats.trialingCount++;
        if (s.status === "past_due") stats.pastDueCount++;
        if (s.status === "cancelled") stats.cancelledCount++;

        if (
          lifecycle === "active" ||
          (s.status === "active" &&
            lifecycle !== "draft" &&
            lifecycle !== "quotation" &&
            lifecycle !== "paused" &&
            lifecycle !== "closed")
        ) {
          const due = new Date(s.next_billing_date);
          if (due.getTime() <= now.getTime()) {
            stats.dueForBillingCount++;
          }

          // MRR normalization
          const total = Number(s.total_amount || 0);
          if (s.billing_cycle === "monthly") {
            stats.monthlyRecurringRevenue += total;
          } else if (s.billing_cycle === "yearly") {
            stats.monthlyRecurringRevenue += total / 12;
          } else if (s.billing_cycle === "weekly") {
            stats.monthlyRecurringRevenue += total * 4.33;
          } else if (s.billing_cycle === "daily") {
            stats.monthlyRecurringRevenue += total * 30;
          }
        }
      });

      stats.monthlyRecurringRevenue = roundFinancial(stats.monthlyRecurringRevenue);

      return apiSuccess({
        subscriptions: compositeList,
        totalCount: count || 0,
        stats,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to list subscriptions";
      return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
    }
  }
}

// Export singleton instance for direct consumption
export const subscriptionService = new SubscriptionService();
