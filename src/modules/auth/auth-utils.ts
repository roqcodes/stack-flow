import { createClient } from "@/lib/supabase/server";
import { UserProfile, UserRole } from "./types";
import { redirect } from "next/navigation";
import { User } from "@supabase/supabase-js";

/**
 * Retrieves the currently authenticated Supabase Auth User, or null if unauthenticated.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Retrieves the domain UserProfile associated with the active session.
 * Handles missing profiles gracefully by auto-recovering a customer profile if needed.
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active, permissions, avatar_url, created_at, updated_at")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      // Graceful fallback for missing profile edge case
      return {
        id: user.id,
        email: user.email || "",
        full_name: (user.user_metadata?.full_name as string) || null,
        role: "customer",
        is_active: true,
        permissions: [],
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return profile as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Asserts that the client is authenticated. Redirects to /login if unauthenticated.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Asserts that the client holds one of the specified roles.
 * Redirects to /login if unauthenticated, or /unauthorized if role is insufficient.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<{
  user: User;
  profile: UserProfile;
}> {
  const user = await requireAuth();
  const profile = await getCurrentProfile();

  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect("/unauthorized");
  }

  return { user, profile };
}

/**
 * Permission definitions for fine-grained authorization
 */
export type AppPermission =
  | "system:admin"
  | "staff:manage"
  | "catalog:manage"
  | "catalog:view"
  | "customers:manage"
  | "subscriptions:manage"
  | "invoices:manage"
  | "payments:manage"
  | "audit:view"
  | "portal:access";

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  admin: [
    "system:admin",
    "staff:manage",
    "catalog:manage",
    "catalog:view",
    "customers:manage",
    "subscriptions:manage",
    "invoices:manage",
    "payments:manage",
    "audit:view",
    "portal:access",
  ],
  staff: [
    "catalog:view",
    "customers:manage",
    "subscriptions:manage",
    "invoices:manage",
    "payments:manage",
    "portal:access",
  ],
  customer: ["portal:access"],
};

/**
 * Asserts that the current user has a specific domain permission.
 */
export async function requirePermission(permission: AppPermission): Promise<{
  user: User;
  profile: UserProfile;
}> {
  const user = await requireAuth();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/unauthorized");
  }

  const permissions = ROLE_PERMISSIONS[profile.role] || [];
  if (!permissions.includes(permission)) {
    redirect("/unauthorized");
  }

  return { user, profile };
}
