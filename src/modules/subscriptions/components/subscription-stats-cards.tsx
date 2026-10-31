import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { SubscriptionStats } from "../types";
import {
  Repeat,
  AlertCircle,
  PauseCircle,
  TrendingUp,
} from "lucide-react";

interface SubscriptionStatsCardsProps {
  stats: SubscriptionStats;
  onFilterDue?: () => void;
}

export function SubscriptionStatsCards({
  stats,
  onFilterDue,
}: SubscriptionStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Metric 1: Active Subscriptions */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Subscriptions
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {stats.activeCount}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {stats.trialingCount > 0 ? `+${stats.trialingCount} in active trial` : "Healthy standing"}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Repeat className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric 2: Due for Billing */}
      <Card
        className={`border-slate-200 shadow-2xs transition-colors ${
          stats.dueForBillingCount > 0
            ? "border-amber-200 bg-amber-50/20 cursor-pointer hover:bg-amber-50/40"
            : ""
        }`}
        onClick={onFilterDue}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Due for Billing
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-amber-900">
                {stats.dueForBillingCount}
              </h3>
              <p className="mt-1 text-xs text-amber-700 font-medium">
                {stats.dueForBillingCount > 0
                  ? "Cycle ready for billing engine"
                  : "All cycles up to date"}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric 3: Paused Subscriptions */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Paused Subscriptions
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {stats.pausedCount}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {stats.pastDueCount > 0
                  ? `${stats.pastDueCount} past due`
                  : "Temporary customer holds"}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <PauseCircle className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric 4: MRR Contribution */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Contract MRR
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(stats.monthlyRecurringRevenue)}
              </h3>
              <p className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Normalized recurring run-rate
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

