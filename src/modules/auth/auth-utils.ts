import { createClient } from "@/lib/supabase/server";
import { UserProfile, UserRole } from "./types";
import { Permission, hasPermission } from "./permissions";
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
        created_at: "1970-01-01T00:00:00.000Z",
        updated_at: "1970-01-01T00:00:00.000Z",
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

/** @deprecated Use `Permission` from `./permissions` */
export type AppPermission = Permission;

/**
 * Asserts that the current user has a specific domain permission.
 */
export async function requirePermission(permission: Permission): Promise<{
  user: User;
  profile: UserProfile;
}> {
  const user = await requireAuth();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/unauthorized");
  }

  if (!hasPermission(profile.role, permission)) {
    redirect("/unauthorized");
  }

  return { user, profile };
}
