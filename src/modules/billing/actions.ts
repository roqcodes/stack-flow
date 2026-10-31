"use server";

import { requireRole } from "@/modules/auth/auth-utils";
import { revalidatePath } from "next/cache";
import { recurringBillingEngine, BillingCycleOptions, BillingCycleSummary } from "./billing-engine";
import { BillingLog } from "./types";

export interface BillingActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function triggerBillingCycleAction(
  options?: BillingCycleOptions
): Promise<BillingActionResult<BillingCycleSummary>> {
  try {
    await requireRole(["admin"]);
    const summary = await recurringBillingEngine.runBillingCycle(options);
    revalidatePath("/billing");
    revalidatePath("/invoices");
    revalidatePath("/subscriptions");
    return { success: true, data: summary };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to execute billing cycle",
    };
  }
}

export async function getBillingLogsAction(
  limit: number = 50
): Promise<BillingActionResult<BillingLog[]>> {
  try {
    await requireRole(["admin"]);
    const logs = await recurringBillingEngine.getBillingLogs(limit);
    return { success: true, data: logs };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load billing logs",
    };
  }
}
