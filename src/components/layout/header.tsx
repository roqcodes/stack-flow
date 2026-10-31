"use client";

import * as React from "react";
import { Menu, Bell, Search, User, Shield, CheckCircle2 } from "lucide-react";
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "./breadcrumbs";
import { useAuthContext } from "@/components/auth/can";
import { logoutAction } from "@/modules/auth/actions";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, role } = useAuthContext();

  const userInitials = React.useMemo(() => {
    if (user?.full_name) {
      return user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "BL";
  }, [user]);

  const roleLabel = React.useMemo(() => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "staff":
        return "Operations Staff";
      case "customer":
        return "Customer";
      default:
        return "User";
    }
  }, [role]);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/70 bg-white/72 px-4 sm:px-6 backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      {/* Left side: Mobile menu toggle, Breadcrumbs & Search */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden focus:outline-none"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Dynamic Breadcrumbs */}
        <div className="hidden md:block">
          <Breadcrumbs />
        </div>

        {/* Search */}
        <div className="relative w-full max-w-xs hidden xl:block ml-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="search"
            placeholder="Search records, invoices, users..."
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
          />
        </div>
      </div>

      {/* Right side: Environment badge, Notifications & Profile */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Environment Tag */}
        <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1.5 border-slate-200 text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          <span className="font-medium text-[11px]">Live Environment</span>
        </Badge>

        {/* Notification Popover Dropdown */}
        <Dropdown>
          <DropdownTrigger>
            <div
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="View notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
            </div>
          </DropdownTrigger>
          <DropdownContent align="right" className="w-80 p-2">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Notifications</span>
              <span className="text-[10px] text-blue-600 font-medium">1 unread</span>
            </div>
            <div className="py-2 px-3 text-xs space-y-1">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-800 text-[11px]">PostgreSQL 16 Engine Online</p>
                  <p className="text-[10px] text-slate-400">All 22 core ledger tables and RLS verified.</p>
                </div>
              </div>
            </div>
          </DropdownContent>
        </Dropdown>

        <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

        {/* User profile dropdown */}
        <Dropdown>
          <DropdownTrigger>
            <div className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-slate-50 transition-colors select-none cursor-pointer">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200">
                {userInitials}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-xs font-semibold text-slate-900 leading-none">
                  {user?.full_name || "Enterprise User"}
                </p>
                <p className="text-[10px] text-slate-400 leading-none mt-1 truncate max-w-[140px]">
                  {user?.email || "Signed in"}
                </p>
              </div>
            </div>
          </DropdownTrigger>
          <DropdownContent align="right" className="w-60">
            <div className="px-3 py-2.5 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-900">
                {user?.full_name || "Signed in as"}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email || "admin@brightloop.io"}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge variant={role === "admin" ? "default" : role === "staff" ? "secondary" : "outline"} className="text-[10px] py-0 px-2">
                  <Shield className="h-2.5 w-2.5 mr-1 inline" />
                  {roleLabel}
                </Badge>
              </div>
            </div>
            <DropdownItem>
              <User className="mr-2 h-3.5 w-3.5 text-slate-400" />
              Account Settings
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              destructive
              onClick={async () => {
                await logoutAction();
              }}
            >
              Sign out
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
