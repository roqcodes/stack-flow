"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { KpiStatCard } from "@/components/ui/kpi-stat-card";
import { getFinancialOverviewAction } from "@/modules/analytics/actions";
import { FinancialAnalyticsData } from "@/modules/analytics/types";
import { glassPanel } from "@/lib/glass";
import { cn, formatCurrency } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  Repeat,
  Loader2,
  RotateCcw,
  Users,
  ShieldCheck,
  LineChart,
} from "lucide-react";

export default function AnalyticsPage() {
  const { error: toastError } = useToast();
  const [data, setData] = React.useState<FinancialAnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const result = await getFinancialOverviewAction();
        if (isMounted) {
          if (result.success && result.data) {
            setData(result.data);
          } else {
            toastError(result.error || "Failed to load revenue metrics");
          }
        }
      } catch {
        if (isMounted) {
          toastError("Network error while loading analytics");
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

  const metrics = data?.metrics;
  const trends = data?.trends ?? [];

  const collectionRate =
    metrics && metrics.totalInvoiced > 0
      ? Math.round((metrics.totalCollected / metrics.totalInvoiced) * 100)
      : 0;

  const outstandingPct =
    metrics && metrics.totalInvoiced > 0
      ? Math.round((metrics.unpaidInvoicesTotal / metrics.totalInvoiced) * 100)
      : 0;

  const chartData = trends.map((t) => ({
    month: t.month,
    Invoiced: t.invoiced,
    Collected: t.collected,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Revenue analytics"
        description="MRR, ARR, cash collection, churn, and invoicing trends from your live ledger."
        icon={LineChart}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStatCard
          title="Monthly recurring revenue"
          value={metrics ? formatCurrency(metrics.mrr) : formatCurrency(0)}
          subtitle={`${metrics?.activeSubscriptionsCount ?? 0} active subscriptions`}
          icon={Repeat}
          accent="blue"
        />
        <KpiStatCard
          title="Annual run rate (ARR)"
          value={metrics ? formatCurrency(metrics.arr) : formatCurrency(0)}
          subtitle="MRR × 12 annualized"
          icon={TrendingUp}
          accent="violet"
          delay={0.05}
        />
        <KpiStatCard
          title="Cash collected"
          value={metrics ? formatCurrency(metrics.totalCollected) : formatCurrency(0)}
          subtitle={`${collectionRate}% of ${metrics ? formatCurrency(metrics.totalInvoiced) : formatCurrency(0)} invoiced`}
          icon={DollarSign}
          accent="emerald"
          trend={{ value: collectionRate, label: "collection rate", direction: collectionRate >= 80 ? "up" : "neutral" }}
          delay={0.05}
        />
        <KpiStatCard
          title="Outstanding AR"
          value={metrics ? formatCurrency(metrics.unpaidInvoicesTotal) : formatCurrency(0)}
          subtitle={`${metrics?.overdueInvoicesCount ?? 0} overdue invoices`}
          icon={AlertCircle}
          accent="amber"
          trend={{
            value: outstandingPct,
            label: "of invoiced",
            direction: (metrics?.overdueInvoicesCount ?? 0) > 0 ? "down" : "up",
          }}
          delay={0.1}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(glassPanel(), "p-4 flex items-center justify-between gap-3")}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Calendar className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-slate-500">Renewals (30 days)</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                {metrics?.upcomingRenewalsCount ?? 0}
              </p>
            </div>
          </div>
          <Badge variant="outline">Scheduled</Badge>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={cn(glassPanel(), "p-4 flex items-center justify-between gap-3")}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Users className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-slate-500">Customer accounts</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                {metrics?.totalCustomersCount ?? 0}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-200 text-emerald-800 bg-emerald-50/80">
            Active base
          </Badge>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(glassPanel(), "p-4 flex items-center justify-between gap-3")}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-slate-500">Estimated churn</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                {metrics?.churnRatePercentage ?? 0}%
              </p>
            </div>
          </div>
          <Badge variant="secondary">Benchmark</Badge>
        </motion.div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className={cn(glassPanel(), "overflow-hidden")}
      >
        <div className="px-6 py-4 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" aria-hidden />
              Monthly revenue trend
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Invoiced volume vs settled collections
            </p>
          </div>
          <Badge variant="outline">Historical</Badge>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-label="Loading chart" />
            </div>
          ) : chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              No billing history recorded yet. Invoices and payments will populate this chart.
            </p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.1)" }}
                    formatter={(value) =>
                      typeof value === "number" ? formatCurrency(value) : String(value ?? "")
                    }
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(226,232,240,0.9)",
                      background: "rgba(255,255,255,0.92)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="Invoiced" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Collected" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
