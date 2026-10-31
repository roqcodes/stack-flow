import { z } from "zod";

// ── Product ──────────────────────────────────────────────────────────────────

const productMetadataSchema = z.object({
  product_type: z.string().max(100).optional(),
  sales_price: z.coerce.number().min(0).optional(),
  cost_price: z.coerce.number().min(0).optional(),
  currency: z.string().length(3).optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z
    .string()
    .min(1, "Code is required")
    .max(100)
    .regex(/^[A-Z0-9_-]+$/, "Code must be uppercase letters, numbers, dashes or underscores"),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  is_active: z.boolean().default(true),
  metadata: productMetadataSchema.optional().default({}),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ── Product Variant ───────────────────────────────────────────────────────────

export const createVariantSchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  name: z.string().min(1, "Variant name is required").max(255),
  sku: z
    .string()
    .min(1, "SKU is required")
    .max(100)
    .regex(/^[A-Z0-9_-]+$/, "SKU must be uppercase letters, numbers, dashes or underscores"),
  attributes: z.record(z.string(), z.string()).optional().default({}),
  is_active: z.boolean().default(true),
});

export const updateVariantSchema = createVariantSchema.omit({ product_id: true }).partial();

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

// ── Plan ──────────────────────────────────────────────────────────────────────

export const createPlanSchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  variant_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Plan name is required").max(255),
  code: z
    .string()
    .min(1, "Plan code is required")
    .max(100)
    .regex(/^[A-Z0-9_-]+$/, "Code must be uppercase letters, numbers, dashes or underscores"),
  billing_cycle: z.enum(["daily", "weekly", "monthly", "yearly"]),
  billing_interval_count: z.coerce.number().int().min(1, "Interval count must be at least 1"),
  currency: z.string().length(3, "Currency must be 3-letter ISO code").default("USD"),
  price: z.coerce.number().min(0, "Price must be non-negative"),
  trial_period_days: z.coerce.number().int().min(0).default(0),
  setup_fee: z.coerce.number().min(0).default(0),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  is_active: z.boolean().default(true),
});

export const updatePlanSchema = createPlanSchema.omit({ product_id: true }).partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

// ── Plan Rule ─────────────────────────────────────────────────────────────────

export const createPlanRuleSchema = z.object({
  plan_id: z.string().uuid("Invalid plan ID"),
  rule_type: z.string().min(1, "Rule type is required").max(100),
  rule_value: z.string().min(1, "Rule value is required").max(500),
  description: z.string().max(500).optional().nullable(),
});

export type CreatePlanRuleInput = z.infer<typeof createPlanRuleSchema>;

// ── Filters ───────────────────────────────────────────────────────────────────

export const productFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ProductFilterInput = z.infer<typeof productFilterSchema>;
