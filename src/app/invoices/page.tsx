"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { listInvoicesAction, generateInvoiceFromSubscriptionAction } from "@/modules/invoices/actions";
import { InvoiceWithDetails, InvoiceStatus } from "@/modules/invoices/types";
import {
  Receipt,
  Search,
  Filter,
  DollarSign,
  CreditCard,
  AlertCircle,
  FileText,
  Download,
  Plus,
  Loader2,
  Calendar,
} from "lucide-react";

export default function InvoicesPage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [invoices, setInvoices] = React.useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | InvoiceStatus>("ALL");
  const [metrics, setMetrics] = React.useState({
    totalInvoiced: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    totalCount: 0,
  });

  // Generate modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = React.useState(false);
  const [subscriptionIdInput, setSubscriptionIdInput] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);

  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const result = await listInvoicesAction({
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: search.trim() || undefined,
        });

        if (isMounted) {
          if (result.success && result.data) {
            setInvoices(result.data.invoices);
            setMetrics({
              totalInvoiced: result.data.totalInvoiced,
              totalCollected: result.data.totalCollected,
              totalOutstanding: result.data.totalOutstanding,
              totalCount: result.data.totalCount,
            });
          } else {
            toastError(result.error || "Failed to load invoices");
          }
        }
      } catch {
        if (isMounted) {
          toastError("Network error while loading invoices");
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
  }, [statusFilter, search, refreshKey, toastError]);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriptionIdInput.trim()) {
      toastError("Please provide a Subscription ID");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateInvoiceFromSubscriptionAction({
        subscriptionId: subscriptionIdInput.trim(),
      });

      if (result.success) {
        toastSuccess(`Invoice ${result.data?.invoiceNumber} generated successfully!`);
        setIsGenerateModalOpen(false);
        setSubscriptionIdInput("");
        setRefreshKey((k) => k + 1);
      } else {
        toastError(result.error || "Failed to generate invoice");
      }
    } catch {
      toastError("Error triggering invoice generation");
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>;
      case "partially_paid":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Partially Paid</Badge>;
      case "issued":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Issued</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "void":
        return <Badge variant="outline" className="text-slate-400">Void</Badge>;
      case "uncollectible":
        return <Badge className="bg-red-50 text-red-700 border-red-200">Uncollectible</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices & Billing Statements</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track billing cycles, inspect generated invoices, process payments, and export PDF statements.
          </p>
        </div>
        <Button onClick={() => setIsGenerateModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Bill Subscription
        </Button>
      </div>
        {/* KPI Financial Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Invoiced</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">${metrics.totalInvoiced.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-1">across {metrics.totalCount} invoices</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Receipt className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Cash Collected</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">${metrics.totalCollected.toFixed(2)}</p>
                <p className="text-xs text-emerald-600/80 mt-1">settled payments</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Outstanding Balance</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">${metrics.totalOutstanding.toFixed(2)}</p>
                <p className="text-xs text-amber-600/80 mt-1">accounts receivable</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Collection Rate</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">
                  {metrics.totalInvoiced > 0
                    ? `${((metrics.totalCollected / metrics.totalInvoiced) * 100).toFixed(1)}%`
                    : "100%"}
                </p>
                <p className="text-xs text-slate-400 mt-1">settlement efficiency</p>
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
                placeholder="Search invoice number..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="h-3.5 w-3.5" /> Status:
              </div>
              <select
                aria-label="Filter Invoice Status"
                className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "ALL" | InvoiceStatus)}
              >
                <option value="ALL">All Statuses</option>
                <option value="issued">Issued / Due</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Fully Paid</option>
                <option value="draft">Draft</option>
                <option value="void">Void</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Invoices Ledger</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Generated statements with snapshot itemization, tax breakdown, and payments.
                </CardDescription>
              </div>
              <Badge variant="secondary">{invoices.length} Invoices</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Receipt className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No invoices recorded</p>
                <p className="text-xs text-slate-500 mt-1">Invoices appear here once generated by recurring cycles.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Issue / Due Date</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Balance Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50/70">
                      <TableCell>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-mono font-semibold text-xs text-blue-600 hover:underline flex items-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {inv.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            {inv.customer?.company_name || inv.customer?.contact_name || "Unknown Customer"}
                          </p>
                          <p className="text-[11px] text-slate-400">{inv.customer?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-600 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {inv.issue_date} (Due {inv.due_date})
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-xs text-slate-900">
                          ${inv.total_amount.toFixed(2)} {inv.currency}
                        </span>
                      </TableCell>
                      <TableCell>
                        {inv.amount_due > 0 ? (
                          <span className="font-semibold text-xs text-red-600">
                            ${inv.amount_due.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">Settled</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/invoices/${inv.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 text-xs">
                              View
                            </Button>
                          </Link>
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                              <Download className="h-3.5 w-3.5 text-slate-600" />
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Generate Invoice Modal */}
        <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
          <DialogHeader>
            <DialogTitle>Generate Invoice from Subscription</DialogTitle>
            <DialogDescription>
              Execute an atomic billing transaction for a verified subscription.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateInvoice} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-slate-700">Subscription UUID *</label>
              <Input
                placeholder="e.g. 10000000-0000-0000-0000-000000000001"
                value={subscriptionIdInput}
                onChange={(e) => setSubscriptionIdInput(e.target.value)}
                required
                className="mt-1 font-mono text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Enter the subscription ID to snapshot line items, calculate taxes & discounts, and advance period.
              </p>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsGenerateModalOpen(false)}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  "Generate Invoice"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      </div>
  );
}
