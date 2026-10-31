"use server";

import { requireRole } from "@/modules/auth/auth-utils";
import { revalidatePath } from "next/cache";
import { invoiceService, InvoiceListResult } from "./invoice-service";
import { InvoiceFilters, InvoiceWithDetails, InvoiceStatus, Invoice } from "./types";

export interface InvoiceActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function listInvoicesAction(
  filters?: InvoiceFilters
): Promise<InvoiceActionResult<InvoiceListResult>> {
  try {
    await requireRole(["admin", "staff", "customer"]);
    const result = await invoiceService.listInvoices(filters);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load invoices",
    };
  }
}

export async function getInvoiceAction(
  invoiceId: string
): Promise<InvoiceActionResult<InvoiceWithDetails>> {
  try {
    await requireRole(["admin", "staff", "customer"]);
    const invoice = await invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }
    return { success: true, data: invoice };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load invoice",
    };
  }
}

export async function generateInvoiceFromSubscriptionAction(params: {
  subscriptionId: string;
  dueDate?: string;
  notes?: string;
}): Promise<InvoiceActionResult<{ invoiceId?: string; invoiceNumber?: string }>> {
  try {
    await requireRole(["admin", "staff"]);
    const result = await invoiceService.generateInvoiceFromSubscription(params);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    revalidatePath("/invoices");
    revalidatePath("/subscriptions");
    return {
      success: true,
      data: { invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate invoice",
    };
  }
}

export async function updateInvoiceStatusAction(
  invoiceId: string,
  status: InvoiceStatus
): Promise<InvoiceActionResult<Invoice>> {
  try {
    await requireRole(["admin", "staff"]);
    const result = await invoiceService.updateInvoiceStatus(invoiceId, status);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true, data: result.invoice };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update invoice status",
    };
  }
}
