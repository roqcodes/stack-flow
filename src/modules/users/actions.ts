"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/modules/auth/auth-utils";
import { UserFilters, UserListItem, UserStats, CreateStaffInput } from "./types";
import { z } from "zod";

const createStaffSchema = z.object({
  email: z.string().trim().email("Please provide a valid staff email address"),
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  permissions: z.array(z.string()).default([]),
});

/**
 * Fetch Users with search, role filters, and organization links (Admin Only)
 */
export async function getUsersListAction(filters: UserFilters = {}): Promise<{
  users: UserListItem[];
  totalCount: number;
  stats: UserStats;
  error?: string;
}> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();

    // 1. Build Base Profiles Query
    let query = supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active, permissions, created_at, updated_at", { count: "exact" });

    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.or(`email.ilike.${term},full_name.ilike.${term}`);
    }

    if (filters.role && filters.role !== "all") {
      query = query.eq("role", filters.role);
    }

    if (filters.status && filters.status !== "all") {
      query = query.eq("is_active", filters.status === "active");
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: profiles, count, error } = await query;

    if (error) {
      return {
        users: [],
        totalCount: 0,
        stats: { totalUsers: 0, adminsCount: 0, staffCount: 0, customersCount: 0 },
        error: error.message,
      };
    }

    // 2. Fetch linked customers for company names
    const profileIds = (profiles || []).map((p) => p.id);
    const { data: customers } = await supabase
      .from("customers")
      .select("id, profile_id, company_name")
      .in("profile_id", profileIds);

    const customerMap = new Map((customers || []).map((c) => [c.profile_id, c]));

    const users: UserListItem[] = (profiles || []).map((p) => {
      const customer = customerMap.get(p.id);
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        is_active: p.is_active ?? true,
        permissions: (p.permissions as string[]) || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        customer_company_name: customer?.company_name || null,
        customer_id: customer?.id || null,
      };
    });

    // 3. Compute Aggregated Stats
    const { data: allProfiles } = await supabase.from("profiles").select("role");
    const roles = allProfiles || [];

    const stats: UserStats = {
      totalUsers: roles.length,
      adminsCount: roles.filter((r) => r.role === "admin").length,
      staffCount: roles.filter((r) => r.role === "staff").length,
      customersCount: roles.filter((r) => r.role === "customer").length,
    };

    return {
      users,
      totalCount: count || 0,
      stats,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load user list";
    return {
      users: [],
      totalCount: 0,
      stats: { totalUsers: 0, adminsCount: 0, staffCount: 0, customersCount: 0 },
      error: message,
    };
  }
}

/**
 * Provision or elevate a user to Staff with assigned permissions (Admin Only)
 */
export async function createStaffMemberAction(payload: CreateStaffInput): Promise<{
  success?: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { user: currentAdmin } = await requireRole(["admin"]);

    const validated = createStaffSchema.safeParse(payload);
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message || "Invalid input data" };
    }

    const { email, fullName, permissions } = validated.data;
    const adminSupabase = createAdminClient();

    // Check if profile exists
    const { data: existingProfile } = await adminSupabase
      .from("profiles")
      .select("id, role")
      .ilike("email", email)
      .maybeSingle();

    let targetUserId: string;

    if (existingProfile) {
      targetUserId = existingProfile.id;
      // Update existing profile to staff role
      await adminSupabase
        .from("profiles")
        .update({
          full_name: fullName,
          role: "staff",
          is_active: true,
          permissions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId);
    } else {
      // Create auth user via admin client with temporary random password
      const tempPassword = `BrightloopStaff!${Math.random().toString(36).slice(2, 8)}`;
      const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authError || !authUser.user) {
        return { error: authError?.message || "Failed to provision user" };
      }

      targetUserId = authUser.user.id;

      // Update the profile created by trigger to staff role & permissions
      await adminSupabase
        .from("profiles")
        .update({
          full_name: fullName,
          role: "staff",
          is_active: true,
          permissions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId);
    }

    // Record in audit_logs table
    await adminSupabase.from("audit_logs").insert({
      user_id: currentAdmin.id,
      table_name: "profiles",
      record_id: targetUserId,
      action: "UPDATE",
      new_values: {
        role: "staff",
        email,
        full_name: fullName,
        permissions,
        action: "staff_created_by_admin",
      },
    });

    return {
      success: true,
      message: `Staff account for ${email} successfully configured with assigned permissions.`,
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "An error occurred while creating staff member.",
    };
  }
}

/**
 * Activate or Deactivate Staff Account (Admin Only)
 */
export async function toggleStaffActiveStatusAction({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user: currentAdmin } = await requireRole(["admin"]);

    if (currentAdmin.id === userId) {
      return { error: "Security restriction: You cannot deactivate your own administrative account." };
    }

    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
      .from("profiles")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      return { error: error.message };
    }

    // Record audit trail
    await adminSupabase.from("audit_logs").insert({
      user_id: currentAdmin.id,
      table_name: "profiles",
      record_id: userId,
      action: "UPDATE",
      new_values: {
        is_active: isActive,
        reason: isActive ? "account_activated" : "account_deactivated",
      },
    });

    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update account status." };
  }
}

/**
 * Update Staff Permissions (Admin Only)
 */
export async function updateStaffPermissionsAction({
  userId,
  permissions,
}: {
  userId: string;
  permissions: string[];
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user: currentAdmin } = await requireRole(["admin"]);
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
      .from("profiles")
      .update({
        permissions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      return { error: error.message };
    }

    // Record audit trail
    await adminSupabase.from("audit_logs").insert({
      user_id: currentAdmin.id,
      table_name: "profiles",
      record_id: userId,
      action: "UPDATE",
      new_values: { permissions },
    });

    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update staff permissions." };
  }
}
