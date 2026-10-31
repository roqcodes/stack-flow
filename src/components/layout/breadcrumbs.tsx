"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  className?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Overview",
  customers: "Customers",
  subscriptions: "Subscriptions",
  invoices: "Invoices",
  payments: "Payments",
  quotations: "Quotations",
  products: "Products & Plans",
  discounts: "Discounts & Coupons",
  taxes: "Taxes & Jurisdictions",
  billing: "Billing Engine",
  analytics: "Revenue Analytics",
  users: "User & Staff Management",
  audit: "Audit Logs",
  settings: "Settings",
};

export function Breadcrumbs({ className }: BreadcrumbsProps) {
  const pathname = usePathname();

  if (!pathname || pathname === "/" || pathname === "/dashboard") {
    return (
      <nav aria-label="Breadcrumb" className={cn("flex items-center text-xs text-slate-500", className)}>
        <span className="flex items-center gap-1 font-medium text-slate-800">
          <Home className="h-3.5 w-3.5 text-blue-600" />
          <span>Dashboard Overview</span>
        </span>
      </nav>
    );
  }

  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center text-xs text-slate-500", className)}>
      <ol className="flex items-center space-x-1.5">
        <li>
          <Link
            href="/"
            className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only">Dashboard Home</span>
          </Link>
        </li>

        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          const label = ROUTE_LABELS[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <React.Fragment key={href}>
              <li className="text-slate-300">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                {isLast ? (
                  <span className="font-semibold text-slate-800" aria-current="page">
                    {label}
                  </span>
                ) : (
                  <Link href={href} className="text-slate-500 hover:text-slate-800 transition-colors">
                    {label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
