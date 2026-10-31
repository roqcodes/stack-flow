import { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/modules/auth/auth-utils";
import { ensureRequestScope } from "@/lib/request-scope";
import { PageHeader } from "@/components/layout/page-header";
import { glassPanel } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { Settings, Users, LayoutDashboard } from "lucide-react";

export const instant = false;

export const metadata: Metadata = {
  title: "Settings — Brightloop",
  description: "Application and workspace settings.",
};

export default async function SettingsPage() {
  await ensureRequestScope();
  await requireRole(["admin", "staff", "customer"]);

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Account preferences and workspace configuration."
        icon={Settings}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/users"
          className={cn(
            glassPanel(),
            "p-5 block transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          )}
        >
          <Users className="h-5 w-5 text-blue-600 mb-2" aria-hidden />
          <p className="font-semibold text-slate-900">Staff & users</p>
          <p className="text-xs text-slate-500 mt-1">Manage roles and access (admin)</p>
        </Link>
        <Link
          href="/portal"
          className={cn(
            glassPanel(),
            "p-5 block transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          )}
        >
          <LayoutDashboard className="h-5 w-5 text-violet-600 mb-2" aria-hidden />
          <p className="font-semibold text-slate-900">Customer portal</p>
          <p className="text-xs text-slate-500 mt-1">Self-service billing view</p>
        </Link>
      </div>
    </div>
  );
}
