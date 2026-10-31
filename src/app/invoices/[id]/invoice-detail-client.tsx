"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { getInvoiceAction, updateInvoiceStatusAction } from "@/modules/invoices/actions";
import { InvoiceWithDetails, InvoiceStatus } from "@/modules/invoices/types";
import {
  FileText,
  Download,
  Calendar,
  Building,
  Mail,
  Receipt,
  CreditCard,
  Loader2,
  ArrowLeft,
} from "lucide-react";

export function InvoiceDetailClient({ id }: { id: string }) {
  const invoiceId = id;
  const { success: toastSuccess, error: toastError } = useToast();

  const [invoice, setInvoice] = React.useState<InvoiceWithDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);

  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!invoiceId) return;
      try {
        const result = await getInvoiceAction(invoiceId);
        if (isMounted) {
          if (result.success && result.data) {
            setInvoice(result.data);
          } else {
            toastError(result.error || "Failed to load invoice details");
          }
        }
      } catch {
        if (isMounted) {
          toastError("Error loading invoice");
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
  }, [invoiceId, refreshKey, toastError]);

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return;
    setUpdatingStatus(true);
    try {
      const result = await updateInvoiceStatusAction(invoice.id, newStatus);
      if (result.success) {
        toastSuccess(`Invoice status updated to ${newStatus}`);
        setRefreshKey((k) => k + 1);
      } else {
        toastError(result.error || "Failed to update status");
      }
    } catch {
      toastError("Network error while updating invoice status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-12 text-center">
          <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-900">Invoice not found</p>
          <p className="text-xs text-slate-500 mt-1">Please verify the URL or return to the invoices ledger.</p>
          <Link href="/invoices" className="mt-4 inline-block">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Invoice {invoice.invoice_number}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Issued on {invoice.issue_date} for {invoice.customer?.company_name || "Customer"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
            </Button>
          </Link>
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
          </a>
        </div>
      </div>

      {/* Top Status Banner */}
      <Card className="border-slate-200 shadow-xs bg-slate-50/50">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900">{invoice.invoice_number}</span>
                <Badge
                  className={
                    invoice.status === "paid"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }
                >
                  {invoice.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Due Date: <strong>{invoice.due_date}</strong>
                {invoice.paid_at && ` • Settled on ${new Date(invoice.paid_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {invoice.status !== "paid" && invoice.status !== "void" && (
              <Button
                size="sm"
                variant="outline"
                disabled={updatingStatus}
                onClick={() => handleStatusChange("void")}
                className="text-xs text-red-600 hover:bg-red-50"
              >
                Void Invoice
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer & Period Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building className="h-4 w-4 text-slate-400" /> Billed Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <p className="font-bold text-slate-900 text-sm">
              {invoice.customer?.company_name || invoice.customer?.contact_name}
            </p>
            <p className="text-slate-500 flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {invoice.customer?.email}
            </p>
            {invoice.customer?.billing_address_line1 && (
              <p className="text-slate-600">
                {invoice.customer.billing_address_line1}, {invoice.customer.billing_city}{" "}
                {invoice.customer.billing_state} {invoice.customer.billing_postal_code}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" /> Billing Period & Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between py-0.5 border-b border-slate-100">
              <span>Coverage Period:</span>
              <span className="font-medium text-slate-900">
                {invoice.period_start ? new Date(invoice.period_start).toLocaleDateString() : "—"} to{" "}
                {invoice.period_end ? new Date(invoice.period_end).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100">
              <span>Issue Date:</span>
              <span className="font-medium text-slate-900">{invoice.issue_date}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Payment Due Date:</span>
              <span className="font-bold text-slate-900">{invoice.due_date}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Itemized Table */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="px-6 py-4 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold">Line Items & Snapshots</CardTitle>
          <CardDescription className="text-xs">
            Preserved snapshot of quantities, unit amounts, discounts, and jurisdictional taxes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-xs text-slate-900">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                  <TableCell className="text-right text-xs">
                    ${item.unit_amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-emerald-600">
                    {item.discount_amount > 0 ? `-$${item.discount_amount.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-600">
                    ${item.tax_amount.toFixed(2)} ({item.tax_rate}%)
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold text-slate-900">
                    ${item.total_amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Financial Summary */}
          <div className="p-6 bg-slate-50/30 border-t border-slate-100 flex justify-end">
            <div className="w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-medium text-slate-900">${invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span className="font-medium">-${invoice.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Tax Amount:</span>
                <span className="font-medium text-slate-900">${invoice.tax_amount.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Total Amount:</span>
                <span className="text-blue-600">${invoice.total_amount.toFixed(2)} {invoice.currency}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amount Paid:</span>
                <span className="font-medium text-emerald-600">${invoice.amount_paid.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold">
                <span>Balance Due:</span>
                <span className={invoice.amount_due > 0 ? "text-red-600" : "text-emerald-600"}>
                  ${invoice.amount_due.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Allocations Table */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="px-6 py-4 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-400" /> Settled Payments & Allocations
          </CardTitle>
          <CardDescription className="text-xs">
            Audit trail of payments applied to settle this invoice.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(!invoice.payment_allocations || invoice.payment_allocations.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No payments have been allocated to this invoice yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Payment #</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Settled Date</TableHead>
                  <TableHead className="text-right">Allocated Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payment_allocations.map((alloc) => (
                  <TableRow key={alloc.id}>
                    <TableCell className="font-mono text-xs font-semibold text-blue-600">
                      {alloc.payments?.payment_number || "PAY-UNKNOWN"}
                    </TableCell>
                    <TableCell className="text-xs capitalize">
                      {alloc.payments?.payment_method_type?.replace("_", " ") || "Credit Card"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {alloc.payments?.paid_at
                        ? new Date(alloc.payments.paid_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-emerald-600">
                      ${alloc.allocated_amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
