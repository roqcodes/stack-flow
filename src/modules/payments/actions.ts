"use server";

import { requireRole } from "@/modules/auth/auth-utils";
import { revalidatePath } from "next/cache";
import { paymentService, PaymentListResult } from "./payment-service";
import { PaymentFilters, RecordPaymentInput, RefundPaymentInput } from "./types";
import { recordPaymentSchema, refundPaymentSchema } from "./validations";

export interface PaymentActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function listPaymentsAction(
  filters?: PaymentFilters
): Promise<PaymentActionResult<PaymentListResult>> {
  try {
    await requireRole(["admin", "staff", "customer"]);
    const result = await paymentService.listPayments(filters);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load payments",
    };
  }
}

export async function recordPaymentAction(
  input: RecordPaymentInput
): Promise<PaymentActionResult<{ paymentId?: string; paymentNumber?: string }>> {
  try {
    await requireRole(["admin", "staff"]);
    const validation = recordPaymentSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: "Validation error: " + validation.error.issues.map((i) => i.message).join(", "),
      };
    }

    const result = await paymentService.recordPayment(validation.data as RecordPaymentInput);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/payments");
    revalidatePath("/invoices");
    return {
      success: true,
      data: { paymentId: result.paymentId, paymentNumber: result.paymentNumber },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record payment",
    };
  }
}

export async function processRefundAction(
  input: RefundPaymentInput
): Promise<PaymentActionResult<null>> {
  try {
    await requireRole(["admin"]);
    const validation = refundPaymentSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: "Validation error: " + validation.error.issues.map((i) => i.message).join(", "),
      };
    }

    const result = await paymentService.processRefund(validation.data);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/payments");
    revalidatePath("/invoices");
    return { success: true, data: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to process refund",
    };
  }
}
