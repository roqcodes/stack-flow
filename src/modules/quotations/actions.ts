"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireRole } from "@/modules/auth/auth-utils";
import {
  apiSuccess,
  apiError,
  ApiResponse,
  ERROR_CODES,
} from "@/lib/api-response";
import {
  createQuotationTemplateSchema,
  updateQuotationTemplateSchema,
  createQuotationTemplateItemSchema,
  createQuotationSchema,
  updateQuotationSchema,
  quotationFilterSchema,
  CreateQuotationTemplateInput,
  UpdateQuotationTemplateInput,
  CreateQuotationTemplateItemInput,
  CreateQuotationInput,
  UpdateQuotationInput,
  QuotationFilterInput,
} from "./validations";
import {
  Quotation,
  QuotationItem,
  QuotationTemplate,
  QuotationTemplateItem,
  QuotationWithItems,
  QuotationTemplateWithItems,
} from "./types";
import { PaginatedResult } from "@/modules/products/actions";
import { buildQuotationPdf } from "./generate-pdf";

export type {
  QuotationWithItems,
  QuotationTemplateWithItems,
  QuotationCustomerSnapshot,
} from "./types";

// ─── Server-side financial computation ────────────────────────────────────────

interface ComputedTotals {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

/**
 * Computes quotation totals server-side. Never trusts client-supplied totals.
 * All arithmetic uses Number with rounding to 2 decimals to match NUMERIC(14,2).
 */
function computeQuotationTotals(
  items: Array<{
    quantity: number;
    unit_price: number;
    discount_amount: number;
    tax_rate: number;
  }>
): ComputedTotals {
  let subtotal = 0;
  let discount_amount = 0;
  let tax_amount = 0;

  for (const item of items) {
    const lineSubtotal = Math.round(item.quantity * item.unit_price * 100) / 100;
    const lineDiscount = Math.round(item.discount_amount * 100) / 100;
    const taxableAmount = Math.round((lineSubtotal - lineDiscount) * 100) / 100;
    const lineTax = Math.round(taxableAmount * (item.tax_rate / 100) * 100) / 100;

    subtotal += lineSubtotal;
    discount_amount += lineDiscount;
    tax_amount += lineTax;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  discount_amount = Math.round(discount_amount * 100) / 100;
  tax_amount = Math.round(tax_amount * 100) / 100;
  const total_amount =
    Math.round((subtotal - discount_amount + tax_amount) * 100) / 100;

  return { subtotal, discount_amount, tax_amount, total_amount };
}

/**
 * Computes line item total server-side.
 */
function computeItemTotal(
  quantity: number,
  unit_price: number,
  discount_amount: number,
  tax_rate: number
): { tax_amount: number; total_amount: number } {
  const lineSubtotal = Math.round(quantity * unit_price * 100) / 100;
  const lineDiscount = Math.round(discount_amount * 100) / 100;
  const taxableAmount = Math.round((lineSubtotal - lineDiscount) * 100) / 100;
  const tax_amount = Math.round(taxableAmount * (tax_rate / 100) * 100) / 100;
  const total_amount = Math.round((taxableAmount + tax_amount) * 100) / 100;
  return { tax_amount, total_amount };
}

/**
 * Generates a quotation number: QT-YYYY-NNNNNN
 */
function generateQuotationNumber(sequence: number): string {
  const year = new Date().getFullYear();
  const paddedSeq = String(sequence).padStart(6, "0");
  return `QT-${year}-${paddedSeq}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTATION TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LIST quotation templates.
 */
export async function listQuotationTemplatesAction(): Promise<
  ApiResponse<QuotationTemplate[]>
> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotation_templates")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess((data ?? []) as QuotationTemplate[]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * GET a template with its line items (joined with product and plan details).
 */
export async function getQuotationTemplateAction(
  templateId: string
): Promise<ApiResponse<QuotationTemplateWithItems>> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();

    const [templateRes, itemsRes] = await Promise.all([
      supabase
        .from("quotation_templates")
        .select("*")
        .eq("id", templateId)
        .single(),
      supabase
        .from("quotation_template_items")
        .select(
          `
          *,
          product:products(id, name, code),
          plan:plans(id, name, billing_cycle, price)
        `
        )
        .eq("template_id", templateId),
    ]);

    if (templateRes.error || !templateRes.data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Template not found");
    }

    return apiSuccess({
      ...(templateRes.data as QuotationTemplate),
      items: (itemsRes.data ?? []) as QuotationTemplateWithItems["items"],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * CREATE a quotation template.
 */
export async function createQuotationTemplateAction(
  input: CreateQuotationTemplateInput
): Promise<ApiResponse<QuotationTemplate>> {
  try {
    await requirePermission("quotations:manage");

    const validation = createQuotationTemplateSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotation_templates")
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as QuotationTemplate);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * UPDATE a quotation template.
 */
export async function updateQuotationTemplateAction(
  templateId: string,
  input: UpdateQuotationTemplateInput
): Promise<ApiResponse<QuotationTemplate>> {
  try {
    await requirePermission("quotations:manage");

    const validation = updateQuotationTemplateSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotation_templates")
      .update(validation.data)
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Template not found");
    }

    return apiSuccess(data as QuotationTemplate);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * ADD an item to a quotation template.
 */
export async function addTemplateItemAction(
  input: CreateQuotationTemplateItemInput
): Promise<ApiResponse<QuotationTemplateItem>> {
  try {
    await requirePermission("quotations:manage");

    const validation = createQuotationTemplateItemSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotation_template_items")
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as QuotationTemplateItem);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * REMOVE an item from a quotation template.
 */
export async function removeTemplateItemAction(
  templateItemId: string
): Promise<ApiResponse<{ deleted: true }>> {
  try {
    await requirePermission("quotations:manage");

    const supabase = await createClient();
    const { error } = await supabase
      .from("quotation_template_items")
      .delete()
      .eq("id", templateItemId);

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LIST quotations with search, status filter, pagination.
 */
export async function listQuotationsAction(
  filters?: Partial<QuotationFilterInput>
): Promise<ApiResponse<PaginatedResult<QuotationWithItems>>> {
  try {
    await requireRole(["admin", "staff"]);

    const parsed = quotationFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid filter parameters",
        parsed.error.flatten().fieldErrors
      );
    }

    const { search, status, customer_id, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const supabase = await createClient();
    let query = supabase
      .from("quotations")
      .select(
        `*, customer:customers(id, company_name, contact_name, email, currency)`,
        { count: "exact" }
      );

    if (search) {
      query = query.or(`quotation_number.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (customer_id) {
      query = query.eq("customer_id", customer_id);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess({
      items: (data ?? []) as QuotationWithItems[],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * GET a single quotation with its items and customer details.
 * Public contract for Member 3: retrieving accepted quotation details.
 */
export async function getQuotationAction(
  quotationId: string
): Promise<ApiResponse<QuotationWithItems>> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();

    const [quotationRes, itemsRes] = await Promise.all([
      supabase
        .from("quotations")
        .select(
          `
          *,
          customer:customers(
            id, company_name, contact_name, email, currency,
            billing_address_line1, billing_address_line2,
            billing_city, billing_state, billing_postal_code, billing_country
          )
        `
        )
        .eq("id", quotationId)
        .single(),
      supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId)
        .order("created_at", { ascending: true }),
    ]);

    if (quotationRes.error || !quotationRes.data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Quotation not found");
    }

    return apiSuccess({
      ...(quotationRes.data as Quotation & {
        customer: QuotationWithItems["customer"];
      }),
      items: (itemsRes.data ?? []) as QuotationItem[],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * CREATE a quotation with server-side financial computation.
 * Prices, tax amounts and totals are never trusted from the client.
 */
export async function createQuotationAction(
  input: CreateQuotationInput
): Promise<ApiResponse<QuotationWithItems>> {
  try {
    await requirePermission("quotations:manage");

    const validation = createQuotationSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const { customer_id, template_id, currency, valid_until, notes, terms, line_items } =
      validation.data;

    // Server-side total computation
    const totals = computeQuotationTotals(line_items);

    const supabase = await createClient();

    // Generate unique quotation number using count-based sequence
    const { count: totalQuotations } = await supabase
      .from("quotations")
      .select("id", { count: "exact", head: true });

    const quotationNumber = generateQuotationNumber((totalQuotations ?? 0) + 1);

    // Insert quotation
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .insert({
        quotation_number: quotationNumber,
        customer_id,
        template_id: template_id ?? null,
        currency,
        valid_until,
        notes: notes ?? null,
        terms: terms ?? null,
        status: "draft",
        ...totals,
      })
      .select()
      .single();

    if (quotationError) {
      return apiError(ERROR_CODES.DATABASE_ERROR, quotationError.message);
    }

    // Insert line items with server-computed tax/total per line
    const itemsToInsert = line_items.map((item) => {
      const computed = computeItemTotal(
        item.quantity,
        item.unit_price,
        item.discount_amount,
        item.tax_rate
      );
      return {
        quotation_id: quotation.id,
        product_id: item.product_id ?? null,
        plan_id: item.plan_id ?? null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_rate: item.tax_rate,
        tax_amount: computed.tax_amount,
        total_amount: computed.total_amount,
      };
    });

    const { data: items, error: itemsError } = await supabase
      .from("quotation_items")
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      return apiError(ERROR_CODES.DATABASE_ERROR, itemsError.message);
    }

    return apiSuccess({
      ...(quotation as Quotation),
      items: (items ?? []) as QuotationItem[],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * UPDATE a quotation (only allowed in draft status).
 * Recomputes all financials server-side after update.
 */
export async function updateQuotationAction(
  quotationId: string,
  input: UpdateQuotationInput
): Promise<ApiResponse<QuotationWithItems>> {
  try {
    await requirePermission("quotations:manage");

    const validation = updateQuotationSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();

    // Guard: only draft quotations may be modified
    const { data: existing, error: fetchError } = await supabase
      .from("quotations")
      .select("id, status")
      .eq("id", quotationId)
      .single();

    if (fetchError || !existing) {
      return apiError(ERROR_CODES.NOT_FOUND, "Quotation not found");
    }

    if (existing.status !== "draft") {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        "Only draft quotations can be edited"
      );
    }

    const { currency, valid_until, notes, terms, line_items } = validation.data;

    // If line items provided — delete old and reinsert with recomputed totals
    if (line_items && line_items.length > 0) {
      const totals = computeQuotationTotals(line_items);

      const { error: deleteError } = await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", quotationId);

      if (deleteError) {
        return apiError(ERROR_CODES.DATABASE_ERROR, deleteError.message);
      }

      const itemsToInsert = line_items.map((item) => {
        const computed = computeItemTotal(
          item.quantity,
          item.unit_price,
          item.discount_amount,
          item.tax_rate
        );
        return {
          quotation_id: quotationId,
          product_id: item.product_id ?? null,
          plan_id: item.plan_id ?? null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          tax_rate: item.tax_rate,
          tax_amount: computed.tax_amount,
          total_amount: computed.total_amount,
        };
      });

      const { error: insertError } = await supabase
        .from("quotation_items")
        .insert(itemsToInsert);

      if (insertError) {
        return apiError(ERROR_CODES.DATABASE_ERROR, insertError.message);
      }

      const { data: updatedQuotation, error: updateError } = await supabase
        .from("quotations")
        .update({
          ...(currency ? { currency } : {}),
          ...(valid_until ? { valid_until } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(terms !== undefined ? { terms } : {}),
          ...totals,
        })
        .eq("id", quotationId)
        .select()
        .single();

      if (updateError) {
        return apiError(ERROR_CODES.DATABASE_ERROR, updateError.message);
      }

      const { data: newItems } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId);

      return apiSuccess({
        ...(updatedQuotation as Quotation),
        items: (newItems ?? []) as QuotationItem[],
      });
    }

    // No line item changes — update header fields only
    const { data: updatedQuotation, error: updateError } = await supabase
      .from("quotations")
      .update({
        ...(currency ? { currency } : {}),
        ...(valid_until ? { valid_until } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(terms !== undefined ? { terms } : {}),
      })
      .eq("id", quotationId)
      .select()
      .single();

    if (updateError) {
      return apiError(ERROR_CODES.DATABASE_ERROR, updateError.message);
    }

    const { data: existingItems } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId);

    return apiSuccess({
      ...(updatedQuotation as Quotation),
      items: (existingItems ?? []) as QuotationItem[],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * SEND a quotation (draft → sent).
 */
export async function sendQuotationAction(
  quotationId: string
): Promise<ApiResponse<Quotation>> {
  try {
    await requirePermission("quotations:manage");

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("quotations")
      .select("status")
      .eq("id", quotationId)
      .single();

    if (!existing || existing.status !== "draft") {
      return apiError(ERROR_CODES.FORBIDDEN, "Only draft quotations can be sent");
    }

    const { data, error } = await supabase
      .from("quotations")
      .update({ status: "sent" })
      .eq("id", quotationId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as Quotation);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * ACCEPT a quotation (sent → accepted).
 * Stamps accepted_at timestamp. Snapshot of items is preserved in quotation_items.
 * Public contract for Member 3: acceptQuotation
 */
export async function acceptQuotationAction(
  quotationId: string
): Promise<ApiResponse<QuotationWithItems>> {
  try {
    await requirePermission("quotations:manage");

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("quotations")
      .select("status, valid_until")
      .eq("id", quotationId)
      .single();

    if (!existing) {
      return apiError(ERROR_CODES.NOT_FOUND, "Quotation not found");
    }

    if (existing.status !== "sent") {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        "Only sent quotations can be accepted"
      );
    }

    // Check expiry
    if (new Date(existing.valid_until) < new Date()) {
      return apiError(ERROR_CODES.FORBIDDEN, "This quotation has expired");
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("quotations")
      .update({ status: "accepted", accepted_at: now })
      .eq("id", quotationId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId);

    return apiSuccess({
      ...(data as Quotation),
      items: (items ?? []) as QuotationItem[],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * REJECT a quotation.
 */
export async function rejectQuotationAction(
  quotationId: string
): Promise<ApiResponse<Quotation>> {
  try {
    await requirePermission("quotations:manage");

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("quotations")
      .select("status")
      .eq("id", quotationId)
      .single();

    if (!existing || !["draft", "sent"].includes(existing.status)) {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        "Only draft or sent quotations can be rejected"
      );
    }

    const { data, error } = await supabase
      .from("quotations")
      .update({ status: "rejected" })
      .eq("id", quotationId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as Quotation);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * GET an accepted quotation with its full snapshot.
 * Public contract for Member 3: retrieveAcceptedQuotationDetails
 */
export async function getAcceptedQuotationAction(
  quotationId: string
): Promise<ApiResponse<QuotationWithItems>> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();

    const [quotationRes, itemsRes] = await Promise.all([
      supabase
        .from("quotations")
        .select(
          `
          *,
          customer:customers(
            id, company_name, contact_name, email, currency,
            billing_address_line1, billing_address_line2,
            billing_city, billing_state, billing_postal_code, billing_country
          )
        `
        )
        .eq("id", quotationId)
        .eq("status", "accepted")
        .single(),
      supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId)
        .order("created_at", { ascending: true }),
    ]);

    if (quotationRes.error || !quotationRes.data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Accepted quotation not found");
    }

    return apiSuccess({
      ...(quotationRes.data as Quotation & {
        customer: QuotationWithItems["customer"];
      }),
      items: (itemsRes.data ?? []) as QuotationItem[],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Generates PDF bytes for a quotation using the persisted snapshot.
 */
export async function generateQuotationPdfAction(
  quotationId: string
): Promise<ApiResponse<{ filename: string; pdf_base64: string }>> {
  try {
    await requireRole(["admin", "staff"]);

    const quotationResult = await getQuotationAction(quotationId);
    if (!quotationResult.success) {
      return quotationResult as ApiResponse<{ filename: string; pdf_base64: string }>;
    }

    const pdfBytes = await buildQuotationPdf(quotationResult.data);
    const filename = `${quotationResult.data.quotation_number}.pdf`;

    return apiSuccess({
      filename,
      pdf_base64: Buffer.from(pdfBytes).toString("base64"),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * Emails a quotation PDF to the customer contact.
 * Requires RESEND_API_KEY and optional QUOTATION_EMAIL_FROM.
 */
export async function sendQuotationEmailAction(
  quotationId: string
): Promise<ApiResponse<{ message: string; recipient: string }>> {
  try {
    await requirePermission("quotations:manage");

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return apiError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        "Email is not configured. Set RESEND_API_KEY in the server environment."
      );
    }

    const quotationResult = await getQuotationAction(quotationId);
    if (!quotationResult.success) {
      return quotationResult as ApiResponse<{ message: string; recipient: string }>;
    }

    const quotation = quotationResult.data;
    if (!quotation.customer?.email) {
      return apiError(ERROR_CODES.VALIDATION_ERROR, "Customer email is missing");
    }

    if (!["sent", "accepted"].includes(quotation.status)) {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        "Only sent or accepted quotations can be emailed to the customer"
      );
    }

    const pdfBytes = await buildQuotationPdf(quotation);
    const from =
      process.env.QUOTATION_EMAIL_FROM?.trim() || "Brightloop <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [quotation.customer.email],
        subject: `Quotation ${quotation.quotation_number} from Brightloop`,
        html: `<p>Dear ${quotation.customer.contact_name},</p><p>Please find your quotation <strong>${quotation.quotation_number}</strong> attached. Valid until ${quotation.valid_until}.</p><p>Total: ${quotation.currency} ${quotation.total_amount.toFixed(2)}</p>`,
        attachments: [
          {
            filename: `${quotation.quotation_number}.pdf`,
            content: Buffer.from(pdfBytes).toString("base64"),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return apiError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        `Failed to send email (${response.status}): ${body}`
      );
    }

    return apiSuccess({
      message: `Quotation emailed to ${quotation.customer.email}`,
      recipient: quotation.customer.email,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
