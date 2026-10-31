"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/modules/auth/auth-utils";
import { revalidatePath } from "next/cache";
import { Tax, TaxFilters } from "./types";
import { taxSchema, TaxInput } from "./validations";

export interface TaxActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * List tax rules with optional filters
 */
export async function listTaxesAction(filters?: TaxFilters): Promise<TaxActionResult<Tax[]>> {
  try {
    await requireRole(["admin", "staff"]);
    const supabase = await createClient();

    let query = supabase.from("taxes").select("*").order("country", { ascending: true });

    if (filters?.country) {
      query = query.eq("country", filters.country.toUpperCase());
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

    return { success: true, data: (data as Tax[]) || [] };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load tax rules" };
  }
}

/**
 * Create a new tax jurisdiction rule
 */
export async function createTaxAction(data: TaxInput): Promise<TaxActionResult<Tax>> {
  try {
    await requireRole(["admin"]);
    const validation = taxSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: "Validation failed. Please correct the fields.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const supabase = await createClient();
    const { data: created, error } = await supabase
      .from("taxes")
      .insert({
        name: validation.data.name,
        code: validation.data.code,
        country: validation.data.country,
        state_province: validation.data.state_province || null,
        rate: validation.data.rate,
        is_compound: validation.data.is_compound,
        is_active: validation.data.is_active,
        valid_from: validation.data.valid_from || null,
        valid_until: validation.data.valid_until || null,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Tax code "${validation.data.code}" already exists.` };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/taxes");
    return { success: true, data: created as Tax };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create tax rule" };
  }
}

/**
 * Update an existing tax jurisdiction rule
 */
export async function updateTaxAction(id: string, data: Partial<TaxInput>): Promise<TaxActionResult<Tax>> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();

    const { data: updated, error } = await supabase
      .from("taxes")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/taxes");
    return { success: true, data: updated as Tax };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update tax rule" };
  }
}

/**
 * Toggle tax jurisdiction active standing
 */
export async function toggleTaxStatusAction(id: string, isActive: boolean): Promise<TaxActionResult<Tax>> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();

    const { data: updated, error } = await supabase
      .from("taxes")
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

    revalidatePath("/taxes");
    return { success: true, data: updated as Tax };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to toggle tax status" };
  }
}

/**
 * Delete a tax jurisdiction rule
 */
export async function deleteTaxAction(id: string): Promise<TaxActionResult<null>> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();

    const { error } = await supabase.from("taxes").delete().eq("id", id);
    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/taxes");
    return { success: true, data: null };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete tax rule" };
  }
}
