import * as React from "react";
import { CustomerPortalData } from "../types";
import { PortalSubscriptionCard } from "./portal-subscription-card";
import { PortalInvoicesCard } from "./portal-invoices-card";
import { PortalPaymentsCard } from "./portal-payments-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { SubscriptionStatusBadge } from "@/modules/subscriptions/components/subscription-status-badge";
import { PlanChangeRequest } from "@/modules/subscriptions/types";
import {
  Building2,
  Mail,
  MapPin,
  ShieldCheck,
  History,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface PortalOverviewProps {
  data: CustomerPortalData;
}

export function PortalOverview({ data }: PortalOverviewProps) {
  const {
    customer,
    activeSubscription,
    subscriptionHistory,
    invoices,
    payments,
    availablePlans,
  } = data;

  const planChangeHistory = (activeSubscription?.metadata?.plan_change_history as PlanChangeRequest[]) || [];

  return (
    <div className="space-y-6">
      {/* Organization Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-2xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {customer.company_name}
                </h1>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {customer.currency}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Customer Self-Service Portal • Account ID: {customer.id.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" className="text-xs gap-1.5 py-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Account Standing: Active
          </Badge>
        </div>
      </div>

      {/* Main Card: Active Subscription with Plan Details & Next Billing Date */}
      <PortalSubscriptionCard
        subscription={activeSubscription}
        availablePlans={availablePlans}
      />

      {/* Primary Financial Ledger: Invoices & Payment Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Read-only Invoice Statements */}
          <PortalInvoicesCard invoices={invoices} />

          {/* Payment Transactions History */}
          <PortalPaymentsCard payments={payments} />

          {/* Plan Change Requests Audit Log */}
          {planChangeHistory.length > 0 && (
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm font-semibold">
                      Plan Changes & Request History
                    </CardTitle>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {planChangeHistory.length} {planChangeHistory.length === 1 ? "request" : "requests"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-3 divide-y divide-slate-100 text-xs">
                {planChangeHistory.map((req) => (
                  <div key={req.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {req.target_plan_name || req.target_plan_id}
                        </span>
                        <Badge
                          variant={req.change_type === "upgrade" ? "success" : "secondary"}
                          className="text-[9px] gap-1 px-1.5 py-0"
                        >
                          {req.change_type === "upgrade" ? (
                            <ArrowUpRight className="h-2.5 w-2.5" />
                          ) : (
                            <ArrowDownRight className="h-2.5 w-2.5" />
                          )}
                          {req.change_type}
                        </Badge>
                        <span className="text-slate-400 text-[11px]">
                          ({req.target_quantity} seats)
                        </span>
                      </div>
                      <span className="text-slate-400 text-[11px] block mt-0.5">
                        Requested on {formatDate(req.requested_at)} • Effective: {formatDate(req.effective_date)}
                        {req.notes ? ` • Note: "${req.notes}"` : ""}
                      </span>
                    </div>

                    <div className="text-right">
                      {req.status === "applied" && (
                        <Badge variant="success" className="text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Applied
                        </Badge>
                      )}
                      {req.status === "scheduled" && (
                        <Badge variant="warning" className="text-[10px] gap-1">
                          <Clock className="h-3 w-3" />
                          Scheduled
                        </Badge>
                      )}
                      {req.status === "pending_approval" && (
                        <Badge variant="secondary" className="text-[10px] gap-1 text-amber-700 bg-amber-50">
                          <Clock className="h-3 w-3" />
                          Under Review
                        </Badge>
                      )}
                      {req.status === "revoked" && (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          Revoked
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Past Subscriptions if any */}
          {subscriptionHistory.length > 0 && (
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  <CardTitle className="text-sm font-semibold">
                    Past Subscriptions
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4 divide-y divide-slate-100 text-xs">
                {subscriptionHistory.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-medium text-slate-900 block">
                        {s.subscription_number}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Period: {formatDate(s.current_period_start)} — {formatDate(s.current_period_end)}
                      </span>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="font-semibold text-slate-900 block">
                        {formatCurrency(s.total_amount, s.currency)}
                      </span>
                      <SubscriptionStatusBadge
                        status={s.lifecycle_status || s.status}
                        className="text-[10px] py-0 px-1.5"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Registered Billing Profile */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold">
                Billing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 block">Contact Email</span>
                  <span>{customer.email}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 block">Primary Contact</span>
                  <span>{customer.contact_name}</span>
                </div>
              </div>

              {customer.business_number && (
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 block">Business Tax ID / EIN</span>
                    <span className="font-mono">{customer.business_number}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 block">Billing Address</span>
                  <span>
                    {[
                      customer.billing_address_line1,
                      customer.billing_city,
                      customer.billing_state,
                      customer.billing_postal_code,
                      customer.billing_country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "No address on file"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

