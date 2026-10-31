"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SubscriptionWithDetails, SubscriptionPlan } from "@/modules/subscriptions/types";
import { submitPortalPlanChangeAction } from "../actions";
import { useToast } from "@/components/ui/toast";
import {
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
} from "lucide-react";

interface PlanChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: SubscriptionWithDetails;
  availablePlans: SubscriptionPlan[];
}

export function PlanChangeModal({
  open,
  onOpenChange,
  subscription,
  availablePlans,
}: PlanChangeModalProps) {
  if (!open) return null;

  return (
    <PlanChangeModalInner
      key={`${subscription.id}-${subscription.plan_id}-${subscription.quantity}`}
      open={open}
      onOpenChange={onOpenChange}
      subscription={subscription}
      availablePlans={availablePlans}
    />
  );
}

function PlanChangeModalInner({
  open,
  onOpenChange,
  subscription,
  availablePlans,
}: PlanChangeModalProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [selectedPlanId, setSelectedPlanId] = React.useState<string>(
    subscription.plan_id || (availablePlans[0]?.id ?? "")
  );
  const [quantity, setQuantity] = React.useState<number>(subscription.quantity || 1);
  const [timing, setTiming] = React.useState<"period_end" | "immediate">("period_end");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const selectedPlan =
    availablePlans.find((p) => p.id === selectedPlanId) || subscription.plan;

  const currentTotal = Number(subscription.total_amount);
  const newUnitPrice = selectedPlan ? Number(selectedPlan.price) : 0;
  const newTotal = Math.round((newUnitPrice * quantity + Number.EPSILON) * 100) / 100;
  const priceDiff = newTotal - currentTotal;

  const isCurrentPlanSelected = selectedPlanId === subscription.plan_id;
  const isUpgrade = priceDiff > 0 || (!isCurrentPlanSelected && newUnitPrice > Number(subscription.unit_price));
  const isDowngrade = priceDiff < 0;
  const isSamePlanAndQuantity = isCurrentPlanSelected && quantity === subscription.quantity;

  const handleSubmit = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const res = await submitPortalPlanChangeAction({
        subscriptionId: subscription.id,
        targetPlanId: selectedPlan.id,
        targetQuantity: quantity,
        immediately: timing === "immediate",
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        toastError(res.error.message);
        return;
      }

      if (timing === "immediate") {
        success(`Plan updated immediately to ${selectedPlan.name}.`);
      } else {
        success(
          `Plan change to ${selectedPlan.name} scheduled for your next renewal on ${formatDate(subscription.current_period_end)}.`
        );
      }

      onOpenChange(false);
      router.refresh();
    } catch {
      toastError("Failed to submit plan change request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Change Plan or Seats</DialogTitle>
              <DialogDescription>
                Upgrade, downgrade, or adjust licenses for subscription {subscription.subscription_number}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2 text-xs">
          {/* Plan Selection Cards */}
          <div>
            <label className="font-semibold text-slate-800 block mb-2">
              Select Subscription Plan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availablePlans.map((plan) => {
                const isCurrent = plan.id === subscription.plan_id;
                const isSelected = plan.id === selectedPlanId;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-3.5 border rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-500 shadow-2xs"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {plan.name}
                        </span>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1">
                        <span className="text-base font-extrabold text-slate-900">
                          {formatCurrency(Number(plan.price), plan.currency)}
                        </span>
                        <span className="text-[10px] text-slate-500 block capitalize">
                          per {plan.billing_cycle}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      <span>{plan.code}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seat Quantity Input */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-semibold text-slate-800 block">
                  Seats / License Quantity
                </label>
                <span className="text-[11px] text-slate-500 block">
                  Assign user seats to team members.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 text-xs font-bold"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || submitting}
                >
                  -
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-7 w-16 text-center text-xs font-semibold"
                  disabled={submitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 text-xs font-bold"
                  onClick={() => setQuantity((q) => q + 1)}
                  disabled={submitting}
                >
                  +
                </Button>
              </div>
            </div>
          </div>

          {/* Effective Timing Radio */}
          <div>
            <label className="font-semibold text-slate-800 block mb-1.5">
              Effective Date & Timing
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="planTiming"
                  checked={timing === "period_end"}
                  onChange={() => setTiming("period_end")}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                    At next renewal date ({formatDate(subscription.current_period_end)})
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-medium px-1.5 py-0.2 rounded">
                      Recommended
                    </span>
                  </span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Preserves your existing paid cycle. The new tier and billing amount start on your next renewal date.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="planTiming"
                  checked={timing === "immediate"}
                  onChange={() => setTiming("immediate")}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-semibold text-slate-900">
                    Apply change immediately
                  </span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Switches tier and provisioned licenses right now.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Internal Reference / Change Notes (Optional)
            </label>
            <Input
              placeholder="e.g. Scaling team, budget adjustment, project expansion..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Projected Financial Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-semibold text-slate-900 block text-xs">
              Projected Billing Summary
            </span>
            <div className="flex items-center justify-between text-slate-600">
              <span>Current Cycle Total:</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(currentTotal, subscription.currency)} / {subscription.billing_cycle}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>New Cycle Total ({quantity} seats):</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(newTotal, subscription.currency)} / {selectedPlan?.billing_cycle || subscription.billing_cycle}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Change Classification:</span>
              <div>
                {isUpgrade && (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    Tier Upgrade
                  </Badge>
                )}
                {isDowngrade && (
                  <Badge variant="secondary" className="text-[10px] gap-1 text-slate-600">
                    <ArrowDownRight className="h-3 w-3" />
                    Tier Downgrade
                  </Badge>
                )}
                {isSamePlanAndQuantity && (
                  <Badge variant="outline" className="text-[10px]">
                    No Change
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || isSamePlanAndQuantity}
          >
            {submitting ? "Submitting..." : timing === "immediate" ? "Apply Change Now" : "Schedule Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
