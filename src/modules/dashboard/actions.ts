"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/modules/auth/auth-utils";
import {
  apiSuccess,
  apiError,
  ApiResponse,
  ERROR_CODES,
} from "@/lib/api-response";

export interface OperationalOverview {
  customers: { total: number; active: number };
  products: { total: number; active: number };
  quotations: {
    draft: number;
    sent: number;
    accepted: number;
    expired: number;
  };
  subscriptions: { active: number; trialing: number; past_due: number };
  invoices: { open: number; overdue: number };
  recentQuotations: Array<{
    id: string;
    quotation_number: string;
    status: string;
    total_amount: number;
    currency: string;
    valid_until: string;
    company_name: string | null;
  }>;
  derived: {
    customerActivePct: number;
    quotationAcceptancePct: number;
    invoiceOverduePct: number;
    subscriptionHealthPct: number;
  };
  quotationPipeline: Array<{ name: string; value: number; color: string }>;
  subscriptionMix: Array<{ name: string; value: number; color: string }>;
}

export async function getOperationalOverviewAction(): Promise<
  ApiResponse<OperationalOverview>
> {
  try {
    const { profile } = await requireRole(["admin", "staff"]);
    void profile;

    const supabase = await createClient();

    const [
      customersTotal,
      customersActive,
      productsTotal,
      productsActive,
      qDraft,
      qSent,
      qAccepted,
      qExpired,
      subActive,
      subTrial,
      subPastDue,
      invOpen,
      invOverdue,
      recentRes,
    ] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("status", "active"),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("status", "active"),
      supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent"),
      supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .eq("status", "accepted"),
      supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .eq("status", "expired"),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "trialing"),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "past_due"),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .in("status", ["issued", "partially_paid"]),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .in("status", ["issued", "partially_paid"])
        .lt("due_date", new Date().toISOString().slice(0, 10)),
      supabase
        .from("quotations")
        .select(
          `
          id, quotation_number, status, total_amount, currency, valid_until,
          customer:customers(company_name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const recentQuotations = (recentRes.data ?? []).map((row) => ({
      id: row.id as string,
      quotation_number: row.quotation_number as string,
      status: row.status as string,
      total_amount: Number(row.total_amount),
      currency: row.currency as string,
      valid_until: row.valid_until as string,
      company_name:
        (row.customer as { company_name?: string } | null)?.company_name ?? null,
    }));

    const customersTotalCount = customersTotal.count ?? 0;
    const customersActiveCount = customersActive.count ?? 0;
    const qDraftCount = qDraft.count ?? 0;
    const qSentCount = qSent.count ?? 0;
    const qAcceptedCount = qAccepted.count ?? 0;
    const qExpiredCount = qExpired.count ?? 0;
    const qTotal = qDraftCount + qSentCount + qAcceptedCount + qExpiredCount;
    const subActiveCount = subActive.count ?? 0;
    const subTrialCount = subTrial.count ?? 0;
    const subPastDueCount = subPastDue.count ?? 0;
    const subTotal = subActiveCount + subTrialCount + subPastDueCount;
    const invOpenCount = invOpen.count ?? 0;
    const invOverdueCount = invOverdue.count ?? 0;

    return apiSuccess({
      customers: {
        total: customersTotalCount,
        active: customersActiveCount,
      },
      products: {
        total: productsTotal.count ?? 0,
        active: productsActive.count ?? 0,
      },
      quotations: {
        draft: qDraftCount,
        sent: qSentCount,
        accepted: qAcceptedCount,
        expired: qExpiredCount,
      },
      subscriptions: {
        active: subActiveCount,
        trialing: subTrialCount,
        past_due: subPastDueCount,
      },
      invoices: {
        open: invOpenCount,
        overdue: invOverdueCount,
      },
      recentQuotations,
      derived: {
        customerActivePct: customersTotalCount
          ? Math.round((customersActiveCount / customersTotalCount) * 100)
          : 0,
        quotationAcceptancePct: qTotal
          ? Math.round((qAcceptedCount / qTotal) * 100)
          : 0,
        invoiceOverduePct: invOpenCount
          ? Math.round((invOverdueCount / invOpenCount) * 100)
          : 0,
        subscriptionHealthPct: subTotal
          ? Math.round((subActiveCount / subTotal) * 100)
          : 0,
      },
      quotationPipeline: [
        { name: "Draft", value: qDraftCount, color: "#64748b" },
        { name: "Sent", value: qSentCount, color: "#2563eb" },
        { name: "Accepted", value: qAcceptedCount, color: "#059669" },
        { name: "Expired", value: qExpiredCount, color: "#d97706" },
      ],
      subscriptionMix: [
        { name: "Active", value: subActiveCount, color: "#2563eb" },
        { name: "Trialing", value: subTrialCount, color: "#7c3aed" },
        { name: "Past due", value: subPastDueCount, color: "#dc2626" },
      ],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
