"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { SubscriptionWithDetails, PlanPermissions, PlanChangeRequest } from "../types";
import { SubscriptionStatusBadge } from "./subscription-status-badge";
import { SubscriptionActionsMenu } from "./subscription-actions-menu";
import { BillingPreviewModal } from "./billing-preview-modal";
import {
  getPlanPermissionsAction,
  revokeCancellationRequestAction,
  revokePlanChangeRequestAction,
  approvePlanChangeRequestAction,
} from "../actions";
import {
  Calendar,
  Building2,
  Layers,
  History,
  Clock,
  Code2,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  PauseCircle,
  Users,
  RotateCw,
  AlertCircle,
  Undo2,
  Sparkles,
} from "lucide-react";

interface SubscriptionDetailsCardProps {
  subscription: SubscriptionWithDetails;
}

export function SubscriptionDetailsCard({
  subscription,
}: SubscriptionDetailsCardProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [inspectOpen, setInspectOpen] = React.useState(false);
  const [planPermissions, setPlanPermissions] = React.useState<PlanPermissions | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [isRevokingPlanChange, setIsRevokingPlanChange] = React.useState(false);
  const [isApprovingPlanChange, setIsApprovingPlanChange] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    if (subscription.plan_id) {
      getPlanPermissionsAction(subscription.plan_id).then((res) => {
        if (isMounted && res.success) {
          setPlanPermissions(res.data);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [subscription.plan_id]);

  const meta = (subscription.metadata as Record<string, unknown>) || {};
  const lifecycle = subscription.lifecycle_status || subscription.status;
  const scheduledCancellation = meta.scheduled_cancellation as
    | { reason?: string; feedback?: string; requested_at?: string }
    | undefined;

  const scheduledPlanChange = meta.scheduled_plan_change as PlanChangeRequest | undefined;
  const pendingPlanChange = meta.pending_plan_change as PlanChangeRequest | undefined;
  const planChangeHistory = (meta.plan_change_history as PlanChangeRequest[]) || [];

  const now = new Date();
  const nextBillingDate = new Date(subscription.next_billing_date);
  const diffDays = Math.ceil((nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const handleRevokeCancellation = async () => {
    setIsRevoking(true);
    try {
      const res = await revokeCancellationRequestAction({
        subscriptionId: subscription.id,
        notes: "Revoked from subscription details overview",
      });
      if (!res.success) {
        toastError(res.error.message);
        return;
      }
      success("Scheduled cancellation revoked. Subscription will continue renewing.");
      router.refresh();
    } catch {
      toastError("Failed to revoke cancellation.");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRevokePlanChange = async () => {
    setIsRevokingPlanChange(true);
    try {
      const res = await revokePlanChangeRequestAction({
        subscriptionId: subscription.id,
        notes: "Revoked from subscription details overview",
      });
      if (!res.success) {
        toastError(res.error.message);
        return;
      }
      success("Plan change request revoked.");
      router.refresh();
    } catch {
      toastError("Failed to revoke plan change.");
    } finally {
      setIsRevokingPlanChange(false);
    }
  };

  const handleApprovePlanChange = async () => {
    setIsApprovingPlanChange(true);
    try {
      const res = await approvePlanChangeRequestAction({
        subscriptionId: subscription.id,
        notes: "Approved by administrator from subscription details view",
      });
      if (!res.success) {
        toastError(res.error.message);
        return;
      }
      success("Plan change request approved and applied.");
      router.refresh();
    } catch {
      toastError("Failed to approve plan change.");
    } finally {
      setIsApprovingPlanChange(false);
    }
  };
  const statusHistory =
    (meta.status_history as Array<{
      from: string;
      to: string;
      at: string;
      reason?: string;
      actorRole?: string;
    }>) || [];
  const pauseHistory =
    (meta.pause_history as Array<{ paused_at: string; reason?: string }>) || [];
  const renewHistory =
    (meta.renew_history as Array<{
      renewal_id?: string;
      cycle_number?: number;
      renewed_at: string;
      previous_period_start?: string;
      previous_period_end?: string;
      new_period_start?: string;
      new_period_end: string;
      invoice_id?: string;
      amount_paid?: number;
      idempotency_key?: string;
      actor_role?: string;
      notes?: string;
    }>) || [];
  const periodHistory =
    (meta.period_history as Array<{
      period_index: number;
      period_start: string;
      period_end: string;
      archived_at: string;
      total_amount: number;
      currency: string;
      invoice_id?: string;
    }>) || [];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/subscriptions"
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 -ml-1 rounded-md"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {subscription.subscription_number}
            </h1>
            <SubscriptionStatusBadge
              status={subscription.lifecycle_status || subscription.status}
            />
          </div>
          <p className="text-xs text-slate-500 pl-6">
            Created on {formatDate(subscription.created_at)} • Customer:{" "}
            <span className="font-medium text-slate-700">
              {subscription.customer?.company_name || "Unknown"}
            </span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInspectOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Code2 className="h-4 w-4 text-blue-600" />
            Inspect Billing Contract
          </Button>
          <SubscriptionActionsMenu
            subscription={subscription}
            onInspectBilling={() => setInspectOpen(true)}
          />
        </div>
      </div>

      {/* Scheduled Cancellation Warning Banner */}
      {meta.cancel_at_period_end === true && subscription.status !== "cancelled" && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-950 block text-sm">
                Automatic Closure Scheduled for Period End ({formatDate(subscription.current_period_end)})
              </span>
              <p className="text-amber-800 text-xs mt-0.5">
                This subscription will automatically close when the current billing cycle ends. Renewal invoices are suspended.
                {scheduledCancellation?.reason && (
                  <span className="block mt-1 font-medium">
                    Reason: {scheduledCancellation.reason}
                    {scheduledCancellation.feedback ? ` • Feedback: "${scheduledCancellation.feedback}"` : ""}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeCancellation}
            disabled={isRevoking}
            className="border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0 text-xs font-semibold"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Revoke Cancellation
          </Button>
        </div>
      )}

      {/* Paused Standing Notice */}
      {lifecycle === "paused" && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
          <PauseCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-950 block text-sm">
              Subscription is Currently Paused
            </span>
            <p className="text-amber-800 text-xs mt-0.5">
              Recurring billing execution is paused. Unspent days will be credited when resumed.
              {meta.paused_at ? ` Paused on: ${formatDate(meta.paused_at as string)}.` : ""}
              {meta.resume_scheduled_at ? ` Scheduled auto-resume: ${formatDate(meta.resume_scheduled_at as string)}.` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Scheduled Plan Change Banner */}
      {scheduledPlanChange && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-indigo-950 block text-sm">
                Plan Change Scheduled for Period End ({formatDate(subscription.current_period_end)})
              </span>
              <p className="text-indigo-800 text-xs mt-0.5">
                Target Plan: <strong>{scheduledPlanChange.target_plan_name}</strong> ({scheduledPlanChange.target_quantity} seats @ {formatCurrency(scheduledPlanChange.target_price, subscription.currency)})
                <span className="block mt-0.5">
                  Type: <span className="capitalize font-medium">{scheduledPlanChange.change_type.replace("_", " ")}</span>
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokePlanChange}
            disabled={isRevokingPlanChange}
            className="border-indigo-300 text-indigo-900 hover:bg-indigo-100 shrink-0 text-xs font-semibold"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Revoke Change
          </Button>
        </div>
      )}

      {/* Pending Approval Plan Change Banner */}
      {pendingPlanChange && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-purple-950 block text-sm">
                Plan Change Pending Staff Approval
              </span>
              <p className="text-purple-800 text-xs mt-0.5">
                Customer requested {pendingPlanChange.change_type.replace("_", " ")} to{" "}
                <strong>{pendingPlanChange.target_plan_name}</strong> ({pendingPlanChange.target_quantity} seats).
                {pendingPlanChange.notes && (
                  <span className="block mt-0.5 italic">
                    Note: &quot;{pendingPlanChange.notes}&quot;
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokePlanChange}
              disabled={isRevokingPlanChange}
              className="border-purple-300 text-purple-900 hover:bg-purple-100 text-xs"
            >
              Reject
            </Button>
            <Button
              size="sm"
              onClick={handleApprovePlanChange}
              disabled={isApprovingPlanChange}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Approve Change
            </Button>
          </div>
        </div>
      )}

      {/* Financial Summary & Key Dates Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Cycle Financials */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Billing Amounts</span>
              <span className="text-xs font-normal text-slate-400 font-mono uppercase">
                {subscription.currency}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Plan Base Price ({subscription.quantity}x)</span>
              <span>{formatCurrency(subscription.subtotal, subscription.currency)}</span>
            </div>
            {subscription.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Applied Discount</span>
                <span>-{formatCurrency(subscription.discount_amount, subscription.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Jurisdiction Tax</span>
              <span>{formatCurrency(subscription.tax_amount, subscription.currency)}</span>
            </div>
            <div className="border-t border-slate-100 pt-2.5 flex justify-between font-bold text-sm text-slate-900">
              <span>Cycle Total</span>
              <span>{formatCurrency(subscription.total_amount, subscription.currency)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Billing Schedule */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Billing Schedule</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Frequency:</span>
              <span className="font-semibold text-slate-900 capitalize">
                {subscription.billing_cycle}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Period Start:</span>
              <span className="font-medium text-slate-900">
                {formatDate(subscription.current_period_start)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Period End:</span>
              <span className="font-medium text-slate-900">
                {formatDate(subscription.current_period_end)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2.5 items-center">
              <span className="text-slate-900 font-semibold">Next Invoice Run:</span>
              <div className="text-right">
                <span className="font-bold text-blue-600 block">
                  {formatDate(subscription.next_billing_date)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {diffDays <= 0 ? "Due today" : `${diffDays} days left`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Customer Standing */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span>Account & Contact</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Organization
              </span>
              <span className="font-semibold text-slate-900 text-sm">
                {subscription.customer?.company_name || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Billing Contact
              </span>
              <span>
                {subscription.customer?.contact_name} ({subscription.customer?.email})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Billing Address
              </span>
              <span>
                {[
                  subscription.customer?.billing_address_line1,
                  subscription.customer?.billing_city,
                  subscription.customer?.billing_country,
                ]
                  .filter(Boolean)
                  .join(", ") || "No address on file"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Details & Attached Items */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <span>Plan Configuration & Line Items</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item / Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Line Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Primary Base Plan Row */}
              <TableRow className="bg-slate-50/50">
                <TableCell>
                  <div className="font-semibold text-xs text-slate-900">
                    {subscription.plan?.name || "Base Plan"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Code: {subscription.plan?.code || "N/A"}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    Base Tier
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-xs">
                  {subscription.quantity}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {formatCurrency(subscription.unit_price, subscription.currency)}
                </TableCell>
                <TableCell className="text-right font-semibold text-xs text-slate-900">
                  {formatCurrency(subscription.subtotal, subscription.currency)}
                </TableCell>
              </TableRow>

              {/* Add-ons */}
              {subscription.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium text-xs text-slate-800">
                      {item.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      Add-on Item
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                  <TableCell className="text-right text-xs">
                    {formatCurrency(item.unit_price, subscription.currency)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-xs text-slate-900">
                    {formatCurrency(item.subtotal, subscription.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Plan Rules & Permissions Card */}
      {planPermissions && (
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Plan Rules & Governance Policies</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Seat Allocation / Limit
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <Users className="h-4 w-4 text-slate-600" />
                <span className="font-bold text-slate-900 text-sm">
                  {subscription.quantity} seats
                </span>
                <span className="text-slate-500">
                  {planPermissions.seatLimit !== null
                    ? `/ max ${planPermissions.seatLimit}`
                    : "(Unlimited)"}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Pause Permission
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <PauseCircle
                  className={`h-4 w-4 ${
                    planPermissions.allowPause ? "text-emerald-600" : "text-rose-600"
                  }`}
                />
                <span className="font-bold text-slate-900 text-sm">
                  {planPermissions.allowPause ? "Allowed" : "Prohibited"}
                </span>
                {planPermissions.maxPauseDays && (
                  <span className="text-slate-500">
                    (Max {planPermissions.maxPauseDays}d)
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Approval Required
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span className="font-bold text-slate-900 text-sm">
                  {planPermissions.requiresApproval ? "Yes (Staff)" : "Automatic"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preserved Previous Subscription Periods */}
      {periodHistory.length > 0 && (
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <RotateCw className="h-4 w-4 text-blue-600" />
                <span>Preserved Previous Subscription Periods</span>
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {periodHistory.length} Previous Cycles
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Cycle</TableHead>
                  <TableHead>Billing Period Range</TableHead>
                  <TableHead>Archived At</TableHead>
                  <TableHead className="text-right">Billed Amount</TableHead>
                  <TableHead className="text-right">Invoice Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodHistory.map((period) => (
                  <TableRow key={period.period_index}>
                    <TableCell className="font-mono text-xs font-semibold">
                      #{period.period_index}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDate(period.period_start)} &rarr; {formatDate(period.period_end)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(period.archived_at)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-xs">
                      {formatCurrency(period.total_amount, period.currency)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-400 font-mono">
                      {period.invoice_id ? period.invoice_id.slice(0, 8) : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Plan Change Audit History */}
      {planChangeHistory.length > 0 && (
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span>Plan & Seat Change Audit History</span>
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {planChangeHistory.length} Record{planChangeHistory.length > 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested Plan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planChangeHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-slate-900">
                        {item.target_plan_name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Requested {formatDate(item.requested_at)} ({item.requester_role})
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {item.change_type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {item.target_quantity}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatCurrency(item.target_price, subscription.currency)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {item.immediately ? "Immediate" : formatDate(item.effective_date)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          item.status === "applied"
                            ? "default"
                            : item.status === "scheduled"
                            ? "secondary"
                            : item.status === "pending_approval"
                            ? "outline"
                            : "destructive"
                        }
                        className="text-[10px] capitalize"
                      >
                        {item.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Lifecycle History / Audit Trail */}
      {(statusHistory.length > 0 ||
        pauseHistory.length > 0 ||
        renewHistory.length > 0 ||
        subscription.cancel_reason) && (
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              <span>Lifecycle State Transitions & Renewal History</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            {subscription.cancel_reason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
                <span className="font-semibold block">Cancellation / Closure Reason:</span>
                <p className="mt-0.5 text-xs text-rose-800">{subscription.cancel_reason}</p>
                <span className="text-[10px] text-rose-600 mt-1 block">
                  Closed at {formatDate(subscription.cancelled_at)}
                </span>
              </div>
            )}

            {/* FSM Status Transitions History */}
            {statusHistory.map((s, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100"
              >
                <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 capitalize">
                      {s.from} &rarr; {s.to}
                    </span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                      {s.actorRole || "system"}
                    </Badge>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {formatDate(s.at)}
                    </span>
                  </div>
                  {s.reason && (
                    <p className="text-[11px] text-slate-600 mt-0.5">{s.reason}</p>
                  )}
                </div>
              </div>
            ))}

            {pauseHistory.map((p, idx) => (
              <div key={`pause-${idx}`} className="flex items-center gap-2 text-slate-600">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>
                  Paused on <strong>{formatDate(p.paused_at)}</strong>: {p.reason || "No reason recorded"}
                </span>
              </div>
            ))}

            {/* Renewal Cycles History */}
            {renewHistory.map((r, idx) => (
              <div
                key={`renew-${idx}`}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100"
              >
                <RotateCw className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-emerald-900">
                      Renewal Cycle #{r.cycle_number || idx + 1}
                    </span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 bg-white text-emerald-700 border-emerald-200">
                      Success
                    </Badge>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {formatDate(r.renewed_at)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Extended to <strong>{formatDate(r.new_period_end)}</strong>
                    {r.previous_period_start && r.previous_period_end && (
                      <span className="text-slate-400 ml-1">
                        (Previous period: {formatDate(r.previous_period_start)} &rarr; {formatDate(r.previous_period_end)})
                      </span>
                    )}
                  </div>
                  {r.idempotency_key && (
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Idempotency Key: {r.idempotency_key}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Billing Contract Inspector Modal */}
      <BillingPreviewModal
        subscription={subscription}
        open={inspectOpen}
        onOpenChange={setInspectOpen}
      />
    </div>
  );
}
