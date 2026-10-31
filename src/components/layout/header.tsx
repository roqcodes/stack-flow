"use client";

import * as React from "react";
import { Menu, Bell, Search, User, Shield } from "lucide-react";
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
      {/* Left side: Mobile menu toggle & Global search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden focus:outline-none"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative w-full max-w-sm hidden sm:block">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="search"
            placeholder="Search subscriptions, customers, invoices..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
          />
        </div>
      </div>

      {/* Right side: Environment badge, Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* Environment Tag */}
        <Badge variant="outline" className="hidden md:inline-flex items-center gap-1.5 border-slate-200 text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          <span className="font-medium text-[11px]">Live Environment</span>
        </Badge>

        {/* Notifications */}
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* User profile dropdown */}
        <Dropdown>
          <DropdownTrigger>
            <div className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-slate-50 transition-colors select-none">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-xs border border-blue-200">
                BL
              </div>
              <div className="hidden text-left md:block">
                <p className="text-xs font-semibold text-slate-900 leading-none">Platform Admin</p>
                <p className="text-[10px] text-slate-400 leading-none mt-1">admin@brightloop.io</p>
              </div>
            </div>
          </DropdownTrigger>
          <DropdownContent align="right" className="w-56">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-900">Signed in as</p>
              <p className="text-xs text-slate-500 truncate">admin@brightloop.io</p>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                <Shield className="h-3 w-3" />
                <span>Super Administrator</span>
              </div>
            </div>
            <DropdownItem>
              <User className="mr-2 h-3.5 w-3.5 text-slate-400" />
              Account Settings
            </DropdownItem>
            <DropdownItem>System Audit Logs</DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive>Sign out</DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
