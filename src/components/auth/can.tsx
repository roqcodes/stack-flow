"use client";

import * as React from "react";
import { UserProfile, UserRole } from "@/modules/auth/types";
import { Permission, hasPermission, hasAnyPermission } from "@/modules/auth/permissions";

interface AuthContextValue {
  user: UserProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  role: null,
  isLoading: true,
  can: () => false,
  canAny: () => false,
});

export function AuthProvider({
  children,
  initialProfile,
}: {
  children: React.ReactNode;
  initialProfile?: UserProfile | null;
}) {
  const [profile, setProfile] = React.useState<UserProfile | null>(initialProfile ?? null);
  const [isLoading, setIsLoading] = React.useState(!initialProfile);

  React.useEffect(() => {
    // If not provided server-side, fetch profile via client Supabase
    if (!initialProfile) {
      async function fetchProfile() {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data } = await supabase
              .from("profiles")
              .select("id, email, full_name, role, avatar_url, created_at, updated_at")
              .eq("id", user.id)
              .single();

            if (data) {
              setProfile(data as UserProfile);
            }
          }
        } catch {
          // Unauthenticated or fallback
        } finally {
          setIsLoading(false);
        }
      }
      fetchProfile();
    }
  }, [initialProfile]);

  const role = profile?.role ?? null;

  const can = React.useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role]
  );

  const canAny = React.useCallback(
    (permissions: Permission[]) => hasAnyPermission(role, permissions),
    [role]
  );

  return (
    <AuthContext.Provider value={{ user: profile, role, isLoading, can, canAny }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return React.useContext(AuthContext);
}

/**
 * Declarative component gate: renders children only if user possesses the permission
 */
export function Can({
  permission,
  permissions,
  fallback = null,
  children,
}: {
  permission?: Permission;
  permissions?: Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, canAny } = useAuthContext();

  let isAllowed = false;
  if (permission) {
    isAllowed = can(permission);
  } else if (permissions && permissions.length > 0) {
    isAllowed = canAny(permissions);
  }

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
