"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FileSpreadsheet,
  Trash2,
  CheckCircle,
  XCircle,
  Send,
  Eye,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listQuotationsAction,
  createQuotationAction,
  sendQuotationAction,
  acceptQuotationAction,
  rejectQuotationAction,
  previewQuotationLinesAction,
  QuotationWithItems,
} from "@/modules/quotations/actions";
import { PaginatedResult } from "@/modules/products/actions";
import { QuotationStatus, QuotationTemplate } from "@/modules/quotations/types";
import { Customer } from "@/modules/customers/types";
import { formatDate, formatCurrency, getStatusBadgeVariant } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiStatCard } from "@/components/ui/kpi-stat-card";

interface QuotationsClientProps {
  initialQuotations: PaginatedResult<QuotationWithItems>;
  customers: Customer[];
  templates: QuotationTemplate[];
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

interface LineItem {
  product_id?: string;
  plan_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
}

const defaultLineItem = (): LineItem => ({
  description: "",
  quantity: 1,
  unit_price: 0,
  discount_amount: 0,
  tax_rate: 0,
});

export function QuotationsClient({
  initialQuotations,
  customers,
  templates,
}: QuotationsClientProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [data, setData] = React.useState(initialQuotations);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const [form, setForm] = React.useState({
    customer_id: "",
    template_id: "",
    currency: "USD",
    valid_until: "",
    notes: "",
    terms: "",
  });
  const [lineItems, setLineItems] = React.useState<LineItem[]>([defaultLineItem()]);
  const [pricingLoading, setPricingLoading] = React.useState(false);

  const applyTemplatePreview = React.useCallback(
    async (customerId: string, templateId: string) => {
      setPricingLoading(true);
      const result = await previewQuotationLinesAction({
        customer_id: customerId,
        template_id: templateId,
      });
      setPricingLoading(false);
      if (!result.success) {
        toastError(result.error.message);
        return;
      }
      setLineItems(
        result.data.lines.map((line) => ({
          product_id: line.product_id ?? undefined,
          plan_id: line.plan_id ?? undefined,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount,
          tax_rate: line.tax_rate,
        }))
      );
      if (result.data.terms) {
        setForm((f) => ({ ...f, terms: result.data.terms ?? f.terms }));
      }
      if (result.data.valid_until) {
        setForm((f) => ({ ...f, valid_until: result.data.valid_until ?? f.valid_until }));
      }
    },
    [toastError]
  );

  const recalculateManualLines = async () => {
    if (!form.customer_id) {
      toastError("Select a customer first.");
      return;
    }
    if (form.template_id) {
      await applyTemplatePreview(form.customer_id, form.template_id);
      return;
    }
    setPricingLoading(true);
    const result = await previewQuotationLinesAction({
      customer_id: form.customer_id,
      line_items: lineItems.map((item) => ({
        product_id: item.product_id || null,
        plan_id: item.plan_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_rate: item.tax_rate,
      })),
    });
    setPricingLoading(false);
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    setLineItems(
      result.data.lines.map((line) => ({
        product_id: line.product_id ?? undefined,
        plan_id: line.plan_id ?? undefined,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_amount: line.discount_amount,
        tax_rate: line.tax_rate,
      }))
    );
  };

  React.useEffect(() => {
    if (form.customer_id && form.template_id) {
      void applyTemplatePreview(form.customer_id, form.template_id);
    }
  }, [form.customer_id, form.template_id, applyTemplatePreview]);

  const fetchQuotations = React.useCallback(
    async (searchVal: string, statusVal: string, pageVal: number) => {
      setLoading(true);
      const result = await listQuotationsAction({
        search: searchVal || undefined,
        status: (statusVal as QuotationStatus) || undefined,
        page: pageVal,
        limit: 20,
      });
      if (result.success) setData(result.data);
      setLoading(false);
    },
    []
  );

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      fetchQuotations(search, statusFilter, 1);
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, statusFilter, fetchQuotations]);

  const resetForm = () => {
    setForm({ customer_id: "", template_id: "", currency: "USD", valid_until: "", notes: "", terms: "" });
    setLineItems([defaultLineItem()]);
    setFieldErrors({});
  };

  // Server-side preview totals (computed locally for display only, real totals come from server)
  const previewTotals = React.useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    for (const item of lineItems) {
      const lineSub = item.quantity * item.unit_price;
      const lineDisc = item.discount_amount;
      const lineTax = (lineSub - lineDisc) * (item.tax_rate / 100);
      subtotal += lineSub;
      discountTotal += lineDisc;
      taxTotal += lineTax;
    }
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discountTotal * 100) / 100,
      tax: Math.round(taxTotal * 100) / 100,
      total: Math.round((subtotal - discountTotal + taxTotal) * 100) / 100,
    };
  }, [lineItems]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFieldErrors({});

    const result = await createQuotationAction({
      customer_id: form.customer_id,
      template_id: form.template_id || undefined,
      currency: form.currency,
      valid_until: form.valid_until || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      notes: form.notes || undefined,
      terms: form.terms || undefined,
      line_items: lineItems.map((item) => ({
        product_id: item.product_id || null,
        plan_id: item.plan_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_rate: item.tax_rate,
      })),
    });

    setSubmitting(false);

    if (!result.success) {
      if (result.error.details) setFieldErrors(result.error.details as Record<string, string[]>);
      toastError(result.error.message);
      return;
    }

    success(`Quotation ${result.data.quotation_number} created.`);
    setCreateOpen(false);
    resetForm();
    fetchQuotations(search, statusFilter, page);
    router.refresh();
  };

  const handleSend = async (qId: string, qNum: string) => {
    const result = await sendQuotationAction(qId);
    if (!result.success) { toastError(result.error.message); return; }
    success(`Quotation ${qNum} sent.`);
    fetchQuotations(search, statusFilter, page);
  };

  const handleAccept = async (qId: string, qNum: string) => {
    const result = await acceptQuotationAction(qId);
    if (!result.success) { toastError(result.error.message); return; }
    success(`Quotation ${qNum} accepted.`);
    fetchQuotations(search, statusFilter, page);
  };

  const handleReject = async (qId: string, qNum: string) => {
    if (!confirm(`Reject quotation ${qNum}?`)) return;
    const result = await rejectQuotationAction(qId);
    if (!result.success) { toastError(result.error.message); return; }
    success(`Quotation ${qNum} rejected.`);
    fetchQuotations(search, statusFilter, page);
  };

  const totalPages = Math.ceil(data.total / data.limit);

  const acceptedCount = data.items.filter((q) => q.status === "accepted").length;
  const openCount = data.items.filter((q) => q.status === "draft" || q.status === "sent").length;
  const winRate = data.items.length ? Math.round((acceptedCount / data.items.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quotations"
        description="Create and manage customer quotations with line items, taxes, and discounts."
        icon={FileSpreadsheet}
        actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/quotations/templates")}>
            Templates
          </Button>
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              New Quotation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create Quotation</DialogTitle>
              <DialogDescription>
                All totals are computed server-side. Prices and taxes are never trusted from the client.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
              {/* Header Fields */}
              <div className="grid grid-cols-2 gap-4">
                <Select
                  id="q-customer"
                  label="Customer"
                  required
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                  error={fieldErrors.customer_id?.[0]}
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name} — {c.email}</option>
                  ))}
                </Select>
                <Select
                  id="q-template"
                  label="Template (optional)"
                  value={form.template_id}
                  onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                >
                  <option value="">No template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
                <Input id="q-currency" label="Currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} placeholder="USD" />
                <Input id="q-valid-until" label="Valid Until" type="date" required value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} error={fieldErrors.valid_until?.[0]} />
              </div>

              {/* Line Items */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line Items</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={pricingLoading}
                      onClick={() => void recalculateManualLines()}
                    >
                      Recalculate prices & tax
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="h-3 w-3" />}
                      onClick={() => setLineItems((prev) => [...prev, defaultLineItem()])}
                    >
                      Add Line
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 p-3 space-y-3 relative">
                      <button
                        onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <Input
                        id={`li-desc-${idx}`}
                        label="Description"
                        required
                        value={item.description}
                        onChange={(e) =>
                          setLineItems((prev) =>
                            prev.map((li, i) => (i === idx ? { ...li, description: e.target.value } : li))
                          )
                        }
                        placeholder="Service or product description"
                      />
                      <div className="grid grid-cols-4 gap-3">
                        <Input
                          id={`li-qty-${idx}`}
                          label="Qty"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            setLineItems((prev) =>
                              prev.map((li, i) => (i === idx ? { ...li, quantity: Number(e.target.value) } : li))
                            )
                          }
                        />
                        <Input
                          id={`li-price-${idx}`}
                          label="Unit Price"
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            setLineItems((prev) =>
                              prev.map((li, i) => (i === idx ? { ...li, unit_price: Number(e.target.value) } : li))
                            )
                          }
                        />
                        <Input
                          id={`li-disc-${idx}`}
                          label="Discount $"
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.discount_amount}
                          onChange={(e) =>
                            setLineItems((prev) =>
                              prev.map((li, i) => (i === idx ? { ...li, discount_amount: Number(e.target.value) } : li))
                            )
                          }
                        />
                        <Input
                          id={`li-tax-${idx}`}
                          label="Tax %"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={item.tax_rate}
                          onChange={(e) =>
                            setLineItems((prev) =>
                              prev.map((li, i) => (i === idx ? { ...li, tax_rate: Number(e.target.value) } : li))
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview Totals */}
                <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(previewTotals.subtotal, form.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Discounts</span>
                    <span className="text-red-600">−{formatCurrency(previewTotals.discount, form.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span>{formatCurrency(previewTotals.tax, form.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(previewTotals.total, form.currency)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Preview only — authoritative totals computed server-side.</p>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                <Textarea id="q-notes" label="Internal Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Internal notes (not shown to customer)" />
                <Textarea id="q-terms" label="Terms & Conditions" value={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))} rows={3} placeholder="Payment terms, delivery terms…" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button size="sm" isLoading={submitting} onClick={handleSubmit}>Create Quotation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiStatCard
          title="Pipeline (page)"
          value={openCount}
          subtitle={`${data.total} quotes total`}
          icon={Send}
          accent="blue"
        />
        <KpiStatCard
          title="Accepted"
          value={acceptedCount}
          subtitle="On current results"
          icon={CheckCircle2}
          accent="emerald"
          trend={{ value: winRate, label: "win rate", direction: winRate >= 25 ? "up" : "neutral" }}
          delay={0.05}
        />
        <KpiStatCard
          title="In progress"
          value={data.items.filter((q) => q.status === "sent").length}
          subtitle="Awaiting customer response"
          icon={Clock}
          accent="amber"
          delay={0.1}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              id="q-search"
              placeholder="Search by quotation number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftAddon={<Search className="h-4 w-4" />}
              className="sm:max-w-xs"
            />
            <Select
              id="q-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              className="sm:max-w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quotations Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Quotations{" "}
            <span className="ml-2 text-sm font-normal text-slate-500">({data.total} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.items.length === 0 ? (
                <TableEmpty colSpan={6} message="No quotations found" />
              ) : (
                data.items.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <a
                        href={`/quotations/${q.id}`}
                        className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {q.quotation_number}
                      </a>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900 text-sm">
                        {(q.customer as { company_name: string } | undefined)?.company_name ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {formatCurrency(q.total_amount, q.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(q.valid_until)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(q.status)}>{q.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/quotations/${q.id}`)} leftIcon={<Eye className="h-3.5 w-3.5" />}>View</Button>
                        {q.status === "draft" && (
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50" onClick={() => handleSend(q.id, q.quotation_number)} leftIcon={<Send className="h-3.5 w-3.5" />}>Send</Button>
                        )}
                        {q.status === "sent" && (
                          <>
                            <Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50" onClick={() => handleAccept(q.id, q.quotation_number)} leftIcon={<CheckCircle className="h-3.5 w-3.5" />}>Accept</Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleReject(q.id, q.quotation_number)} leftIcon={<XCircle className="h-3.5 w-3.5" />}>Reject</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { const n = page - 1; setPage(n); fetchQuotations(search, statusFilter, n); }}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { const n = page + 1; setPage(n); fetchQuotations(search, statusFilter, n); }}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
