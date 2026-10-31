"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { getFinancialOverviewAction } from "@/modules/analytics/actions";
import { FinancialAnalyticsData } from "@/modules/analytics/types";
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
} from "lucide-react";

export default function AnalyticsPage() {
  const { error: toastError } = useToast();
  const [data, setData] = React.useState<FinancialAnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
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
  const trends = data?.trends || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Revenue Analytics & Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), cash collection, and churn.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} className="gap-1.5 text-xs">
          <RotateCcw className="h-3.5 w-3.5" /> Refresh Metrics
        </Button>
      </div>
        {/* Core KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Monthly Recurring Revenue (MRR)
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  ${metrics ? metrics.mrr.toFixed(2) : "0.00"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  normalized across {metrics?.activeSubscriptionsCount || 0} subscriptions
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Repeat className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Annual Recurring Revenue (ARR)
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ${metrics ? metrics.arr.toFixed(2) : "0.00"}
                </p>
                <p className="text-xs text-slate-400 mt-1">annualized run-rate (MRR × 12)</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Cash Collected
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  ${metrics ? metrics.totalCollected.toFixed(2) : "0.00"}
                </p>
                <p className="text-xs text-emerald-600/80 mt-1">
                  of ${metrics ? metrics.totalInvoiced.toFixed(2) : "0.00"} invoiced
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Outstanding Balance
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  ${metrics ? metrics.unpaidInvoicesTotal.toFixed(2) : "0.00"}
                </p>
                <p className="text-xs text-amber-600/80 mt-1">
                  {metrics?.overdueInvoicesCount || 0} overdue invoices
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Upcoming Renewals (30d)</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {metrics?.upcomingRenewalsCount || 0} Subscriptions
                  </p>
                </div>
              </div>
              <Badge variant="outline">Scheduled</Badge>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Active Customer Accounts</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {metrics?.totalCustomersCount || 0} Organizations
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                Healthy
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Estimated Churn Rate</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {metrics?.churnRatePercentage || 0}%
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Benchmark</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Performance Breakdown */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-slate-500" /> Monthly Revenue Trend
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Comparison between total billed invoicing volume and settled cash collections.
                </CardDescription>
              </div>
              <Badge variant="outline">Historical Invoicing</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : trends.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No billing history recorded yet.
              </div>
            ) : (
              <div className="space-y-6">
                {trends.map((t) => {
                  const maxVal = Math.max(t.invoiced, t.collected, 1);
                  const invoicedPct = Math.min(100, (t.invoiced / maxVal) * 100);
                  const collectedPct = Math.min(100, (t.collected / maxVal) * 100);

                  return (
                    <div key={t.month} className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-900">
                        <span>{t.month}</span>
                        <div className="flex gap-4">
                          <span className="text-blue-600 font-mono">
                            Invoiced: ${t.invoiced.toFixed(2)}
                          </span>
                          <span className="text-emerald-600 font-mono">
                            Collected: ${t.collected.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Bar Visualization */}
                      <div className="space-y-1">
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${invoicedPct}%` }}
                          />
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${collectedPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-6 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span>Invoiced Amount</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>Cash Collected</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
