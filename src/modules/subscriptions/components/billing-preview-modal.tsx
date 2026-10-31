"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Subscription } from "../types";
import {
  SubscriptionBillingValidation,
  SubscriptionForBilling,
  SubscriptionBillingLine,
} from "../service-contracts";
import {
  validateSubscriptionForBillingAction,
  getSubscriptionForBillingAction,
  getSubscriptionBillingLinesAction,
} from "../actions";
import {
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Copy,
} from "lucide-react";

interface BillingPreviewModalProps {
  subscription: Subscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BillingPreviewModal({
  subscription,
  open,
  onOpenChange,
}: BillingPreviewModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [validation, setValidation] = React.useState<SubscriptionBillingValidation | null>(null);
  const [billingPayload, setBillingPayload] = React.useState<SubscriptionForBilling | null>(null);
  const [billingLines, setBillingLines] = React.useState<SubscriptionBillingLine[]>([]);
  const [activeTab, setActiveTab] = React.useState<"summary" | "lines" | "raw">("summary");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open || !subscription) {
      return;
    }
    const subId = subscription.id;
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      try {
        const [valRes, payRes, linesRes] = await Promise.all([
          validateSubscriptionForBillingAction(subId),
          getSubscriptionForBillingAction(subId),
          getSubscriptionBillingLinesAction(subId),
        ]);

        if (isMounted) {
          if (valRes.success) setValidation(valRes.data);
          if (payRes.success) setBillingPayload(payRes.data);
          if (linesRes.success) setBillingLines(linesRes.data);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [open, subscription]);

  const copyJson = () => {
    if (billingPayload) {
      navigator.clipboard.writeText(JSON.stringify(billingPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!subscription) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  Billing Contract Inspector
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Live verification of contracts consumed by Member 4 (Recurring Billing Engine)
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {subscription.subscription_number}
            </Badge>
          </div>
        </DialogHeader>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mt-2 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab("summary")}
            className={`pb-2 transition-colors ${
              activeTab === "summary"
                ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Pre-flight Validation & Totals
          </button>
          <button
            onClick={() => setActiveTab("lines")}
            className={`pb-2 transition-colors ${
              activeTab === "lines"
                ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Invoice Item Lines ({billingLines.length})
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`pb-2 transition-colors ${
              activeTab === "raw"
                ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Raw Contract Payload (JSON)
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Executing pre-flight checks against database...
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {activeTab === "summary" && (
              <>
                {/* Validation Status Banner */}
                <div
                  className={`rounded-xl p-4 border flex items-start gap-3 ${
                    validation?.can_proceed_to_billing
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                      : "bg-amber-50/70 border-amber-200 text-amber-900"
                  }`}
                >
                  {validation?.can_proceed_to_billing ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">
                        {validation?.can_proceed_to_billing
                          ? "Billing Pre-Flight Passed (Eligible for Invoicing)"
                          : "Billing Engine Hold (Cannot Execute Cycle)"}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Method: validateSubscriptionForBilling()
                      </span>
                    </div>

                    {validation?.reasons && validation.reasons.length > 0 ? (
                      <ul className="mt-2 list-disc list-inside text-xs space-y-1">
                        {validation.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-emerald-700">
                        All checks satisfied: Customer standing active, valid periods, positive monetary values.
                      </p>
                    )}

                    {validation?.warnings && validation.warnings.length > 0 && (
                      <div className="mt-2 text-xs text-amber-800 font-medium">
                        Notice: {validation.warnings.join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Billing Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Cycle / Frequency</span>
                    <span className="font-semibold text-slate-900 capitalize">
                      {subscription.billing_cycle}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Current Period End</span>
                    <span className="font-semibold text-slate-900">
                      {formatDate(subscription.current_period_end)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Next Billing Run</span>
                    <span className="font-semibold text-slate-900">
                      {formatDate(subscription.next_billing_date)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Cycle Total</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(subscription.total_amount, subscription.currency)}
                    </span>
                  </div>
                </div>

                {/* Customer Snapshot */}
                {billingPayload?.customer && (
                  <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-2 bg-white">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-semibold text-slate-900">
                        Billed Customer Snapshot
                      </span>
                      <span className="text-slate-400">
                        {billingPayload.customer.id}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <div>
                        <span className="text-slate-400">Organization:</span>{" "}
                        <span className="font-medium text-slate-900">
                          {billingPayload.customer.company_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Tax ID / Business #:</span>{" "}
                        <span>{billingPayload.customer.business_number || "None"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Billing Email:</span>{" "}
                        <span>{billingPayload.customer.email}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Billing Country:</span>{" "}
                        <span>{billingPayload.customer.billing_country || "Not specified"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "lines" && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Amount</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {line.description}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Line ID: {line.id}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.unit_amount, subscription.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.discount_amount, subscription.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.tax_amount, subscription.currency)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatCurrency(line.total_amount, subscription.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {activeTab === "raw" && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyJson}
                  className="absolute top-2 right-2 h-7 px-2 text-xs gap-1 bg-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy JSON"}
                </Button>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-96">
                  {JSON.stringify(billingPayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

