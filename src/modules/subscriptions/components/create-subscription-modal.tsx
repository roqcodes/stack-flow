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
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  getAcceptedQuotationsForConversionAction,
  getActivePlansAndCustomersAction,
  createSubscriptionFromQuotationAction,
  createDirectSubscriptionAction,
} from "../actions";
import { FileSpreadsheet, PackagePlus, ArrowRight } from "lucide-react";

interface CreateSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSubscriptionModal({
  open,
  onOpenChange,
}: CreateSubscriptionModalProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = React.useState<"quotation" | "direct">("quotation");
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Quotation mode state
  const [quotations, setQuotations] = React.useState<
    Array<{
      id: string;
      quotation_number: string;
      customer_id: string;
      customer_name: string;
      total_amount: number;
      currency: string;
      valid_until: string;
      accepted_at: string | null;
    }>
  >([]);
  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string>("");

  // Direct mode state
  const [catalog, setCatalog] = React.useState<{
    customers: Array<{ id: string; company_name: string; email: string }>;
    plans: Array<{
      id: string;
      name: string;
      code: string;
      price: number;
      billing_cycle: string;
      trial_period_days: number;
    }>;
  }>({ customers: [], plans: [] });

  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [selectedPlanId, setSelectedPlanId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [initialStatus, setInitialStatus] = React.useState<"draft" | "active">("active");

  React.useEffect(() => {
    if (!open) return;
    let isMounted = true;

    async function loadInitial() {
      try {
        const [quoteRes, catRes] = await Promise.all([
          getAcceptedQuotationsForConversionAction(),
          getActivePlansAndCustomersAction(),
        ]);

        if (isMounted) {
          if (quoteRes.success) {
            setQuotations(quoteRes.data);
            if (quoteRes.data.length > 0) {
              setSelectedQuoteId(quoteRes.data[0].id);
            }
          }

          if (catRes.success) {
            setCatalog(catRes.data);
            if (catRes.data.customers.length > 0) {
              setSelectedCustomerId(catRes.data.customers[0].id);
            }
            if (catRes.data.plans.length > 0) {
              setSelectedPlanId(catRes.data.plans[0].id);
            }
          }
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInitial();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleConvertQuotation = async () => {
    if (!selectedQuoteId) return;
    setSubmitting(true);
    try {
      const res = await createSubscriptionFromQuotationAction({
        quotationId: selectedQuoteId,
      });

      if (!res.success) {
        toastError(res.error.message);
        return;
      }

      success(`Quotation converted to subscription ${res.data.subscription_number}!`);
      onOpenChange(false);
      router.refresh();
      router.push(`/subscriptions/${res.data.id}`);
    } catch {
      toastError("Failed to convert quotation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDirect = async () => {
    if (!selectedCustomerId || !selectedPlanId) return;
    setSubmitting(true);
    try {
      const res = await createDirectSubscriptionAction({
        customerId: selectedCustomerId,
        planId: selectedPlanId,
        quantity,
        initialStatus,
      });

      if (!res.success) {
        toastError(res.error.message);
        return;
      }

      success(`Created subscription ${res.data.subscription_number}!`);
      onOpenChange(false);
      router.refresh();
      router.push(`/subscriptions/${res.data.id}`);
    } catch {
      toastError("Failed to create subscription.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = catalog.plans.find((p) => p.id === selectedPlanId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create New Subscription</DialogTitle>
          <DialogDescription>
            Provision an active subscription by converting an accepted sales quote or assigning a catalog plan.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab("quotation")}
            className={`py-2 rounded-md transition-all flex items-center justify-center gap-2 ${
              activeTab === "quotation"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            From Accepted Quotation
            {quotations.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {quotations.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("direct")}
            className={`py-2 rounded-md transition-all flex items-center justify-center gap-2 ${
              activeTab === "direct"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <PackagePlus className="h-4 w-4 text-blue-600" />
            Direct Plan Assignment
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Loading catalog data and accepted quotations...
          </div>
        ) : (
          <div className="py-2 space-y-4">
            {activeTab === "quotation" ? (
              <div>
                {quotations.length === 0 ? (
                  <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <FileSpreadsheet className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-800">
                      No Accepted Quotations Pending Conversion
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      All accepted sales quotes have already been provisioned into subscriptions, or none are currently accepted.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Select Accepted Sales Quote
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {quotations.map((q) => (
                        <div
                          key={q.id}
                          onClick={() => setSelectedQuoteId(q.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                            selectedQuoteId === q.id
                              ? "border-blue-600 bg-blue-50/50 shadow-2xs ring-1 ring-blue-600"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900">
                                {q.quotation_number}
                              </span>
                              <Badge variant="success" className="text-[10px]">
                                Accepted
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {q.customer_name}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-sm text-slate-900 block">
                              {formatCurrency(q.total_amount, q.currency)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Accepted {formatDate(q.accepted_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Select Customer Organization
                  </label>
                  <Select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    {catalog.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.email})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Select Product Plan Tier
                  </label>
                  <Select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                  >
                    {catalog.plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) — {formatCurrency(p.price)} / {p.billing_cycle}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Seat / License Quantity
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Calculated Cycle Total
                    </label>
                    <div className="h-9 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900">
                      {selectedPlan ? formatCurrency(selectedPlan.price * quantity) : "$0.00"}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Initial Lifecycle State
                  </label>
                  <Select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as "draft" | "active")}
                  >
                    <option value="active">Active (Immediate provisioning & recurring billing)</option>
                    <option value="draft">Draft (Staged for review, no immediate billing)</option>
                  </Select>
                </div>

                {selectedPlan && selectedPlan.trial_period_days > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                    Plan includes a <strong>{selectedPlan.trial_period_days}-day free trial</strong>. Subscription will begin in trialing status.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>

          {activeTab === "quotation" ? (
            <Button
              onClick={handleConvertQuotation}
              disabled={submitting || quotations.length === 0 || !selectedQuoteId}
              className="gap-1.5"
            >
              {submitting ? "Converting..." : "Convert Quotation"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleCreateDirect}
              disabled={submitting || !selectedCustomerId || !selectedPlanId}
            >
              {submitting ? "Provisioning..." : "Create Subscription"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

