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
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  createPlanSchema,
  updatePlanSchema,
  createPlanRuleSchema,
  productFilterSchema,
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  CreatePlanInput,
  UpdatePlanInput,
  CreatePlanRuleInput,
  ProductFilterInput,
} from "./validations";
import {
  Product,
  ProductVariant,
  Plan,
  PlanRule,
  EffectiveProductPrice,
} from "./types";

// ─── Paginated list type ──────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LIST products with search, filters, pagination.
 * Required by Member 3 & 4: getProductDetails
 */
export async function listProductsAction(
  filters?: Partial<ProductFilterInput>
): Promise<ApiResponse<PaginatedResult<Product>>> {
  try {
    await requireRole(["admin", "staff"]);

    const parsed = productFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid filter parameters",
        parsed.error.flatten().fieldErrors
      );
    }

    const { search, status, is_active, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const supabase = await createClient();
    let query = supabase.from("products").select("*", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (is_active !== undefined) {
      query = query.eq("is_active", is_active);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess({
      items: (data ?? []) as Product[],
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
 * GET a single product with its variants and plans.
 * Public contract for Members 3 & 4: getProductDetails
 */
export async function getProductAction(
  productId: string
): Promise<
  ApiResponse<{
    product: Product;
    variants: ProductVariant[];
    plans: Plan[];
  }>
> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();

    const [productRes, variantsRes, plansRes] = await Promise.all([
      supabase.from("products").select("*").eq("id", productId).single(),
      supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true }),
      supabase
        .from("plans")
        .select("*")
        .eq("product_id", productId)
        .order("price", { ascending: true }),
    ]);

    if (productRes.error || !productRes.data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Product not found");
    }

    return apiSuccess({
      product: productRes.data as Product,
      variants: (variantsRes.data ?? []) as ProductVariant[],
      plans: (plansRes.data ?? []) as Plan[],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

function readMetadataPrice(
  metadata: Record<string, unknown> | undefined,
  key: "sales_price" | "cost_price"
): number | null {
  if (!metadata) return null;
  const value = metadata[key];
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Returns effective catalog prices for billing integrations.
 * Public contract for Members 3 & 4: getEffectiveProductPrices
 *
 * Sales and cost prices are stored in `products.metadata` / `product_variants.metadata`:
 * `{ "sales_price": 99.0, "cost_price": 40.0, "currency": "USD" }`
 */
export async function getEffectiveProductPricesAction(
  productId: string
): Promise<ApiResponse<EffectiveProductPrice>> {
  try {
    await requireRole(["admin", "staff"]);

    const result = await getProductAction(productId);
    if (!result.success) {
      return result as ApiResponse<EffectiveProductPrice>;
    }

    const { product, variants, plans } = result.data;
    const productMeta = (product.metadata ?? {}) as Record<string, unknown>;
    const currency =
      typeof productMeta.currency === "string" && productMeta.currency.length === 3
        ? productMeta.currency
        : "USD";

    return apiSuccess({
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      sales_price: readMetadataPrice(productMeta, "sales_price"),
      cost_price: readMetadataPrice(productMeta, "cost_price"),
      currency,
      variants: variants.map((variant) => {
        const meta = (variant.attributes ?? {}) as Record<string, unknown>;
        return {
          variant_id: variant.id,
          sku: variant.sku,
          name: variant.name,
          sales_price: readMetadataPrice(meta, "sales_price"),
          cost_price: readMetadataPrice(meta, "cost_price"),
        };
      }),
      plans: plans
        .filter((plan) => plan.is_active)
        .map((plan) => ({
          plan_id: plan.id,
          code: plan.code,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          billing_cycle: plan.billing_cycle,
          billing_interval_count: plan.billing_interval_count,
          is_active: plan.is_active,
        })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * CREATE a product. Admin/staff with catalog:manage permission.
 */
export async function createProductAction(
  input: CreateProductInput
): Promise<ApiResponse<Product>> {
  try {
    await requirePermission("catalog:manage");

    const validation = createProductSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(ERROR_CODES.CONFLICT, "A product with this code already exists");
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as Product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * UPDATE a product.
 */
export async function updateProductAction(
  productId: string,
  input: UpdateProductInput
): Promise<ApiResponse<Product>> {
  try {
    await requirePermission("catalog:manage");

    const validation = updateProductSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .update(validation.data)
      .eq("id", productId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(ERROR_CODES.CONFLICT, "A product with this code already exists");
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Product not found");
    }

    return apiSuccess(data as Product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * DEACTIVATE a product (soft delete — preserves history).
 * Cannot hard-delete products with plans linked to active subscriptions.
 */
export async function deactivateProductAction(
  productId: string
): Promise<ApiResponse<Product>> {
  try {
    await requirePermission("catalog:manage");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .update({ is_active: false, status: "archived" })
      .eq("id", productId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Product not found");
    }

    return apiSuccess(data as Product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET all variants for a product.
 * Public contract for Members 3 & 4: getVariants
 */
export async function getProductVariantsAction(
  productId: string
): Promise<ApiResponse<ProductVariant[]>> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess((data ?? []) as ProductVariant[]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * CREATE a product variant.
 */
export async function createVariantAction(
  input: CreateVariantInput
): Promise<ApiResponse<ProductVariant>> {
  try {
    await requirePermission("catalog:manage");

    const validation = createVariantSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_variants")
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(ERROR_CODES.CONFLICT, "A variant with this SKU already exists");
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as ProductVariant);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * UPDATE a product variant.
 */
export async function updateVariantAction(
  variantId: string,
  input: UpdateVariantInput
): Promise<ApiResponse<ProductVariant>> {
  try {
    await requirePermission("catalog:manage");

    const validation = updateVariantSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_variants")
      .update(validation.data)
      .eq("id", variantId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(ERROR_CODES.CONFLICT, "A variant with this SKU already exists");
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Variant not found");
    }

    return apiSuccess(data as ProductVariant);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * DEACTIVATE a variant.
 */
export async function deactivateVariantAction(
  variantId: string
): Promise<ApiResponse<ProductVariant>> {
  try {
    await requirePermission("catalog:manage");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_variants")
      .update({ is_active: false })
      .eq("id", variantId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Variant not found");
    }

    return apiSuccess(data as ProductVariant);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET all plans for a product.
 * Public contract for Members 3 & 4: getPlans / getEffectiveProductPrices
 */
export async function getProductPlansAction(
  productId: string
): Promise<ApiResponse<Plan[]>> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("product_id", productId)
      .order("price", { ascending: true });

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess((data ?? []) as Plan[]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * GET a single plan with its rules.
 * Public contract for Members 3 & 4.
 */
export async function getPlanAction(
  planId: string
): Promise<ApiResponse<{ plan: Plan; rules: PlanRule[] }>> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();

    const [planRes, rulesRes] = await Promise.all([
      supabase.from("plans").select("*").eq("id", planId).single(),
      supabase.from("plan_rules").select("*").eq("plan_id", planId),
    ]);

    if (planRes.error || !planRes.data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Plan not found");
    }

    return apiSuccess({
      plan: planRes.data as Plan,
      rules: (rulesRes.data ?? []) as PlanRule[],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * CREATE a plan.
 */
export async function createPlanAction(
  input: CreatePlanInput
): Promise<ApiResponse<Plan>> {
  try {
    await requirePermission("catalog:manage");

    const validation = createPlanSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plans")
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(ERROR_CODES.CONFLICT, "A plan with this code already exists");
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as Plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * UPDATE a plan. Price changes are tracked via plan history in quotation_items / invoice_items snapshots.
 */
export async function updatePlanAction(
  planId: string,
  input: UpdatePlanInput
): Promise<ApiResponse<Plan>> {
  try {
    await requirePermission("catalog:manage");

    const validation = updatePlanSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plans")
      .update(validation.data)
      .eq("id", planId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(ERROR_CODES.CONFLICT, "A plan with this code already exists");
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Plan not found");
    }

    return apiSuccess(data as Plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * DEACTIVATE a plan.
 */
export async function deactivatePlanAction(
  planId: string
): Promise<ApiResponse<Plan>> {
  try {
    await requirePermission("catalog:manage");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plans")
      .update({ is_active: false, status: "archived" })
      .eq("id", planId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Plan not found");
    }

    return apiSuccess(data as Plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN RULES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CREATE a plan rule (pause/renewal/early-closure/auto-closure).
 */
export async function createPlanRuleAction(
  input: CreatePlanRuleInput
): Promise<ApiResponse<PlanRule>> {
  try {
    await requirePermission("catalog:manage");

    const validation = createPlanRuleSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plan_rules")
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as PlanRule);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * DELETE a plan rule.
 */
export async function deletePlanRuleAction(
  ruleId: string
): Promise<ApiResponse<{ deleted: true }>> {
  try {
    await requirePermission("catalog:manage");

    const supabase = await createClient();
    const { error } = await supabase.from("plan_rules").delete().eq("id", ruleId);

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
