import { UserRole } from "./types";

/**
 * Granular Domain Permissions across Brightloop
 */
export const PERMISSIONS = {
  // User & Staff Governance (Strictly Admin)
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  STAFF_CREATE: "staff:create",
  STAFF_MANAGE: "staff:manage",
  
  // Catalog & Products
  CATALOG_VIEW: "catalog:view",
  CATALOG_MANAGE: "catalog:manage",
  
  // Customers
  CUSTOMERS_VIEW: "customers:view",
  CUSTOMERS_MANAGE: "customers:manage",
  
  // Quotations
  QUOTATIONS_VIEW: "quotations:view",
  QUOTATIONS_MANAGE: "quotations:manage",
  
  // Subscriptions & Recurring Engine
  SUBSCRIPTIONS_VIEW: "subscriptions:view",
  SUBSCRIPTIONS_MANAGE: "subscriptions:manage",
  
  // Invoices & Financials
  INVOICES_VIEW: "invoices:view",
  INVOICES_MANAGE: "invoices:manage",
  
  // Payments & Allocations
  PAYMENTS_VIEW: "payments:view",
  PAYMENTS_MANAGE: "payments:manage",
  
  // System Security & Audits
  AUDIT_VIEW: "audit:view",
  SETTINGS_MANAGE: "settings:manage",
  
  // Self-Service Customer Portal
  PORTAL_ACCESS: "portal:access",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Static Role-to-Permission Matrix
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: Object.values(PERMISSIONS),
  staff: [
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.QUOTATIONS_VIEW,
    PERMISSIONS.QUOTATIONS_MANAGE,
    PERMISSIONS.SUBSCRIPTIONS_VIEW,
    PERMISSIONS.SUBSCRIPTIONS_MANAGE,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.INVOICES_MANAGE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_MANAGE,
    PERMISSIONS.PORTAL_ACCESS,
  ],
  customer: [
    PERMISSIONS.PORTAL_ACCESS,
  ],
};

/**
 * Checks if a given role possesses a required permission
 */
export function hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Checks if a given role possesses at least one of the required permissions
 */
export function hasAnyPermission(role: UserRole | undefined | null, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.some((perm) => hasPermission(role, perm));
}

/**
 * Checks if a given role possesses all specified permissions
 */
export function hasAllPermissions(role: UserRole | undefined | null, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.every((perm) => hasPermission(role, perm));
}
