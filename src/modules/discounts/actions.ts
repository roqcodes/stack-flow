"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/modules/auth/auth-utils";
import { revalidatePath } from "next/cache";
import { Discount, DiscountFilters, DiscountWithProducts } from "./types";
import { discountSchema, DiscountInput } from "./validations";

export interface DiscountActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * List discounts with optional filters and associated products
 */
export async function listDiscountsAction(
  filters?: DiscountFilters
): Promise<DiscountActionResult<DiscountWithProducts[]>> {
  try {
    await requireRole(["admin", "staff"]);
    const supabase = await createClient();

    let query = supabase.from("discounts").select(`
      *,
      discount_products (
        product_id,
        products (
          id,
          name,
          code
        )
      )
    `).order("created_at", { ascending: false });

    if (filters?.type) {
      query = query.eq("type", filters.type);
    }

    if (typeof filters?.isActive === "boolean") {
      query = query.eq("is_active", filters.isActive);
    }

    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`name.ilike.${term},code.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted: DiscountWithProducts[] = (data || []).map((d: any) => ({
      ...d,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applicable_products: d.discount_products?.map((dp: any) => dp.products).filter(Boolean) || [],
    }));

    return { success: true, data: formatted };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load discounts",
    };
  }
}

/**
 * Create a new discount / coupon
 */
export async function createDiscountAction(
  data: DiscountInput
): Promise<DiscountActionResult<Discount>> {
  try {
    await requireRole(["admin"]);
    const validation = discountSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: "Validation failed. Please review errors.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const supabase = await createClient();
    const { data: created, error } = await supabase
      .from("discounts")
      .insert({
        name: validation.data.name,
        code: validation.data.code,
        type: validation.data.type,
        value: validation.data.value,
        currency: validation.data.currency || "USD",
        max_redemptions: validation.data.max_redemptions || null,
        valid_from: validation.data.valid_from || null,
        valid_until: validation.data.valid_until || null,
        is_active: validation.data.is_active,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Discount code "${validation.data.code}" already exists.` };
      }
      return { success: false, error: error.message };
    }

    // Attach products if provided
    if (validation.data.product_ids && validation.data.product_ids.length > 0) {
      const productRows = validation.data.product_ids.map((productId) => ({
        discount_id: created.id,
        product_id: productId,
      }));
      await supabase.from("discount_products").insert(productRows);
    }

    revalidatePath("/discounts");
    return { success: true, data: created as Discount };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create discount",
    };
  }
}

/**
 * Toggle discount active status
 */
export async function toggleDiscountStatusAction(
  id: string,
  isActive: boolean
): Promise<DiscountActionResult<Discount>> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();

    const { data: updated, error } = await supabase
      .from("discounts")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/discounts");
    return { success: true, data: updated as Discount };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle discount status",
    };
  }
}

/**
 * Delete a discount
 */
export async function deleteDiscountAction(id: string): Promise<DiscountActionResult<null>> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();

    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/discounts");
    return { success: true, data: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete discount",
    };
  }
}
