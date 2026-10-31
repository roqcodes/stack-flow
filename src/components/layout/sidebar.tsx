"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig, NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Zap, X } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const sections: { key: NavItem["section"]; label: string }[] = [
    { key: "core", label: "Core Operations" },
    { key: "billing", label: "Billing & Revenue" },
    { key: "catalog", label: "Product Catalog" },
    { key: "system", label: "Administration" },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900">
                Brightloop
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Billing Platform
              </span>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {sections.map(({ key, label }) => {
            const items = navigationConfig.filter((item) => item.section === key);
            if (items.length === 0) return null;

            return (
              <div key={key} className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <div className="space-y-0.5 pt-1">
                  {items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              "h-4 w-4 transition-colors",
                              isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                            )}
                          />
                          <span>{item.title}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              isActive
                                ? "bg-blue-200/60 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Workspace Footer Indicator */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-700">Production Engine</span>
                <span className="text-[10px] text-slate-400">PostgreSQL 16 · Supabase</span>
              </div>
            </div>
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
              v1.0
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
