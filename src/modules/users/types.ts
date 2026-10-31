import { UserProfile, UserRole } from "@/modules/auth/types";

export interface UserListItem extends UserProfile {
  customer_company_name?: string | null;
  customer_id?: string | null;
  last_sign_in_at?: string | null;
}

export interface UserFilters {
  search?: string;
  role?: UserRole | "all";
  status?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
}

export interface UserStats {
  totalUsers: number;
  adminsCount: number;
  staffCount: number;
  customersCount: number;
}

export interface CreateStaffInput {
  email: string;
  fullName: string;
  temporaryPassword?: string;
  permissions: string[];
}
