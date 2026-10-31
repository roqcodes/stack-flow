"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/utils";
import { SubscriptionStats } from "../types";
import {
  Repeat,
  AlertCircle,
  PauseCircle,
  TrendingUp,
} from "lucide-react";
import { KpiStatCard } from "@/components/ui/kpi-stat-card";

interface SubscriptionStatsCardsProps {
  stats: SubscriptionStats;
  onFilterDue?: () => void;
}

export function SubscriptionStatsCards({
  stats,
  onFilterDue,
}: SubscriptionStatsCardsProps) {
  const total = stats.totalSubscriptions || 0;
  const activePct = total ? Math.round((stats.activeCount / total) * 100) : 0;
  const duePct = total ? Math.round((stats.dueForBillingCount / total) * 100) : 0;
  const pausedPct = total ? Math.round((stats.pausedCount / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiStatCard
        title="Active subscriptions"
        value={stats.activeCount}
        subtitle={
          stats.trialingCount > 0
            ? `${stats.trialingCount} in trial · ${total} total`
            : `${total} subscriptions on file`
        }
        icon={Repeat}
        accent="blue"
        trend={{ value: activePct, label: "of portfolio", direction: activePct >= 60 ? "up" : "neutral" }}
        delay={0}
      />

      {stats.dueForBillingCount > 0 && onFilterDue ? (
        <button
          type="button"
          onClick={onFilterDue}
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-2xl"
        >
          <KpiStatCard
            title="Due for billing"
            value={stats.dueForBillingCount}
            subtitle="Cycles ready for the billing engine"
            icon={AlertCircle}
            accent="amber"
            trend={{ value: duePct, label: "of subs", direction: "down" }}
            delay={0.05}
            className="border-amber-200/80 hover:border-amber-300/90"
          />
        </button>
      ) : (
        <KpiStatCard
          title="Due for billing"
          value={stats.dueForBillingCount}
          subtitle="All billing cycles up to date"
          icon={AlertCircle}
          accent="amber"
          trend={{ value: duePct, label: "of subs", direction: "up" }}
          delay={0.05}
        />
      )}

      <KpiStatCard
        title="Paused"
        value={stats.pausedCount}
        subtitle={
          stats.pastDueCount > 0
            ? `${stats.pastDueCount} past due accounts`
            : "Temporary customer holds"
        }
        icon={PauseCircle}
        accent="slate"
        trend={{ value: pausedPct, label: "paused share", direction: "neutral" }}
        delay={0.1}
      />

      <KpiStatCard
        title="Contract MRR"
        value={formatCurrency(stats.monthlyRecurringRevenue)}
        subtitle="Normalized recurring run-rate"
        icon={TrendingUp}
        accent="emerald"
        trend={{
          value: activePct,
          label: "active base",
          direction: stats.monthlyRecurringRevenue > 0 ? "up" : "neutral",
        }}
        delay={0.15}
      />
    </div>
  );
}
