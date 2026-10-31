export type UserRole = "admin" | "staff" | "customer";

export interface UserProfile {
  id: string; // Supabase auth.users UUID
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  permissions?: string[];
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}
