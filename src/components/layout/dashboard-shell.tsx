"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/components/auth/can";

interface DashboardShellProps {
  children: React.ReactNode;
}

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
];

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  return (
    <ToastProvider>
      <AuthProvider>
        {isAuthRoute ? (
          <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            {children}
          </div>
        ) : (
          <div className="flex min-h-screen app-mesh-bg text-slate-900">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex flex-1 flex-col min-w-0">
              <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                {children}
              </main>
            </div>
          </div>
        )}
      </AuthProvider>
    </ToastProvider>
  );
}
