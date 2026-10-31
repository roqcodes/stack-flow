import { z } from "zod";

// ── Quotation Template ────────────────────────────────────────────────────────

export const createQuotationTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(255),
  description: z.string().max(2000).optional().nullable(),
  terms: z.string().max(5000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const updateQuotationTemplateSchema = createQuotationTemplateSchema.partial();

export type CreateQuotationTemplateInput = z.infer<typeof createQuotationTemplateSchema>;
export type UpdateQuotationTemplateInput = z.infer<typeof updateQuotationTemplateSchema>;

// ── Quotation Template Item ───────────────────────────────────────────────────

export const createQuotationTemplateItemSchema = z.object({
  template_id: z.string().uuid("Invalid template ID"),
  product_id: z.string().uuid("Invalid product ID"),
  plan_id: z.string().uuid("Invalid plan ID").optional().nullable(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  default_discount_percentage: z.coerce.number().min(0).max(100).default(0),
});

export type CreateQuotationTemplateItemInput = z.infer<typeof createQuotationTemplateItemSchema>;

// ── Quotation Item (for create) ───────────────────────────────────────────────

export const quotationLineItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  plan_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Unit price must be non-negative"),
  discount_amount: z.coerce.number().min(0).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
});

export type QuotationLineItemInput = z.infer<typeof quotationLineItemSchema>;

// ── Quotation ─────────────────────────────────────────────────────────────────

export const createQuotationSchema = z.object({
  customer_id: z.string().uuid("Customer ID is required"),
  template_id: z.string().uuid().optional().nullable(),
  currency: z.string().length(3, "Currency must be 3-letter ISO code").default("USD"),
  valid_until: z.string().min(1, "Valid until date is required"),
  notes: z.string().max(2000).optional().nullable(),
  terms: z.string().max(5000).optional().nullable(),
  line_items: z
    .array(quotationLineItemSchema)
    .min(1, "At least one line item is required"),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

export const updateQuotationSchema = z.object({
  currency: z.string().length(3).optional(),
  valid_until: z.string().optional(),
  notes: z.string().max(2000).optional().nullable(),
  terms: z.string().max(5000).optional().nullable(),
  line_items: z.array(quotationLineItemSchema).min(1).optional(),
});

export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;

// ── Quotation Status Transition ───────────────────────────────────────────────

export const quotationStatusSchema = z.object({
  quotation_id: z.string().uuid("Invalid quotation ID"),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
});

export type QuotationStatusInput = z.infer<typeof quotationStatusSchema>;

// ── Filters ───────────────────────────────────────────────────────────────────

export const quotationFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).optional(),
  customer_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type QuotationFilterInput = z.infer<typeof quotationFilterSchema>;
