"use server";

import { requireRole } from "@/modules/auth/auth-utils";
import { financialAnalyticsService } from "./analytics-service";
import { FinancialAnalyticsData } from "./types";

export interface AnalyticsActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getFinancialOverviewAction(): Promise<AnalyticsActionResult<FinancialAnalyticsData>> {
  try {
    await requireRole(["admin", "staff"]);
    const data = await financialAnalyticsService.getFinancialOverview();
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load financial analytics",
    };
  }
}
