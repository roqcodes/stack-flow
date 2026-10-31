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
  createCustomerSchema,
  updateCustomerSchema,
  customerFilterSchema,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilterInput,
} from "./validations";
import { Customer } from "./types";
import { PaginatedResult } from "@/modules/products/actions";

export type { PaginatedResult };

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LIST customers with search, filters, and pagination.
 * Public contract for Members 3 & 4: getCustomers
 */
export async function listCustomersAction(
  filters?: Partial<CustomerFilterInput>
): Promise<ApiResponse<PaginatedResult<Customer>>> {
  try {
    await requireRole(["admin", "staff"]);

    const parsed = customerFilterSchema.safeParse(filters);
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
    let query = supabase.from("customers").select("*", { count: "exact" });

    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%,business_number.ilike.%${search}%`
      );
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (is_active !== undefined) {
      query = query.eq("is_active", is_active);
    }

    query = query
      .order("company_name", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess({
      items: (data ?? []) as Customer[],
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
 * GET a single customer by ID.
 * Public contract for Members 3 & 4: getCustomers
 */
export async function getCustomerAction(
  customerId: string
): Promise<ApiResponse<Customer>> {
  try {
    await requireRole(["admin", "staff"]);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (error || !data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Customer not found");
    }

    return apiSuccess(data as Customer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * CREATE a new customer.
 * Admin creates customers; staff with customers:manage can also create.
 */
export async function createCustomerAction(
  input: CreateCustomerInput
): Promise<ApiResponse<Customer>> {
  try {
    await requirePermission("customers:manage");

    const validation = createCustomerSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(
          ERROR_CODES.CONFLICT,
          "A customer with this email or business number already exists"
        );
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    return apiSuccess(data as Customer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * UPDATE a customer's details.
 */
export async function updateCustomerAction(
  customerId: string,
  input: UpdateCustomerInput
): Promise<ApiResponse<Customer>> {
  try {
    await requirePermission("customers:manage");

    const validation = updateCustomerSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .update(validation.data)
      .eq("id", customerId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(
          ERROR_CODES.CONFLICT,
          "A customer with this email or business number already exists"
        );
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Customer not found");
    }

    return apiSuccess(data as Customer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * SUSPEND a customer (soft state change — preserves all financial history).
 * Only admins may archive customers.
 */
export async function suspendCustomerAction(
  customerId: string
): Promise<ApiResponse<Customer>> {
  try {
    await requirePermission("customers:manage");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .update({ status: "suspended", is_active: false })
      .eq("id", customerId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Customer not found");
    }

    return apiSuccess(data as Customer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * REACTIVATE a suspended customer.
 */
export async function reactivateCustomerAction(
  customerId: string
): Promise<ApiResponse<Customer>> {
  try {
    await requirePermission("customers:manage");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .update({ status: "active", is_active: true })
      .eq("id", customerId)
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Customer not found");
    }

    return apiSuccess(data as Customer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

/**
 * LINK a customer to a Supabase Auth profile.
 * Admin-only — connects a portal user account to a customer record.
 */
export async function linkCustomerProfileAction(
  customerId: string,
  profileId: string
): Promise<ApiResponse<Customer>> {
  try {
    await requirePermission("customers:manage");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .update({ profile_id: profileId })
      .eq("id", customerId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(
          ERROR_CODES.CONFLICT,
          "This profile is already linked to another customer"
        );
      }
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    if (!data) {
      return apiError(ERROR_CODES.NOT_FOUND, "Customer not found");
    }

    return apiSuccess(data as Customer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
