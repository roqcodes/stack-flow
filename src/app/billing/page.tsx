"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { triggerBillingCycleAction, getBillingLogsAction } from "@/modules/billing/actions";
import { BillingLog } from "@/modules/billing/types";
import { BillingCycleSummary } from "@/modules/billing/billing-engine";
import {
  Layers,
  Play,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Clock,
  Terminal,
} from "lucide-react";

export default function BillingCommandCenterPage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [logs, setLogs] = React.useState<BillingLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isRunning, setIsRunning] = React.useState(false);
  const [dryRunMode, setDryRunMode] = React.useState(false);
  const [lastSummary, setLastSummary] = React.useState<BillingCycleSummary | null>(null);

  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const result = await getBillingLogsAction(50);
        if (isMounted) {
          if (result.success && result.data) {
            setLogs(result.data);
          } else {
            toastError(result.error || "Failed to load billing execution logs");
          }
        }
      } catch {
        if (isMounted) {
          toastError("Network error while loading billing logs");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, toastError]);

  const handleRunCycle = async () => {
    setIsRunning(true);
    try {
      const result = await triggerBillingCycleAction({
        dryRun: dryRunMode,
      });

      if (result.success && result.data) {
        setLastSummary(result.data);
        toastSuccess(
          `Cycle completed: ${result.data.successCount} invoiced, ${result.data.failureCount} failed (${result.data.isDryRun ? "Dry Run" : "Live"})`
        );
        setRefreshKey((k) => k + 1);
      } else {
        toastError(result.error || "Billing cycle failed");
      }
    } catch {
      toastError("Error executing billing cycle");
    } finally {
      setIsRunning(false);
    }
  };

  const getLogStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Success</Badge>;
      case "warning":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Warning</Badge>;
      case "failure":
        return <Badge variant="destructive">Failure</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing Engine & Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated recurring billing worker, batch invoicing cycles, duplicate billing locks, and transaction audit trail.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRunMode}
              onChange={(e) => setDryRunMode(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            Dry Run Mode
          </label>
          <Button onClick={handleRunCycle} disabled={isRunning} className="gap-2">
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processing Cycle...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Trigger Billing Cycle
              </>
            )}
          </Button>
        </div>
      </div>
        {/* Status Highlights */}
        {lastSummary && (
          <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-blue-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-xs text-blue-900">
                  Last Execution: {lastSummary.cycleRunId} ({lastSummary.isDryRun ? "Simulated Dry Run" : "Live Charge"})
                </span>
              </div>
              <span className="text-[11px] text-blue-600">
                Completed at {new Date(lastSummary.completedAt).toLocaleTimeString()}
              </span>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Subscriptions Due</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{lastSummary.totalDueProcessed}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Invoices Generated</p>
                <p className="text-xl font-bold text-emerald-600 mt-0.5">{lastSummary.successCount}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Failures</p>
                <p className="text-xl font-bold text-red-600 mt-0.5">{lastSummary.failureCount}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Total Billed</p>
                <p className="text-xl font-bold text-blue-600 mt-0.5">${lastSummary.totalInvoicedAmount.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Engine Operational Specs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Atomic Postgres Execution</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Invoicing, items, discount redemption, date advancement, and audit logs execute in a single ACID transaction.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Duplicate Billing Lock</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Enforced by <code>uq_subscription_period</code> constraint on <code>invoices</code>. Overlapping periods are blocked.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Deterministic Date Clamping</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Consumes Member 3 calendar utilities. Monthly leap and 31-day intervals clamp strictly without overflow.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Execution Logs */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Terminal className="h-4 w-4 text-slate-500" /> Billing Execution & Audit Logs
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Real-time operational stream from <code>public.billing_logs</code>.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setRefreshKey((k) => k + 1)} className="gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No billing logs recorded yet. Trigger a cycle to see operational activity.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Operational Message</TableHead>
                    <TableHead className="text-right">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/70">
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{getLogStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-800">
                        {log.message}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.payload ? (
                          <code className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {JSON.stringify(log.payload).substring(0, 45)}...
                          </code>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
