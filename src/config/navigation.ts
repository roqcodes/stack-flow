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
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  section?: "core" | "billing" | "catalog" | "system";
}

export const navigationConfig: NavItem[] = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    section: "core",
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    section: "core",
  },
  {
    title: "Subscriptions",
    href: "/subscriptions",
    icon: Repeat,
    section: "billing",
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: Receipt,
    section: "billing",
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    section: "billing",
  },
  {
    title: "Quotations",
    href: "/quotations",
    icon: FileSpreadsheet,
    section: "billing",
  },
  {
    title: "Products & Plans",
    href: "/products",
    icon: Package,
    section: "catalog",
  },
  {
    title: "Discounts & Coupons",
    href: "/discounts",
    icon: Percent,
    section: "catalog",
  },
  {
    title: "Taxes & Jurisdictions",
    href: "/taxes",
    icon: Calculator,
    section: "catalog",
  },
  {
    title: "Billing Engine",
    href: "/billing",
    icon: Layers,
    section: "billing",
  },
  {
    title: "Revenue Analytics",
    href: "/analytics",
    icon: BarChart3,
    section: "core",
  },
  {
    title: "Audit & Security",
    href: "/audit",
    icon: ShieldCheck,
    section: "system",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    section: "system",
  },
];
