"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  Package,
  FileSpreadsheet,
  Repeat,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { KpiStatCard } from "@/components/ui/kpi-stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { glassPanel } from "@/lib/glass";
import type { OperationalOverview } from "@/modules/dashboard/actions";
import { formatCurrency, formatDate, getStatusBadgeVariant } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface HomeDashboardProps {
  data: OperationalOverview | null;
  errorMessage?: string;
}

export function HomeDashboard({ data, errorMessage }: HomeDashboardProps) {
  if (errorMessage || !data) {
    return (
      <div className={cn(glassPanel(), "border-red-200/80 bg-red-50/80 p-6 text-sm text-red-800")}>
        Unable to load dashboard: {errorMessage ?? "Unknown error"}
      </div>
    );
  }

  const openQuotes = data.quotations.sent + data.quotations.draft;
  const productsActivePct = data.products.total
    ? Math.round((data.products.active / data.products.total) * 100)
    : 0;

  const pipelineHasData = data.quotationPipeline.some((d) => d.value > 0);
  const subHasData = data.subscriptionMix.some((d) => d.value > 0);

  return (
    <div className="space-y-8">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600/90">
            Operations
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Business overview
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Live metrics from your catalog, pipeline, subscriptions, and receivables.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50/80 text-emerald-800">
          Synced with database
        </Badge>
      </motion.header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiStatCard
          title="Active customers"
          value={data.customers.active}
          subtitle={`${data.customers.total} organizations on file`}
          icon={Users}
          href="/customers"
          accent="blue"
          trend={{
            value: data.derived.customerActivePct,
            label: "active rate",
            direction: data.derived.customerActivePct >= 70 ? "up" : "neutral",
          }}
          delay={0}
        />
        <KpiStatCard
          title="Catalog products"
          value={data.products.active}
          subtitle={`${data.products.total} total SKUs`}
          icon={Package}
          href="/products"
          accent="violet"
          trend={{
            value: productsActivePct,
            label: "active share",
            direction: productsActivePct >= 80 ? "up" : "neutral",
          }}
          delay={0.05}
        />
        <KpiStatCard
          title="Open quotations"
          value={openQuotes}
          subtitle={`${data.quotations.accepted} accepted · ${data.derived.quotationAcceptancePct}% win rate`}
          icon={FileSpreadsheet}
          href="/quotations"
          accent="emerald"
          trend={{
            value: data.derived.quotationAcceptancePct,
            label: "acceptance",
            direction: data.derived.quotationAcceptancePct >= 25 ? "up" : "neutral",
          }}
          delay={0.1}
        />
        <KpiStatCard
          title="Active subscriptions"
          value={data.subscriptions.active}
          subtitle={`${data.subscriptions.past_due} past due · ${data.derived.subscriptionHealthPct}% healthy`}
          icon={Repeat}
          href="/subscriptions"
          accent="blue"
          trend={{
            value: data.derived.subscriptionHealthPct,
            label: "active mix",
            direction:
              data.subscriptions.past_due > 0
                ? "down"
                : data.derived.subscriptionHealthPct >= 80
                  ? "up"
                  : "neutral",
          }}
          delay={0.15}
        />
        <KpiStatCard
          title="Open invoices"
          value={data.invoices.open}
          subtitle={`${data.invoices.overdue} overdue · ${data.derived.invoiceOverduePct}% of open AR`}
          icon={Receipt}
          href="/invoices"
          accent="amber"
          trend={{
            value: data.derived.invoiceOverduePct,
            label: "overdue share",
            direction: data.invoices.overdue > 0 ? "down" : "up",
          }}
          delay={0.2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className={cn(glassPanel(), "p-6")}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Quotation pipeline</h2>
              <p className="text-xs text-slate-500 mt-0.5">Status distribution across sales quotes</p>
            </div>
            <Link
              href="/quotations"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {!pipelineHasData ? (
            <p className="text-sm text-slate-400 py-16 text-center">No quotations yet.</p>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.quotationPipeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.12)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(226,232,240,0.9)",
                      background: "rgba(255,255,255,0.92)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {data.quotationPipeline.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className={cn(glassPanel(), "p-6")}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Subscription health</h2>
              <p className="text-xs text-slate-500 mt-0.5">Active, trial, and at-risk accounts</p>
            </div>
            <Link
              href="/subscriptions"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              Manage <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {!subHasData ? (
            <p className="text-sm text-slate-400 py-16 text-center">No subscriptions yet.</p>
          ) : (
            <div className="h-[240px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.subscriptionMix.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth={2}
                  >
                    {data.subscriptionMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(226,232,240,0.9)",
                      background: "rgba(255,255,255,0.92)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="hidden sm:block space-y-2 text-xs text-slate-600 min-w-[120px]">
                {data.subscriptionMix.map((s) => (
                  <li key={s.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="flex-1">{s.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className={cn(glassPanel(), "overflow-hidden")}
      >
        <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent quotations</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest activity in your sales pipeline</p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200/60 hover:bg-transparent">
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.recentQuotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-slate-400 py-10">
                  No quotations yet.{" "}
                  <Link href="/quotations" className="text-blue-600 hover:underline font-medium">
                    Create your first quote
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              data.recentQuotations.map((q) => (
                <TableRow key={q.id} className="border-slate-100/80">
                  <TableCell>
                    <Link
                      href={`/quotations/${q.id}`}
                      className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                    >
                      {q.quotation_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-700">{q.company_name ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(q.total_amount, q.currency)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 tabular-nums">
                    {formatDate(q.valid_until)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(q.status)}>{q.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </motion.section>
    </div>
  );
}
