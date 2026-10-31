import { createClient } from "@/lib/supabase/server";
import { roundFinancial, validatePaymentAllocation } from "@/modules/billing/financial-engine";
import {
  PaymentWithAllocations,
  RecordPaymentInput,
  RefundPaymentInput,
  PaymentFilters,
} from "./types";

export interface PaymentListResult {
  payments: PaymentWithAllocations[];
  totalCount: number;
  totalCollected: number;
  totalRefunded: number;
}

export class PaymentService {
  /**
   * Lists payments with customer information and invoice allocations.
   */
  async listPayments(filters?: PaymentFilters): Promise<PaymentListResult> {
    const supabase = await createClient();

    let query = supabase.from("payments").select(
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
        payment_allocations (
          id,
          allocated_amount,
          created_at,
          invoices (
            id,
            invoice_number,
            total_amount,
            amount_paid,
            amount_due,
            status
          )
        )
      `,
      { count: "exact" }
    );

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.method) {
      query = query.eq("payment_method_type", filters.method);
    }

    if (filters?.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }

    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`payment_number.ilike.${term},transaction_reference.ilike.${term}`);
    }

    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters?.pageSize || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Failed to list payments: ${error.message}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payments: PaymentWithAllocations[] = (data || []).map((row: any) => ({
      ...row,
      customer: row.customers,
      allocations: row.payment_allocations || [],
    }));

    let totalCollected = 0;
    let totalRefunded = 0;

    for (const p of payments) {
      if (p.status === "succeeded" || p.status === "partially_refunded") {
        totalCollected = roundFinancial(totalCollected + p.amount);
        totalRefunded = roundFinancial(totalRefunded + p.refunded_amount);
      }
    }

    return {
      payments,
      totalCount: count || 0,
      totalCollected,
      totalRefunded,
    };
  }

  /**
   * Records a payment and allocates it against specified invoices.
   */
  async recordPayment(
    input: RecordPaymentInput
  ): Promise<{ success: boolean; paymentId?: string; paymentNumber?: string; error?: string }> {
    const supabase = await createClient();

    const paymentAmount = roundFinancial(input.amount);
    if (paymentAmount <= 0) {
      return { success: false, error: "Payment amount must be greater than zero." };
    }

    // Generate unique payment number: PAY-YYYYMMDD-XXXXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const paymentNumber = `PAY-${datePrefix}-${randomSuffix}`;

    // Sub-channel formatting
    let reference = input.transactionReference || "";
    if (input.subChannel) {
      reference = `[${input.subChannel.toUpperCase()}] ${reference}`.trim();
    }

    // 1. Insert Payment
    const { data: payment, error: pError } = await supabase
      .from("payments")
      .insert({
        payment_number: paymentNumber,
        customer_id: input.customerId,
        amount: paymentAmount,
        currency: input.currency || "USD",
        status: "succeeded",
        payment_method_type: input.paymentMethodType,
        transaction_reference: reference || null,
        refunded_amount: 0.0,
        paid_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (pError || !payment) {
      return { success: false, error: `Failed to record payment: ${pError?.message}` };
    }

    // 2. Process Allocations if provided
    if (input.invoiceAllocations && input.invoiceAllocations.length > 0) {
      let remainingAvailable = paymentAmount;

      for (const alloc of input.invoiceAllocations) {
        // Fetch invoice
        const { data: inv, error: invError } = await supabase
          .from("invoices")
          .select("id, total_amount, amount_paid, amount_due, status")
          .eq("id", alloc.invoiceId)
          .single();

        if (invError || !inv) continue;

        const check = validatePaymentAllocation(remainingAvailable, inv.amount_due, alloc.amount);
        if (!check.isValid) {
          return { success: false, error: check.error };
        }

        const allocAmount = check.allocatedAmount;

        // Insert payment allocation
        await supabase.from("payment_allocations").insert({
          payment_id: payment.id,
          invoice_id: inv.id,
          allocated_amount: allocAmount,
        });

        // Update invoice balance
        const newPaid = roundFinancial(inv.amount_paid + allocAmount);
        const newDue = roundFinancial(Math.max(0, inv.total_amount - newPaid));
        const newStatus = newDue === 0 ? "paid" : "partially_paid";

        await supabase
          .from("invoices")
          .update({
            amount_paid: newPaid,
            amount_due: newDue,
            status: newStatus,
            paid_at: newDue === 0 ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);

        remainingAvailable = roundFinancial(remainingAvailable - allocAmount);
      }
    }

    return {
      success: true,
      paymentId: payment.id,
      paymentNumber: payment.payment_number,
    };
  }

  /**
   * Processes a full or partial refund for a settled payment.
   */
  async processRefund(
    input: RefundPaymentInput
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const refundAmount = roundFinancial(input.amount);

    if (refundAmount <= 0) {
      return { success: false, error: "Refund amount must be greater than zero." };
    }

    // 1. Fetch Payment
    const { data: payment, error: pError } = await supabase
      .from("payments")
      .select("*, payment_allocations(*)")
      .eq("id", input.paymentId)
      .single();

    if (pError || !payment) {
      return { success: false, error: "Payment not found." };
    }

    const maxRefundable = roundFinancial(payment.amount - payment.refunded_amount);
    if (refundAmount > maxRefundable) {
      return {
        success: false,
        error: `Requested refund ($${refundAmount.toFixed(2)}) exceeds maximum refundable amount ($${maxRefundable.toFixed(2)}).`,
      };
    }

    const newRefunded = roundFinancial(payment.refunded_amount + refundAmount);
    const newStatus = newRefunded >= payment.amount ? "refunded" : "partially_refunded";

    // 2. Update Payment
    await supabase
      .from("payments")
      .update({
        refunded_amount: newRefunded,
        status: newStatus,
        failure_reason: input.reason || "Customer refund processed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // 3. Re-open invoice balances if allocated
    if (payment.payment_allocations && payment.payment_allocations.length > 0) {
      let remainingRefundToReconcile = refundAmount;

      for (const alloc of payment.payment_allocations) {
        if (remainingRefundToReconcile <= 0) break;

        const { data: inv } = await supabase
          .from("invoices")
          .select("id, total_amount, amount_paid, amount_due")
          .eq("id", alloc.invoice_id)
          .single();

        if (!inv) continue;

        const amountToDeduct = Math.min(remainingRefundToReconcile, alloc.allocated_amount);
        const restoredPaid = roundFinancial(Math.max(0, inv.amount_paid - amountToDeduct));
        const restoredDue = roundFinancial(Math.max(0, inv.total_amount - restoredPaid));
        const restoredStatus = restoredDue === inv.total_amount ? "issued" : "partially_paid";

        await supabase
          .from("invoices")
          .update({
            amount_paid: restoredPaid,
            amount_due: restoredDue,
            status: restoredStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);

        remainingRefundToReconcile = roundFinancial(remainingRefundToReconcile - amountToDeduct);
      }
    }

    return { success: true };
  }
}

export const paymentService = new PaymentService();
