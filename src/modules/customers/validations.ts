import { z } from "zod";

// ── Customer ──────────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  company_name: z.string().min(1, "Company name is required").max(255),
  contact_name: z.string().min(1, "Contact name is required").max(255),
  email: z.string().email("Valid email is required").max(255),
  phone: z.string().max(50).optional().nullable(),
  business_number: z.string().max(100).optional().nullable(),
  currency: z.string().length(3, "Currency must be 3-letter ISO code").default("USD"),
  billing_address_line1: z.string().max(255).optional().nullable(),
  billing_address_line2: z.string().max(255).optional().nullable(),
  billing_city: z.string().max(100).optional().nullable(),
  billing_state: z.string().max(100).optional().nullable(),
  billing_postal_code: z.string().max(20).optional().nullable(),
  billing_country: z.string().length(2, "Country must be ISO 2-letter code").optional().nullable(),
  status: z.enum(["active", "suspended", "archived"]).default("active"),
  is_active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  profile_id: z.string().uuid().optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ── Filters ───────────────────────────────────────────────────────────────────

export const customerFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "suspended", "archived"]).optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
