import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/modules/subscriptions/subscription-service";
import { calculateInvoiceTotals, roundFinancial } from "@/modules/billing/financial-engine";
import {
  Invoice,
  InvoiceWithDetails,
  InvoiceFilters,
  GenerateInvoiceFromSubscriptionParams,
  InvoiceStatus,
} from "./types";

export interface InvoiceListResult {
  invoices: InvoiceWithDetails[];
  totalCount: number;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
}

export class InvoiceService {
  /**
   * Retrieves paginated invoices with customer data, items, and allocations.
   */
  async listInvoices(filters?: InvoiceFilters): Promise<InvoiceListResult> {
    const supabase = await createClient();

    let query = supabase.from("invoices").select(
      `
        *,
        customers (
          id,
          company_name,
          contact_name,
          email,
          currency,
          status
        ),
        invoice_items (
          id,
          invoice_id,
          product_id,
          plan_id,
          description,
          quantity,
          unit_amount,
          discount_amount,
          tax_rate,
          tax_amount,
          total_amount,
          created_at
        ),
        payment_allocations (
          id,
          allocated_amount,
          created_at,
          payments (
            id,
            payment_number,
            payment_method_type,
            paid_at
          )
        )
      `,
      { count: "exact" }
    );

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }

    if (filters?.subscriptionId) {
      query = query.eq("subscription_id", filters.subscriptionId);
    }

    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`invoice_number.ilike.${term}`);
    }

    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters?.pageSize || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Failed to list invoices: ${error.message}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoices: InvoiceWithDetails[] = (data || []).map((row: any) => ({
      ...row,
      customer: row.customers,
      items: row.invoice_items || [],
      payment_allocations: row.payment_allocations || [],
    }));

    // Calculate aggregated metrics
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    for (const inv of invoices) {
      if (inv.status !== "void") {
        totalInvoiced = roundFinancial(totalInvoiced + inv.total_amount);
        totalCollected = roundFinancial(totalCollected + inv.amount_paid);
        totalOutstanding = roundFinancial(totalOutstanding + inv.amount_due);
      }
    }

    return {
      invoices,
      totalCount: count || 0,
      totalInvoiced,
      totalCollected,
      totalOutstanding,
    };
  }

  /**
   * Retrieves a single invoice with all items and customer snapshot.
   */
  async getInvoiceById(invoiceId: string): Promise<InvoiceWithDetails | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        customers (
          id,
          company_name,
          contact_name,
          email,
          currency,
          billing_address_line1,
          billing_city,
          billing_state,
          billing_postal_code,
          billing_country,
          status
        ),
        invoice_items (
          id,
          invoice_id,
          product_id,
          plan_id,
          description,
          quantity,
          unit_amount,
          discount_amount,
          tax_rate,
          tax_amount,
          total_amount,
          created_at
        ),
        payment_allocations (
          id,
          allocated_amount,
          created_at,
          payments (
            id,
            payment_number,
            payment_method_type,
            paid_at
          )
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      customer: data.customers,
      items: data.invoice_items || [],
      payment_allocations: data.payment_allocations || [],
    };
  }

  /**
   * Generates an invoice from Member 3's subscription billing contract.
   * Atomically executes via PostgreSQL stored procedure.
   */
  async generateInvoiceFromSubscription(
    params: GenerateInvoiceFromSubscriptionParams
  ): Promise<{ success: boolean; invoiceId?: string; invoiceNumber?: string; error?: string }> {
    const { subscriptionId, dueDate, notes } = params;

    // 1. Fetch verified billing payload from Member 3's subscription service
    const subRes = await subscriptionService.getSubscriptionForBilling(subscriptionId);
    if (!subRes.success) {
      return {
        success: false,
        error: subRes.error.message || "Failed to retrieve subscription for billing",
      };
    }

    const sub = subRes.data;

    // 2. Map billing lines into decimal-safe calculation engine
    const lines = sub.billing_lines.map((l) => ({
      productId: l.product_id,
      planId: l.plan_id || null,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unit_amount,
      discountAmount: l.discount_amount,
      taxRate: l.tax_rate,
      taxAmount: l.tax_amount,
      totalAmount: l.total_amount,
    }));

    const calculatedTotals = calculateInvoiceTotals({
      lines: lines.map((l) => ({
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        discountAmount: l.discountAmount,
        taxRate: l.taxRate,
      })),
    });

    const supabase = await createClient();

    // 3. Execute atomic PostgreSQL billing procedure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
      "execute_atomic_subscription_billing",
      {
        p_subscription_id: subscriptionId,
        p_period_start: sub.period_start,
        p_period_end: sub.period_end,
        p_due_date: dueDate || null,
        p_currency: sub.currency,
        p_subtotal: calculatedTotals.subtotal,
        p_discount_amount: calculatedTotals.totalDiscount,
        p_tax_amount: calculatedTotals.totalTax,
        p_total_amount: calculatedTotals.totalAmount,
        p_line_items: lines.map((l) => ({
          product_id: l.productId,
          plan_id: l.planId,
          description: l.description,
          quantity: l.quantity,
          unit_amount: l.unitPrice,
          discount_amount: l.discountAmount,
          tax_rate: l.taxRate,
          tax_amount: l.taxAmount,
          total_amount: l.totalAmount,
        })),
        p_notes: notes || `Automated recurring cycle for subscription ${sub.subscription_number}`,
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    return {
      success: true,
      invoiceId: rpcResult?.invoice_id,
      invoiceNumber: rpcResult?.invoice_number,
    };
  }

  /**
   * Updates an invoice status (e.g. void, uncollectible, issued)
   */
  async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus
  ): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("invoices")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, invoice: data as Invoice };
  }
}

export const invoiceService = new InvoiceService();
