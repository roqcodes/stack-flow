"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SubscriptionWithDetails, SubscriptionPlan, PlanChangeRequest } from "@/modules/subscriptions/types";
import { SubscriptionStatusBadge } from "@/modules/subscriptions/components/subscription-status-badge";
import {
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  submitCancellationRequestAction,
  revokeCancellationRequestAction,
} from "@/modules/subscriptions/actions";
import { revokePortalPlanChangeAction } from "../actions";
import { PlanChangeModal } from "./plan-change-modal";
import {
  Layers,
  PauseCircle,
  PlayCircle,
  AlertCircle,
  Undo2,
  Sparkles,
} from "lucide-react";

interface PortalSubscriptionCardProps {
  subscription: SubscriptionWithDetails | null;
  availablePlans?: SubscriptionPlan[];
}

const CANCELLATION_REASONS = [
  "Pricing or budget constraints",
  "Switching to an alternative service",
  "Missing features or workflow capabilities",
  "Project ended / Company reorganization",
  "Technical issues or complexity",
  "Other reason",
];

export function PortalSubscriptionCard({
  subscription,
  availablePlans = [],
}: PortalSubscriptionCardProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [dialogState, setDialogState] = React.useState<{
    type: "pause" | "resume" | "cancel" | null;
    open: boolean;
  }>({ type: null, open: false });
  const [planChangeOpen, setPlanChangeOpen] = React.useState(false);

  // Form states
  const [reason, setReason] = React.useState(CANCELLATION_REASONS[0]);
  const [feedback, setFeedback] = React.useState("");
  const [cancelTiming, setCancelTiming] = React.useState<"period_end" | "immediate">("period_end");
  const [resumeTiming, setResumeTiming] = React.useState<"immediate" | "restore_unspent">("immediate");
  const [scheduledResumeDate, setScheduledResumeDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!subscription) {
    return (
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="py-12 text-center">
          <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">
            No Active Subscription
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You do not currently have an active recurring plan. Please contact sales or review pending quotations to activate service.
          </p>
        </CardContent>
      </Card>
    );
  }

  const meta = (subscription.metadata as Record<string, unknown> | undefined) || {};
  const isScheduledForCancel = meta.cancel_at_period_end === true;
  const scheduledPlanChange = meta.scheduled_plan_change as PlanChangeRequest | undefined;
  const isTerminal =
    subscription.status === "cancelled" || subscription.status === "expired";

  // Next billing countdown calculation
  const now = new Date();
  const nextBillingDate = new Date(subscription.next_billing_date);
  const diffTime = nextBillingDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const handleRevokePlanChange = async () => {
    setSubmitting(true);
    try {
      const res = await revokePortalPlanChangeAction({
        subscriptionId: subscription.id,
        notes: "Plan change revoked by customer in self-service portal",
      });

      if (!res.success) {
        toastError(res.error.message);
        return;
      }

      success("Scheduled plan change revoked. Your current plan tier will remain.");
      router.refresh();
    } catch {
      toastError("Failed to revoke plan change.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeCancellation = async () => {
    setSubmitting(true);
    try {
      const res = await revokeCancellationRequestAction({
        subscriptionId: subscription.id,
        notes: "Cancellation revoked by customer in self-service portal",
      });

      if (!res.success) {
        toastError(res.error.message);
        return;
      }

      success("Scheduled cancellation revoked. Your subscription will continue renewing normally.");
      router.refresh();
    } catch {
      toastError("Failed to revoke cancellation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async () => {
    setSubmitting(true);
    try {
      if (dialogState.type === "pause") {
        const res = await pauseSubscriptionAction({
          subscriptionId: subscription.id,
          reason: feedback || "Customer self-service pause",
          resumeScheduledAt: scheduledResumeDate || undefined,
        });
        if (!res.success) {
          toastError(res.error.message);
          return;
        }
        success("Subscription has been paused.");
      } else if (dialogState.type === "resume") {
        const res = await resumeSubscriptionAction({
          subscriptionId: subscription.id,
          resumeBillingNow: resumeTiming === "immediate",
        });
        if (!res.success) {
          toastError(res.error.message);
          return;
        }
        success(
          resumeTiming === "immediate"
            ? "Subscription resumed with new billing cycle started today."
            : "Subscription resumed with remaining unspent cycle days credited."
        );
      } else if (dialogState.type === "cancel") {
        const fullReason = reason === "Other reason" && feedback ? feedback : reason;
        const res = await submitCancellationRequestAction({
          subscriptionId: subscription.id,
          immediately: cancelTiming === "immediate",
          reason: fullReason,
          feedback: feedback || undefined,
        });

        if (!res.success) {
          toastError(res.error.message);
          return;
        }

        if (cancelTiming === "immediate") {
          success("Subscription has been terminated immediately.");
        } else {
          success(`Subscription will remain active until ${formatDate(subscription.current_period_end)} without further renewal charges.`);
        }
      }

      setDialogState({ type: null, open: false });
      setReason(CANCELLATION_REASONS[0]);
      setFeedback("");
      setScheduledResumeDate("");
      router.refresh();
    } catch {
      toastError("Failed to update subscription status.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                  Current Active Plan
                </span>
                <SubscriptionStatusBadge
                  status={subscription.lifecycle_status || subscription.status}
                />
              </div>
              <h2 className="text-2xl font-bold tracking-tight mt-1 text-white">
                {subscription.plan?.name || "Enterprise Tier"}
              </h2>
              <p className="text-xs text-blue-100 font-mono mt-0.5">
                Ref: {subscription.subscription_number}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-3xl font-extrabold text-white block">
                {formatCurrency(subscription.total_amount, subscription.currency)}
              </span>
              <span className="text-xs text-blue-200 capitalize">
                Billed {subscription.billing_cycle}
              </span>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Scheduled Plan Change Banner */}
          {scheduledPlanChange && (scheduledPlanChange.status === "scheduled" || scheduledPlanChange.status === "pending_approval") && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-indigo-950 block">
                    Plan Change Scheduled ({scheduledPlanChange.status === "pending_approval" ? "Pending Review" : `Effective ${formatDate(scheduledPlanChange.effective_date)}`})
                  </span>
                  <p className="text-indigo-800 text-[11px] mt-0.5">
                    Switching to tier <span className="font-semibold">{scheduledPlanChange.target_plan_name || "New Plan"}</span> with {scheduledPlanChange.target_quantity} licenses ({scheduledPlanChange.target_billing_cycle || subscription.billing_cycle}).
                    {scheduledPlanChange.notes ? ` Note: "${scheduledPlanChange.notes}"` : ""}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokePlanChange}
                disabled={submitting}
                className="border-indigo-300 text-indigo-900 hover:bg-indigo-100 shrink-0 text-xs font-semibold"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Revoke Plan Change
              </Button>
            </div>
          )}

          {/* Scheduled Cancellation Warning Banner */}
          {isScheduledForCancel && !isTerminal && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-950 block">
                    Cancellation Scheduled for End of Period ({formatDate(subscription.current_period_end)})
                  </span>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    Your services remain completely active until your billing cycle ends. No further renewal charges will be issued. You can reverse this anytime before this date.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeCancellation}
                disabled={submitting}
                className="border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0 text-xs font-semibold"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Revoke Cancellation
              </Button>
            </div>
          )}

          {/* Key Dates Grid with Next Billing Countdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block">Current Billing Period</span>
              <span className="font-semibold text-slate-900 mt-1 block">
                {formatDate(subscription.current_period_start)} — {formatDate(subscription.current_period_end)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 block">
                  {isScheduledForCancel ? "Access Expiration Date" : "Next Scheduled Renewal"}
                </span>
                {!isScheduledForCancel && !isTerminal && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      diffDays <= 0
                        ? "bg-rose-100 text-rose-700"
                        : diffDays <= 7
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {diffDays < 0
                      ? "Past due"
                      : diffDays === 0
                      ? "Due today"
                      : `${diffDays} days left`}
                  </span>
                )}
              </div>
              <span className={`font-semibold mt-1 block ${isScheduledForCancel ? "text-amber-600" : "text-blue-600"}`}>
                {formatDate(isScheduledForCancel ? subscription.current_period_end : subscription.next_billing_date)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block">Seats / Licenses</span>
              <span className="font-semibold text-slate-900 mt-1 block">
                {subscription.quantity} Active Seats
              </span>
            </div>
          </div>

          {/* Line items if any add-ons */}
          {subscription.items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Included Services & Add-ons
              </h4>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {subscription.items.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900 block">{item.description}</span>
                      <span className="text-slate-400 text-[11px]">Quantity: {item.quantity}</span>
                    </div>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(item.subtotal, subscription.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subscription.status === "paused" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Your subscription is currently paused. Recurring billing is on hold. You can resume at any time.
              </span>
            </div>
          )}
        </CardContent>

        {!isTerminal && (
          <CardFooter className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Need changes to your tier or billing cycle?
            </span>
            <div className="flex items-center gap-2">
              {subscription.status === "active" && !isScheduledForCancel && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPlanChangeOpen(true)}
                    className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Change Plan / Seats
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFeedback("");
                      setScheduledResumeDate("");
                      setDialogState({ type: "pause", open: true });
                    }}
                    className="text-xs"
                  >
                    <PauseCircle className="h-3.5 w-3.5 mr-1" />
                    Pause
                  </Button>
                </>
              )}

              {subscription.status === "paused" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setDialogState({ type: "resume", open: true })}
                  className="text-xs"
                >
                  <PlayCircle className="h-3.5 w-3.5 mr-1" />
                  Resume Subscription
                </Button>
              )}

              {!isScheduledForCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReason(CANCELLATION_REASONS[0]);
                    setFeedback("");
                    setCancelTiming("period_end");
                    setDialogState({ type: "cancel", open: true });
                  }}
                  className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Interactive Plan Change & Upgrade Modal */}
      <PlanChangeModal
        open={planChangeOpen}
        onOpenChange={setPlanChangeOpen}
        subscription={subscription}
        availablePlans={availablePlans}
      />

      {/* Confirmation & Action Dialog */}
      <Dialog
        open={dialogState.open}
        onOpenChange={(open) => !open && setDialogState({ type: null, open: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState.type === "pause" && "Pause Your Subscription"}
              {dialogState.type === "resume" && "Resume Your Subscription"}
              {dialogState.type === "cancel" && "Subscription Cancellation"}
            </DialogTitle>
            <DialogDescription>
              {dialogState.type === "pause" &&
                "Pausing your subscription puts recurring billing on hold while preserving your configurations and past invoices."}
              {dialogState.type === "resume" &&
                "Choose how you want to restore recurring billing cycles for your account."}
              {dialogState.type === "cancel" &&
                "We are sorry to see you go. Please choose when your cancellation takes effect and let us know why you are leaving."}
            </DialogDescription>
          </DialogHeader>

          {/* PAUSE DIALOG BODY */}
          {dialogState.type === "pause" && (
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Reason for Pause (Optional)
                </label>
                <Input
                  placeholder="e.g. Vacation, seasonal pause, budget hold..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Scheduled Auto-Resume Date (Optional)
                </label>
                <Input
                  type="date"
                  value={scheduledResumeDate}
                  onChange={(e) => setScheduledResumeDate(e.target.value)}
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Subject to your plan&apos;s maximum pause duration policies.
                </span>
              </div>
            </div>
          )}

          {/* RESUME DIALOG BODY */}
          {dialogState.type === "resume" && (
            <div className="space-y-3 py-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Billing Recalculation Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="resumeTiming"
                    checked={resumeTiming === "immediate"}
                    onChange={() => setResumeTiming("immediate")}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      Restart Billing Today (Recommended)
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      New full billing period starts immediately from today.
                    </span>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="resumeTiming"
                    checked={resumeTiming === "restore_unspent"}
                    onChange={() => setResumeTiming("restore_unspent")}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      Credit Remaining Unspent Days
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      Preserves unused days remaining in your cycle prior to pausing before issuing the next invoice.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* CANCEL DIALOG BODY */}
          {dialogState.type === "cancel" && (
            <div className="space-y-3.5 py-2 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Cancellation Timing
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="cancelTiming"
                      checked={cancelTiming === "period_end"}
                      onChange={() => setCancelTiming("period_end")}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        Cancel at end of current period
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-medium px-1.5 py-0.2 rounded">
                          Recommended
                        </span>
                      </span>
                      <span className="text-slate-500 text-[11px] block mt-0.5">
                        Retain access through {formatDate(subscription.current_period_end)}. No further charges will occur.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="cancelTiming"
                      checked={cancelTiming === "immediate"}
                      onChange={() => setCancelTiming("immediate")}
                      className="mt-0.5 text-rose-600"
                    />
                    <div>
                      <span className="font-semibold text-slate-900">
                        Cancel immediately (Early closure)
                      </span>
                      <span className="text-slate-500 text-[11px] block mt-0.5">
                        Terminates recurring services immediately today.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Primary Reason for Leaving
                </label>
                <select
                  className="w-full h-8 px-2.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {CANCELLATION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Additional Feedback (Optional)
                </label>
                <textarea
                  className="w-full p-2 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-16"
                  placeholder="How could we improve our product or service?"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDialogState({ type: null, open: false })}
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              variant={dialogState.type === "cancel" ? "destructive" : "primary"}
              onClick={handleAction}
              disabled={submitting}
            >
              {submitting ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

