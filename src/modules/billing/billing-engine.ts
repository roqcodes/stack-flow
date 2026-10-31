import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/modules/subscriptions/subscription-service";
import { invoiceService } from "@/modules/invoices/invoice-service";
import { roundFinancial } from "./financial-engine";
import { BillingLog } from "./types";

export interface BillingCycleOptions {
  asOfDate?: Date | string;
  dryRun?: boolean;
  limit?: number;
}

export interface BillingCycleSummary {
  cycleRunId: string;
  startedAt: string;
  completedAt: string;
  isDryRun: boolean;
  totalDueProcessed: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  totalInvoicedAmount: number;
  generatedInvoices: {
    subscriptionId: string;
    invoiceId?: string;
    invoiceNumber?: string;
    amount: number;
    status: "success" | "failed" | "skipped";
    reason?: string;
  }[];
}

export class RecurringBillingEngine {
  /**
   * Executes an automated or admin-triggered recurring billing cycle.
   */
  async runBillingCycle(options?: BillingCycleOptions): Promise<BillingCycleSummary> {
    const startedAt = new Date().toISOString();
    const cycleRunId = `RUN-${Date.now()}`;
    const isDryRun = Boolean(options?.dryRun);

    const generatedInvoices: BillingCycleSummary["generatedInvoices"] = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    let totalInvoicedAmount = 0;

    // 1. Fetch due subscriptions from Member 3's contract
    const dueRes = await subscriptionService.getDueSubscriptions({
      asOfDate: options?.asOfDate,
      limit: options?.limit || 50,
    });

    if (!dueRes.success) {
      throw new Error(`Failed to fetch due subscriptions: ${dueRes.error.message}`);
    }

    const dueSubscriptions = dueRes.data;

    // 2. Iterate each due subscription
    for (const sub of dueSubscriptions) {
      // Pre-flight validation
      const valRes = await subscriptionService.validateSubscriptionForBilling(sub.subscription_id);
      if (!valRes.success) {
        skippedCount++;
        generatedInvoices.push({
          subscriptionId: sub.subscription_id,
          amount: sub.totals?.total_amount || 0,
          status: "skipped",
          reason: valRes.error.message || "Failed pre-flight billing validation",
        });
        continue;
      }

      if (!valRes.data.can_proceed_to_billing) {
        skippedCount++;
        generatedInvoices.push({
          subscriptionId: sub.subscription_id,
          amount: sub.totals?.total_amount || 0,
          status: "skipped",
          reason: valRes.data.reasons?.join("; ") || "Failed pre-flight billing validation",
        });
        continue;
      }

      // If dry run, simulate
      if (isDryRun) {
        successCount++;
        totalInvoicedAmount = roundFinancial(totalInvoicedAmount + sub.totals.total_amount);
        generatedInvoices.push({
          subscriptionId: sub.subscription_id,
          invoiceNumber: `SIMULATED-${sub.subscription_number}`,
          amount: sub.totals.total_amount,
          status: "success",
          reason: "Simulated dry-run pass",
        });
        continue;
      }

      // Live Billing Execution via atomic procedure
      try {
        const invRes = await invoiceService.generateInvoiceFromSubscription({
          subscriptionId: sub.subscription_id,
          notes: `Recurring cycle ${cycleRunId}`,
        });

        if (invRes.success && invRes.invoiceId) {
          successCount++;
          totalInvoicedAmount = roundFinancial(totalInvoicedAmount + sub.totals.total_amount);
          generatedInvoices.push({
            subscriptionId: sub.subscription_id,
            invoiceId: invRes.invoiceId,
            invoiceNumber: invRes.invoiceNumber,
            amount: sub.totals.total_amount,
            status: "success",
          });
        } else {
          failureCount++;
          generatedInvoices.push({
            subscriptionId: sub.subscription_id,
            amount: sub.totals.total_amount,
            status: "failed",
            reason: invRes.error || "Invoice generation failed",
          });
        }
      } catch (err: unknown) {
        failureCount++;
        generatedInvoices.push({
          subscriptionId: sub.subscription_id,
          amount: sub.totals.total_amount,
          status: "failed",
          reason: err instanceof Error ? err.message : "Unexpected runtime error during billing",
        });
      }
    }

    const completedAt = new Date().toISOString();

    // 3. Record cycle run in billing_logs
    const supabase = await createClient();
    await supabase.from("billing_logs").insert({
      action: "cycle_run",
      status: failureCount === 0 ? "success" : failureCount < successCount ? "warning" : "failure",
      message: `Billing Cycle ${cycleRunId}: ${successCount} invoiced, ${failureCount} failed, ${skippedCount} skipped ($${totalInvoicedAmount.toFixed(2)})`,
      payload: {
        cycle_run_id: cycleRunId,
        is_dry_run: isDryRun,
        total_due: dueSubscriptions.length,
        success_count: successCount,
        failure_count: failureCount,
        skipped_count: skippedCount,
        total_invoiced: totalInvoicedAmount,
      },
    });

    return {
      cycleRunId,
      startedAt,
      completedAt,
      isDryRun,
      totalDueProcessed: dueSubscriptions.length,
      successCount,
      failureCount,
      skippedCount,
      totalInvoicedAmount,
      generatedInvoices,
    };
  }

  /**
   * Retrieves audit and billing execution logs.
   */
  async getBillingLogs(limit: number = 30): Promise<BillingLog[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("billing_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load billing logs: ${error.message}`);
    }

    return (data as BillingLog[]) || [];
  }
}

export const recurringBillingEngine = new RecurringBillingEngine();
