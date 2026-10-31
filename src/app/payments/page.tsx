"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { listPaymentsAction, recordPaymentAction, processRefundAction } from "@/modules/payments/actions";
import { PaymentWithAllocations, PaymentMethodType, PaymentStatus } from "@/modules/payments/types";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Calendar,
  Building,
} from "lucide-react";

export default function PaymentsPage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [payments, setPayments] = React.useState<PaymentWithAllocations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [methodFilter, setMethodFilter] = React.useState<"ALL" | PaymentMethodType>("ALL");
  const [metrics, setMetrics] = React.useState({
    totalCollected: 0,
    totalRefunded: 0,
    totalCount: 0,
  });

  // Record payment modal
  const [isRecordModalOpen, setIsRecordModalOpen] = React.useState(false);
  const [formCustomerId, setFormCustomerId] = React.useState("");
  const [formAmount, setFormAmount] = React.useState("");
  const [formMethod, setFormMethod] = React.useState<PaymentMethodType>("credit_card");
  const [formSubChannel, setFormSubChannel] = React.useState<"upi" | "cash" | "card" | "wire" | "ach" | "other">("card");
  const [formReference, setFormReference] = React.useState("");
  const [formInvoiceId, setFormInvoiceId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Refund modal
  const [isRefundModalOpen, setIsRefundModalOpen] = React.useState(false);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = React.useState<PaymentWithAllocations | null>(null);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");
  const [isRefunding, setIsRefunding] = React.useState(false);

  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const result = await listPaymentsAction({
          method: methodFilter === "ALL" ? undefined : methodFilter,
          search: search.trim() || undefined,
        });

        if (isMounted) {
          if (result.success && result.data) {
            setPayments(result.data.payments);
            setMetrics({
              totalCollected: result.data.totalCollected,
              totalRefunded: result.data.totalRefunded,
              totalCount: result.data.totalCount,
            });
          } else {
            toastError(result.error || "Failed to load payments");
          }
        }
      } catch {
        if (isMounted) {
          toastError("Network error while loading payments");
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
  }, [methodFilter, search, refreshKey, toastError]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toastError("Please enter a valid payment amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordPaymentAction({
        customerId: formCustomerId.trim(),
        amount: amountNum,
        paymentMethodType: formMethod,
        subChannel: formSubChannel,
        transactionReference: formReference.trim() || undefined,
        invoiceAllocations: formInvoiceId.trim()
          ? [{ invoiceId: formInvoiceId.trim(), amount: amountNum }]
          : undefined,
      });

      if (result.success) {
        toastSuccess(`Payment ${result.data?.paymentNumber} recorded successfully!`);
        setIsRecordModalOpen(false);
        setFormCustomerId("");
        setFormAmount("");
        setFormReference("");
        setFormInvoiceId("");
        setRefreshKey((k) => k + 1);
      } else {
        toastError(result.error || "Failed to record payment");
      }
    } catch {
      toastError("Error recording payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRefundModal = (payment: PaymentWithAllocations) => {
    setSelectedPaymentForRefund(payment);
    const maxRefundable = (payment.amount - payment.refunded_amount).toFixed(2);
    setRefundAmount(maxRefundable);
    setRefundReason("Customer requested refund");
    setIsRefundModalOpen(true);
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForRefund) return;

    const amountNum = parseFloat(refundAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toastError("Please enter a valid refund amount");
      return;
    }

    setIsRefunding(true);
    try {
      const result = await processRefundAction({
        paymentId: selectedPaymentForRefund.id,
        amount: amountNum,
        reason: refundReason,
      });

      if (result.success) {
        toastSuccess("Refund processed successfully!");
        setIsRefundModalOpen(false);
        setSelectedPaymentForRefund(null);
        setRefreshKey((k) => k + 1);
      } else {
        toastError(result.error || "Failed to process refund");
      }
    } catch {
      toastError("Error processing refund");
    } finally {
      setIsRefunding(false);
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "succeeded":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Succeeded</Badge>;
      case "refunded":
        return <Badge className="bg-red-50 text-red-700 border-red-200">Refunded</Badge>;
      case "partially_refunded":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Partially Refunded</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const netCollected = metrics.totalCollected - metrics.totalRefunded;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments & Settlement Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">
            Record multi-channel payments (Cards, UPI, Bank Transfer, Cash), allocate against invoices, and manage refunds.
          </p>
        </div>
        <Button onClick={() => setIsRecordModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </div>
        {/* KPI Financial Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Gross Collected</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">${metrics.totalCollected.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-1">across {metrics.totalCount} transactions</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Refunds Processed</p>
                <p className="text-2xl font-bold text-red-600 mt-1">${metrics.totalRefunded.toFixed(2)}</p>
                <p className="text-xs text-red-600/80 mt-1">returned funds</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <TrendingDown className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Net Settled Cash</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">${netCollected.toFixed(2)}</p>
                <p className="text-xs text-blue-600/80 mt-1">retained revenue</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Multi-Channel Rails</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">5 Methods</p>
                <p className="text-xs text-slate-400 mt-1">Cards, UPI, Bank, Wire, ACH</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CreditCard className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search payment # or ref..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="h-3.5 w-3.5" /> Method:
              </div>
              <select
                aria-label="Filter Payment Method"
                className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as "ALL" | PaymentMethodType)}
              >
                <option value="ALL">All Methods</option>
                <option value="credit_card">Credit Card</option>
                <option value="bank_transfer">Bank Transfer (UPI / Wire)</option>
                <option value="ach">ACH Transfer</option>
                <option value="wire">Direct Wire</option>
                <option value="manual">Manual / Cash</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Payment Ledger</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Confirmed payments, invoice allocations, and refund history.
                </CardDescription>
              </div>
              <Badge variant="secondary">{payments.length} Payments</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CreditCard className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No payments found</p>
                <p className="text-xs text-slate-500 mt-1">Record a payment to settle an outstanding invoice.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Payment #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Method & Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Allocated To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/70">
                      <TableCell>
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-800">
                          {p.payment_number}
                        </code>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-slate-900 flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-slate-400" />
                          {p.customer?.company_name || p.customer?.contact_name || "Customer"}
                        </div>
                        <p className="text-[11px] text-slate-400">{p.customer?.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize font-medium">
                          {p.payment_method_type.replace("_", " ")}
                        </Badge>
                        {p.transaction_reference && (
                          <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                            {p.transaction_reference}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-xs text-slate-900">
                          ${p.amount.toFixed(2)} {p.currency}
                        </span>
                        {p.refunded_amount > 0 && (
                          <p className="text-[11px] text-red-600 font-medium">
                            -${p.refunded_amount.toFixed(2)} refunded
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.allocations && p.allocations.length > 0 ? (
                          <div className="space-y-0.5">
                            {p.allocations.map((a) => (
                              <div key={a.id} className="text-xs flex items-center gap-1.5">
                                <span className="font-mono text-blue-600 font-medium">
                                  {a.invoices?.invoice_number || "Invoice"}
                                </span>
                                <span className="text-slate-400">(${a.allocated_amount.toFixed(2)})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unallocated</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-right">
                        {p.status === "succeeded" && p.amount > p.refunded_amount && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRefundModal(p)}
                            className="h-8 text-xs text-red-600 hover:bg-red-50 gap-1"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Refund
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Record Payment Modal */}
        <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
          <DialogHeader>
            <DialogTitle>Record Payment & Settlement</DialogTitle>
            <DialogDescription>
              Record an incoming transaction and optionally allocate it directly to an invoice.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-slate-700">Customer UUID *</label>
              <Input
                placeholder="e.g. f0000000-0000-0000-0000-000000000001"
                value={formCustomerId}
                onChange={(e) => setFormCustomerId(e.target.value)}
                required
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Payment Amount ($) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="213.43"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Payment Method *</label>
                <select
                  aria-label="Payment Method Selection"
                  className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  value={formMethod}
                  onChange={(e) => setFormMethod(e.target.value as PaymentMethodType)}
                >
                  <option value="credit_card">Credit Card (Stripe/Card)</option>
                  <option value="bank_transfer">Bank Transfer (UPI / Wire)</option>
                  <option value="ach">ACH Direct Debit</option>
                  <option value="wire">SWIFT / Wire Transfer</option>
                  <option value="manual">Manual / Cash Collection</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Sub-Channel / Rail</label>
                <select
                  aria-label="Sub Channel Selection"
                  className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  value={formSubChannel}
                  onChange={(e) =>
                    setFormSubChannel(e.target.value as "upi" | "cash" | "card" | "wire" | "ach" | "other")
                  }
                >
                  <option value="card">Card Payment</option>
                  <option value="upi">UPI (Instant India)</option>
                  <option value="cash">Cash in Hand</option>
                  <option value="wire">Wire / RTGS</option>
                  <option value="ach">ACH</option>
                  <option value="other">Other Rail</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Transaction Reference</label>
                <Input
                  placeholder="e.g. UPI-REF-938210 / ch_stripe_9823"
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">Allocate Directly to Invoice UUID (Optional)</label>
              <Input
                placeholder="e.g. 20000000-0000-0000-0000-000000000001"
                value={formInvoiceId}
                onChange={(e) => setFormInvoiceId(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                If provided, will settle the balance on this invoice and transition status to Paid or Partially Paid.
              </p>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRecordModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...
                  </>
                ) : (
                  "Record Payment"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Refund Modal */}
        <Dialog open={isRefundModalOpen} onOpenChange={setIsRefundModalOpen}>
          <DialogHeader>
            <DialogTitle>Process Payment Refund</DialogTitle>
            <DialogDescription>
              Process a full or partial refund for {selectedPaymentForRefund?.payment_number}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleProcessRefund} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-slate-700">Refund Amount ($) *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={
                  selectedPaymentForRefund
                    ? (selectedPaymentForRefund.amount - selectedPaymentForRefund.refunded_amount).toFixed(2)
                    : undefined
                }
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">Refund Reason</label>
              <Input
                placeholder="e.g. Customer cancelled service"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRefundModalOpen(false)}
                disabled={isRefunding}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isRefunding}>
                {isRefunding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  "Confirm Refund"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      </div>
  );
}
