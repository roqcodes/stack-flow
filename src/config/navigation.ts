import {
  LayoutDashboard,
  Users,
  Package,
  Layers,
  FileSpreadsheet,
  Repeat,
  Receipt,
  CreditCard,
  Percent,
  Calculator,
  BarChart3,
  Settings,
  ShieldCheck,
  UserCheck,
  LucideIcon,
} from "lucide-react";
import { UserRole } from "@/modules/auth/types";
import { Permission, PERMISSIONS } from "@/modules/auth/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  section?: "core" | "billing" | "catalog" | "system";
  roles?: readonly UserRole[];
  permission?: Permission;
}

export const navigationConfig: NavItem[] = [
  {
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
    section: "core",
    roles: ["admin", "staff", "customer"],
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    section: "core",
    roles: ["admin", "staff"],
    permission: PERMISSIONS.CUSTOMERS_VIEW,
  },
  {
    title: "Subscriptions",
    href: "/subscriptions",
    icon: Repeat,
    section: "billing",
    roles: ["admin", "staff", "customer"],
    permission: PERMISSIONS.SUBSCRIPTIONS_VIEW,
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: Receipt,
    section: "billing",
    roles: ["admin", "staff", "customer"],
    permission: PERMISSIONS.INVOICES_VIEW,
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    section: "billing",
    roles: ["admin", "staff", "customer"],
    permission: PERMISSIONS.PAYMENTS_VIEW,
  },
  {
    title: "Quotations",
    href: "/quotations",
    icon: FileSpreadsheet,
    section: "billing",
    roles: ["admin", "staff", "customer"],
    permission: PERMISSIONS.QUOTATIONS_VIEW,
  },
  {
    title: "Products & Plans",
    href: "/products",
    icon: Package,
    section: "catalog",
    roles: ["admin", "staff"],
    permission: PERMISSIONS.CATALOG_VIEW,
  },
  {
    title: "Discounts & Coupons",
    href: "/discounts",
    icon: Percent,
    section: "catalog",
    roles: ["admin", "staff"],
  },
  {
    title: "Taxes & Jurisdictions",
    href: "/taxes",
    icon: Calculator,
    section: "catalog",
    roles: ["admin", "staff"],
  },
  {
    title: "Billing Engine",
    href: "/billing",
    icon: Layers,
    section: "billing",
    roles: ["admin"],
  },
  {
    title: "Revenue Analytics",
    href: "/analytics",
    icon: BarChart3,
    section: "core",
    roles: ["admin", "staff"],
  },
  // Administrative User Management (Strictly Admin)
  {
    title: "Staff & Users",
    href: "/users",
    icon: UserCheck,
    section: "system",
    roles: ["admin"],
    permission: PERMISSIONS.USERS_VIEW,
  },
  {
    title: "Audit & Security",
    href: "/audit",
    icon: ShieldCheck,
    section: "system",
    roles: ["admin"],
    permission: PERMISSIONS.AUDIT_VIEW,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    section: "system",
    roles: ["admin", "staff", "customer"],
  },
];
