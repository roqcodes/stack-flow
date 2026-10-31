import { Metadata } from "next";
import { requireRole } from "@/modules/auth/auth-utils";
import { ensureRequestScope } from "@/lib/request-scope";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiStatCard } from "@/components/ui/kpi-stat-card";
import { glassPanel } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { Shield, ScrollText, Clock } from "lucide-react";

export const instant = false;

export const metadata: Metadata = {
  title: "Audit & Security — Brightloop",
  description: "Recent audit events from the database.",
};

export default async function AuditPage() {
  await ensureRequestScope();
  await requireRole(["admin"]);

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, table_name, record_id, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const entryCount = logs?.length ?? 0;
  const tablesTouched = new Set(logs?.map((l) => l.table_name).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit & security"
        description="Latest events recorded in audit_logs (read-only)."
        icon={Shield}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiStatCard
          title="Recent events"
          value={entryCount}
          subtitle="Last 50 entries loaded"
          icon={ScrollText}
          accent="blue"
        />
        <KpiStatCard
          title="Tables touched"
          value={tablesTouched}
          subtitle="Unique resources in view"
          icon={Shield}
          accent="violet"
          delay={0.05}
        />
        <KpiStatCard
          title="Retention window"
          value="50"
          subtitle="Rows per page (server limit)"
          icon={Clock}
          accent="slate"
          delay={0.1}
        />
      </div>

      <div className={cn(glassPanel(), "overflow-hidden")}>
        <div className="px-6 py-4 border-b border-slate-200/60">
          <h2 className="text-base font-semibold text-slate-900">Recent audit trail</h2>
          <p className="text-xs text-slate-500 mt-0.5">Administrators only</p>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!logs?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-slate-400 py-8">
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">{log.action}</TableCell>
                    <TableCell className="text-sm">
                      {log.table_name ?? "—"}
                      {log.record_id ? (
                        <span className="block text-xs text-slate-400 font-mono truncate max-w-[200px]">
                          {log.record_id}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500">
                      {log.user_id ?? "system"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
