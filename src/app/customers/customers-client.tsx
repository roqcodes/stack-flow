"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, Building2, Mail, Phone, UserCheck, UserX } from "lucide-react";
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
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listCustomersAction,
  createCustomerAction,
  updateCustomerAction,
  suspendCustomerAction,
  reactivateCustomerAction,
  PaginatedResult,
} from "@/modules/customers/actions";
import { Customer, CustomerStatus } from "@/modules/customers/types";
import { formatDate, getStatusBadgeVariant } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiStatCard } from "@/components/ui/kpi-stat-card";

interface CustomersClientProps {
  initialData: PaginatedResult<Customer>;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "INR", label: "INR — Indian Rupee" },
];

type CustomerForm = {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  business_number: string;
  currency: string;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_state: string;
  billing_postal_code: string;
  billing_country: string;
  status: CustomerStatus;
};

const defaultForm: CustomerForm = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  business_number: "",
  currency: "USD",
  billing_address_line1: "",
  billing_address_line2: "",
  billing_city: "",
  billing_state: "",
  billing_postal_code: "",
  billing_country: "",
  status: "active",
};

export function CustomersClient({ initialData }: CustomersClientProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [data, setData] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editCustomer, setEditCustomer] = React.useState<Customer | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<CustomerForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const fetchCustomers = React.useCallback(
    async (searchVal: string, statusVal: string, pageVal: number) => {
      setLoading(true);
      const result = await listCustomersAction({
        search: searchVal || undefined,
        status: (statusVal as CustomerStatus) || undefined,
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
      fetchCustomers(search, statusFilter, 1);
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, statusFilter, fetchCustomers]);

  const resetForm = () => {
    setForm(defaultForm);
    setFieldErrors({});
  };

  const openEdit = (customer: Customer) => {
    setEditCustomer(customer);
    setForm({
      company_name: customer.company_name,
      contact_name: customer.contact_name,
      email: customer.email,
      phone: customer.phone ?? "",
      business_number: customer.business_number ?? "",
      currency: customer.currency,
      billing_address_line1: customer.billing_address_line1 ?? "",
      billing_address_line2: customer.billing_address_line2 ?? "",
      billing_city: customer.billing_city ?? "",
      billing_state: customer.billing_state ?? "",
      billing_postal_code: customer.billing_postal_code ?? "",
      billing_country: customer.billing_country ?? "",
      status: customer.status,
    });
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFieldErrors({});

    const payload = {
      ...form,
      phone: form.phone || undefined,
      business_number: form.business_number || undefined,
      billing_address_line1: form.billing_address_line1 || undefined,
      billing_address_line2: form.billing_address_line2 || undefined,
      billing_city: form.billing_city || undefined,
      billing_state: form.billing_state || undefined,
      billing_postal_code: form.billing_postal_code || undefined,
      billing_country: form.billing_country || undefined,
    };

    const result = editCustomer
      ? await updateCustomerAction(editCustomer.id, payload)
      : await createCustomerAction({
          ...payload,
          is_active: true,
          metadata: {},
        });

    setSubmitting(false);

    if (!result.success) {
      if (result.error.details) setFieldErrors(result.error.details as Record<string, string[]>);
      toastError(result.error.message);
      return;
    }

    success(editCustomer ? "Customer updated." : "Customer created successfully.");
    setCreateOpen(false);
    setEditCustomer(null);
    resetForm();
    fetchCustomers(search, statusFilter, page);
    router.refresh();
  };

  const handleSuspend = async (customer: Customer) => {
    if (!confirm(`Suspend "${customer.company_name}"?`)) return;
    const result = await suspendCustomerAction(customer.id);
    if (!result.success) { toastError(result.error.message); return; }
    success("Customer suspended.");
    fetchCustomers(search, statusFilter, page);
    router.refresh();
  };

  const handleReactivate = async (customer: Customer) => {
    const result = await reactivateCustomerAction(customer.id);
    if (!result.success) { toastError(result.error.message); return; }
    success("Customer reactivated.");
    fetchCustomers(search, statusFilter, page);
    router.refresh();
  };

  const totalPages = Math.ceil(data.total / data.limit);

  const activeOnPage = data.items.filter((c) => c.status === "active").length;
  const activePct = data.items.length
    ? Math.round((activeOnPage / data.items.length) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="Manage your customer directory, company details, and account links."
        icon={Users}
        actions={
        <Dialog
          open={createOpen}
          onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}
        >
          <DialogTrigger asChild>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              New Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Customer</DialogTitle>
              <DialogDescription>Add a new customer to your directory.</DialogDescription>
            </DialogHeader>
            <CustomerForm form={form} setForm={setForm} fieldErrors={fieldErrors} />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button size="sm" isLoading={submitting} onClick={handleSubmit}>Create Customer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiStatCard
          title="Organizations"
          value={data.total}
          subtitle="Total in directory"
          icon={Building2}
          accent="blue"
          delay={0}
        />
        <KpiStatCard
          title="Active (this page)"
          value={activeOnPage}
          subtitle={`${data.items.length} shown · page ${data.page}`}
          icon={UserCheck}
          accent="emerald"
          trend={{ value: activePct, label: "active rate", direction: activePct >= 70 ? "up" : "neutral" }}
          delay={0.05}
        />
        <KpiStatCard
          title="Suspended / archived"
          value={data.items.filter((c) => c.status !== "active").length}
          subtitle="On current results view"
          icon={UserX}
          accent="slate"
          delay={0.1}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              id="customer-search"
              placeholder="Search by company, name, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftAddon={<Search className="h-4 w-4" />}
              className="sm:max-w-xs"
            />
            <Select
              id="customer-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              className="sm:max-w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Customers{" "}
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({data.total} total)
            </span>
          </CardTitle>
          <CardDescription>Click on a customer to view their full profile.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
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
                <TableEmpty colSpan={6} message="No customers found" />
              ) : (
                data.items.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <a
                        href={`/customers/${customer.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1.5"
                      >
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {customer.company_name}
                      </a>
                      {customer.business_number && (
                        <p className="text-xs text-slate-400 ml-5">{customer.business_number}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-slate-700">{customer.contact_name}</p>
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </a>
                      {customer.phone && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="h-3 w-3" />{customer.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono font-semibold text-slate-700">{customer.currency}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(customer.status)}>{customer.status}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">{formatDate(customer.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(customer)}>Edit</Button>
                        {customer.status === "active" && (
                          <Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-50" onClick={() => handleSuspend(customer)}>Suspend</Button>
                        )}
                        {customer.status === "suspended" && (
                          <Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50" onClick={() => handleReactivate(customer)}>Reactivate</Button>
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
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { const n = page - 1; setPage(n); fetchCustomers(search, statusFilter, n); }}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { const n = page + 1; setPage(n); fetchCustomers(search, statusFilter, n); }}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editCustomer} onOpenChange={(o) => { if (!o) { setEditCustomer(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer details. Financial history is preserved.</DialogDescription>
          </DialogHeader>
          <CustomerForm form={form} setForm={setForm} fieldErrors={fieldErrors} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setEditCustomer(null); resetForm(); }}>Cancel</Button>
            <Button size="sm" isLoading={submitting} onClick={handleSubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Customer Form ─────────────────────────────────────────────────────────────

interface CustomerFormProps {
  form: CustomerForm;
  setForm: React.Dispatch<React.SetStateAction<CustomerForm>>;
  fieldErrors: Record<string, string[]>;
}

function CustomerForm({ form, setForm, fieldErrors }: CustomerFormProps) {
  const f = (key: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input id="c-company" label="Company Name" required value={form.company_name} onChange={f("company_name")} error={fieldErrors.company_name?.[0]} placeholder="Acme Corp" />
        </div>
        <Input id="c-contact" label="Contact Name" required value={form.contact_name} onChange={f("contact_name")} error={fieldErrors.contact_name?.[0]} placeholder="Jane Smith" />
        <Input id="c-email" label="Email Address" required type="email" value={form.email} onChange={f("email")} error={fieldErrors.email?.[0]} placeholder="jane@acme.com" />
        <Input id="c-phone" label="Phone" value={form.phone} onChange={f("phone")} placeholder="+1 555 000 0000" />
        <Input id="c-biz-num" label="Business / VAT Number" value={form.business_number} onChange={f("business_number")} placeholder="US12345678" />
        <Select id="c-currency" label="Currency" required value={form.currency} onChange={f("currency")} options={CURRENCY_OPTIONS} />
        <Select id="c-status" label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CustomerStatus }))} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "archived", label: "Archived" }]} />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Billing Address</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input id="c-addr1" label="Address Line 1" value={form.billing_address_line1} onChange={f("billing_address_line1")} placeholder="123 Main St" />
          </div>
          <div className="col-span-2">
            <Input id="c-addr2" label="Address Line 2" value={form.billing_address_line2} onChange={f("billing_address_line2")} placeholder="Suite 400" />
          </div>
          <Input id="c-city" label="City" value={form.billing_city} onChange={f("billing_city")} placeholder="New York" />
          <Input id="c-state" label="State / Province" value={form.billing_state} onChange={f("billing_state")} placeholder="NY" />
          <Input id="c-postal" label="Postal Code" value={form.billing_postal_code} onChange={f("billing_postal_code")} placeholder="10001" />
          <Input id="c-country" label="Country (ISO 2)" value={form.billing_country} onChange={f("billing_country")} placeholder="US" maxLength={2} helperText="ISO 3166-1 alpha-2 (e.g. US, GB, IN)" />
        </div>
      </div>
    </div>
  );
}
