"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Subscription, SubscriptionLifecycleStatus } from "../types";
import {
  transitionSubscriptionLifecycleAction,
  renewSubscriptionAction,
  closeSubscriptionAction,
  revokeCancellationRequestAction,
  resumeSubscriptionAction,
  pauseSubscriptionAction,
} from "../actions";
import {
  getAllowedLifecycleTransitions,
  resolveLifecycleStatus,
} from "../state-machine";
import { formatDate } from "@/lib/utils";
import {
  Eye,
  PauseCircle,
  PlayCircle,
  XCircle,
  Code2,
  CheckCircle2,
  Send,
  Undo2,
} from "lucide-react";

interface SubscriptionActionsMenuProps {
  subscription: Subscription;
  onInspectBilling?: (subscription: Subscription) => void;
}

export function SubscriptionActionsMenu({
  subscription,
  onInspectBilling,
}: SubscriptionActionsMenuProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const lifecycle =
    subscription.lifecycle_status ||
    resolveLifecycleStatus(subscription.status, subscription.metadata);

  const isScheduledForCancel =
    (subscription.metadata as Record<string, unknown> | undefined)?.cancel_at_period_end === true;

  const allowedTransitions = getAllowedLifecycleTransitions(lifecycle);

  const [dialogState, setDialogState] = React.useState<{
    type: SubscriptionLifecycleStatus | "renew" | null;
    open: boolean;
  }>({ type: null, open: false });

  const [reasonInput, setReasonInput] = React.useState("");
  const [closeImmediately, setCloseImmediately] = React.useState(true);
  const [resumeMode, setResumeMode] = React.useState<"immediate" | "restore_unspent">("immediate");
  const [scheduledResumeDate, setScheduledResumeDate] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOpenDialog = (type: SubscriptionLifecycleStatus | "renew") => {
    setReasonInput("");
    setCloseImmediately(true);
    setResumeMode("immediate");
    setScheduledResumeDate("");
    setDialogState({ type, open: true });
  };

  const handleCloseDialog = () => {
    setDialogState({ type: null, open: false });
    setReasonInput("");
  };

  const handleRevokeCancellation = async () => {
    setIsSubmitting(true);
    try {
      const res = await revokeCancellationRequestAction({
        subscriptionId: subscription.id,
        notes: "Revoked via administrative actions menu",
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
      setIsSubmitting(false);
    }
  };

  const executeAction = async () => {
    setIsSubmitting(true);
    try {
      if (dialogState.type === "renew") {
        const res = await renewSubscriptionAction({
          subscriptionId: subscription.id,
          advancePeriod: true,
        });
        if (!res.success) {
          toastError(res.error.message);
          return;
        }
        success("Subscription billing cycle renewed.");
      } else if (dialogState.type === "closed") {
        const res = await closeSubscriptionAction({
          subscriptionId: subscription.id,
          reason: reasonInput || (closeImmediately ? "Early closure" : "Closed at period end"),
          immediately: closeImmediately,
        });

        if (!res.success) {
          toastError(res.error.message);
          return;
        }

        if (closeImmediately) {
          success("Subscription closed immediately.");
        } else {
          success(`Subscription scheduled to close at period end (${formatDate(subscription.current_period_end)}).`);
        }
      } else if (dialogState.type === "paused") {
        const res = await pauseSubscriptionAction({
          subscriptionId: subscription.id,
          reason: reasonInput || "Administrative pause",
          resumeScheduledAt: scheduledResumeDate || undefined,
        });

        if (!res.success) {
          toastError(res.error.message);
          return;
        }
        success("Subscription paused.");
      } else if (dialogState.type === "active" && lifecycle === "paused") {
        const res = await resumeSubscriptionAction({
          subscriptionId: subscription.id,
          resumeBillingNow: resumeMode === "immediate",
        });

        if (!res.success) {
          toastError(res.error.message);
          return;
        }
        success("Subscription resumed.");
      } else if (dialogState.type) {
        const targetStatus = dialogState.type;
        const res = await transitionSubscriptionLifecycleAction({
          subscriptionId: subscription.id,
          targetStatus,
          reason:
            reasonInput ||
            `Transitioned to ${targetStatus} via administrative menu`,
        });

        if (!res.success) {
          toastError(res.error.message);
          return;
        }
        success(`Subscription status transitioned to ${targetStatus}.`);
      }

      handleCloseDialog();
      router.refresh();
    } catch {
      toastError("Failed to update subscription state.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Link href={`/subscriptions/${subscription.id}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-slate-600 hover:text-blue-600 text-xs"
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
        </Link>

        {onInspectBilling && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onInspectBilling(subscription)}
            className="h-7 px-2 text-slate-500 hover:text-slate-800"
            title="Inspect Member 4 Billing Contract"
          >
            <Code2 className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Revoke cancellation button if pending */}
        {isScheduledForCancel && lifecycle !== "closed" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevokeCancellation}
            disabled={isSubmitting}
            className="h-7 px-2 text-amber-700 hover:bg-amber-50 text-xs font-medium"
            title="Revoke Scheduled Cancellation"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Revoke Cancel
          </Button>
        )}

        {/* Dynamic Transition Action Buttons based on FSM */}
        {allowedTransitions.includes("quotation") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDialog("quotation")}
            className="h-7 px-2 text-indigo-600 hover:bg-indigo-50 text-xs"
            title="Send Quotation"
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            Quote
          </Button>
        )}

        {allowedTransitions.includes("confirmed") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDialog("confirmed")}
            className="h-7 px-2 text-sky-600 hover:bg-sky-50 text-xs"
            title="Confirm Subscription"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Confirm
          </Button>
        )}

        {allowedTransitions.includes("active") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDialog("active")}
            className="h-7 px-2 text-emerald-600 hover:bg-emerald-50 text-xs"
            title={lifecycle === "paused" ? "Resume Subscription" : "Activate Subscription"}
          >
            <PlayCircle className="h-3.5 w-3.5 mr-1" />
            {lifecycle === "paused" ? "Resume" : "Activate"}
          </Button>
        )}

        {allowedTransitions.includes("paused") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDialog("paused")}
            className="h-7 px-2 text-amber-600 hover:bg-amber-50 text-xs"
            title="Pause Subscription"
          >
            <PauseCircle className="h-3.5 w-3.5 mr-1" />
            Pause
          </Button>
        )}

        {allowedTransitions.includes("closed") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDialog("closed")}
            className="h-7 px-2 text-rose-500 hover:bg-rose-50 text-xs"
            title="Close / Cancel Subscription"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Confirmation & Reason Dialog */}
      <Dialog open={dialogState.open} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState.type === "quotation" && "Send Subscription Quotation"}
              {dialogState.type === "confirmed" && "Confirm Subscription"}
              {dialogState.type === "active" && (lifecycle === "paused" ? "Resume Subscription" : "Activate Subscription")}
              {dialogState.type === "paused" && "Pause Subscription"}
              {dialogState.type === "closed" && "Close / Cancel Subscription"}
              {dialogState.type === "renew" && "Renew Billing Cycle"}
            </DialogTitle>
            <DialogDescription>
              {dialogState.type === "quotation" &&
                `Publish and attach quotation review to subscription ${subscription.subscription_number}.`}
              {dialogState.type === "confirmed" &&
                `Confirm customer terms for ${subscription.subscription_number}. Awaits final activation.`}
              {dialogState.type === "active" &&
                (lifecycle === "paused"
                  ? `Choose billing schedule adjustment when resuming ${subscription.subscription_number}.`
                  : `Activating ${subscription.subscription_number} enables full production provisioning and scheduled recurring billing.`)}
              {dialogState.type === "paused" &&
                `Pausing ${subscription.subscription_number} suspends recurring billing engine generation until manually resumed (subject to plan pause policies).`}
              {dialogState.type === "closed" &&
                `Choose whether to terminate ${subscription.subscription_number} immediately or allow access until the end of the current paid billing cycle.`}
              {dialogState.type === "renew" &&
                `Manually advance billing period for ${subscription.subscription_number} to the next cycle interval.`}
            </DialogDescription>
          </DialogHeader>

          {/* Close Options: Early closure vs Period end */}
          {dialogState.type === "closed" && (
            <div className="space-y-3 py-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Closure Timing
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="closeTiming"
                    checked={closeImmediately}
                    onChange={() => setCloseImmediately(true)}
                    className="mt-0.5 text-rose-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">
                      Early Closure (Terminate Immediately)
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      Sets ended_at to now and stops service immediately.
                    </span>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="closeTiming"
                    checked={!closeImmediately}
                    onChange={() => setCloseImmediately(false)}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">
                      Automatic Closure at Period End ({formatDate(subscription.current_period_end)})
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      Keeps access active until current period end. Prevents renewal invoices.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Resume Options: Reset vs Restore unspent */}
          {dialogState.type === "active" && lifecycle === "paused" && (
            <div className="space-y-3 py-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Billing Cycle Recalculation
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="resumeMode"
                    checked={resumeMode === "immediate"}
                    onChange={() => setResumeMode("immediate")}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">
                      Reset Billing Interval Today
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      Restarts full billing cycle interval from today with calendar anchor preservation.
                    </span>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="resumeMode"
                    checked={resumeMode === "restore_unspent"}
                    onChange={() => setResumeMode("restore_unspent")}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">
                      Credit Remaining Unspent Days
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      Extends next billing date by the unused duration left before the pause occurred.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Pause Options: Optional scheduled auto-resume date */}
          {dialogState.type === "paused" && (
            <div className="py-1 text-xs">
              <label className="font-semibold text-slate-700 block mb-1">
                Scheduled Auto-Resume Date (Optional)
              </label>
              <Input
                type="date"
                value={scheduledResumeDate}
                onChange={(e) => setScheduledResumeDate(e.target.value)}
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Validated against plan max_pause_days.
              </span>
            </div>
          )}

          {(dialogState.type === "paused" || dialogState.type === "closed" || dialogState.type === "quotation") && (
            <div className="py-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Reason / Audit Note {dialogState.type === "closed" ? "(Required for audit)" : "(Optional)"}
              </label>
              <Input
                placeholder="e.g. Customer requested hold, terms negotiated, project freeze..."
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
              />
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
              Back
            </Button>
            <Button
              variant={dialogState.type === "closed" ? "destructive" : "primary"}
              onClick={executeAction}
              disabled={isSubmitting || (dialogState.type === "closed" && closeImmediately && reasonInput.trim().length < 3)}
            >
              {isSubmitting ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
