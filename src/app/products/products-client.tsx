"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Package, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import {
  listProductsAction,
  createProductAction,
  updateProductAction,
  deactivateProductAction,
  PaginatedResult,
} from "@/modules/products/actions";
import { Product, ProductStatus } from "@/modules/products/types";
import { formatDate, getStatusBadgeVariant } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiStatCard } from "@/components/ui/kpi-stat-card";
import { Layers, Archive } from "lucide-react";

interface ProductsClientProps {
  initialData: PaginatedResult<Product>;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

export function ProductsClient({ initialData }: ProductsClientProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [data, setData] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState<Product | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [form, setForm] = React.useState({
    name: "",
    code: "",
    description: "",
    status: "active" as ProductStatus,
    product_type: "",
    sales_price: "",
    cost_price: "",
    pricing_currency: "USD",
  });
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});

  const fetchProducts = React.useCallback(
    async (searchVal: string, statusVal: string, pageVal: number) => {
      setLoading(true);
      const result = await listProductsAction({
        search: searchVal || undefined,
        status: (statusVal as ProductStatus) || undefined,
        page: pageVal,
        limit: 20,
      });
      if (result.success) {
        setData(result.data);
      }
      setLoading(false);
    },
    []
  );

  // Debounced search
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      fetchProducts(search, statusFilter, 1);
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, statusFilter, fetchProducts]);

  const resetForm = () => {
    setForm({
      name: "",
      code: "",
      description: "",
      status: "active",
      product_type: "",
      sales_price: "",
      cost_price: "",
      pricing_currency: "USD",
    });
    setFieldErrors({});
  };

  const openEdit = (product: Product) => {
    setEditProduct(product);
    const meta = (product.metadata ?? {}) as Record<string, unknown>;
    setForm({
      name: product.name,
      code: product.code,
      description: product.description ?? "",
      status: product.status,
      product_type: typeof meta.product_type === "string" ? meta.product_type : "",
      sales_price:
        meta.sales_price !== undefined && meta.sales_price !== null
          ? String(meta.sales_price)
          : "",
      cost_price:
        meta.cost_price !== undefined && meta.cost_price !== null
          ? String(meta.cost_price)
          : "",
      pricing_currency:
        typeof meta.currency === "string" && meta.currency.length === 3
          ? meta.currency
          : "USD",
    });
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFieldErrors({});

    const metadata = {
      ...(form.product_type ? { product_type: form.product_type } : {}),
      ...(form.sales_price !== "" ? { sales_price: Number(form.sales_price) } : {}),
      ...(form.cost_price !== "" ? { cost_price: Number(form.cost_price) } : {}),
      currency: form.pricing_currency.toUpperCase(),
    };

    const payload = {
      name: form.name,
      code: form.code.toUpperCase(),
      description: form.description || undefined,
      status: form.status,
      metadata,
    };

    const result = editProduct
      ? await updateProductAction(editProduct.id, payload)
      : await createProductAction({
          ...payload,
          is_active: true,
        });

    setSubmitting(false);

    if (!result.success) {
      if (result.error.details) {
        setFieldErrors(result.error.details as Record<string, string[]>);
      }
      toastError(result.error.message);
      return;
    }

    success(editProduct ? "Product updated successfully." : "Product created successfully.");
    setCreateOpen(false);
    setEditProduct(null);
    resetForm();
    fetchProducts(search, statusFilter, page);
    router.refresh();
  };

  const handleDeactivate = async (product: Product) => {
    if (!confirm(`Archive product "${product.name}"? This action preserves history.`)) return;
    const result = await deactivateProductAction(product.id);
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    success("Product archived.");
    fetchProducts(search, statusFilter, page);
    router.refresh();
  };

  const totalPages = Math.ceil(data.total / data.limit);

  const activeOnPage = data.items.filter((p) => p.status === "active").length;
  const activePct = data.items.length
    ? Math.round((activeOnPage / data.items.length) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Products & plans"
        description="Manage your product catalog, variants, and subscription plans."
        icon={Package}
        actions={
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              New Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Product</DialogTitle>
              <DialogDescription>
                Add a new product to your catalog. Variants and plans can be added after creation.
              </DialogDescription>
            </DialogHeader>
            <ProductForm
              form={form}
              setForm={setForm}
              fieldErrors={fieldErrors}
            />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" isLoading={submitting} onClick={handleSubmit}>
                Create Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiStatCard
          title="Catalog size"
          value={data.total}
          subtitle="Products in catalog"
          icon={Layers}
          accent="violet"
        />
        <KpiStatCard
          title="Active SKUs"
          value={activeOnPage}
          subtitle={`${data.items.length} on this page`}
          icon={Package}
          accent="blue"
          trend={{ value: activePct, label: "active share", direction: activePct >= 75 ? "up" : "neutral" }}
          delay={0.05}
        />
        <KpiStatCard
          title="Draft / archived"
          value={data.items.filter((p) => p.status !== "active").length}
          subtitle="Non-active on current view"
          icon={Archive}
          accent="slate"
          delay={0.1}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              id="product-search"
              placeholder="Search by name, code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftAddon={<Search className="h-4 w-4" />}
              className="sm:max-w-xs"
            />
            <Select
              id="product-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              className="sm:max-w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Products{" "}
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({data.total} total)
            </span>
          </CardTitle>
          <CardDescription>
            Click a product to view its variants and plans.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.items.length === 0 ? (
                <TableEmpty colSpan={5} message="No products found" />
              ) : (
                data.items.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <a
                        href={`/products/${product.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {product.name}
                      </a>
                      {product.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700">
                        {product.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(product.status)}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {formatDate(product.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(product)}
                        >
                          Edit
                        </Button>
                        {product.status !== "archived" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeactivate(product)}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * data.limit + 1}–
                {Math.min(page * data.limit, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = page - 1;
                    setPage(next);
                    fetchProducts(search, statusFilter, next);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    fetchProducts(search, statusFilter, next);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editProduct}
        onOpenChange={(open) => {
          if (!open) {
            setEditProduct(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update product details. Price history is preserved in existing quotations and invoices.
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditProduct(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button size="sm" isLoading={submitting} onClick={handleSubmit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-form component ────────────────────────────────────────────────────────

interface ProductFormProps {
  form: {
    name: string;
    code: string;
    description: string;
    status: ProductStatus;
    product_type: string;
    sales_price: string;
    cost_price: string;
    pricing_currency: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<ProductFormProps["form"]>
  >;
  fieldErrors: Record<string, string[]>;
}

function ProductForm({ form, setForm, fieldErrors }: ProductFormProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input
            id="product-name"
            label="Product Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={fieldErrors.name?.[0]}
            placeholder="e.g. Enterprise Suite"
          />
        </div>
        <Input
          id="product-code"
          label="Product Code"
          required
          value={form.code}
          onChange={(e) =>
            setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
          }
          error={fieldErrors.code?.[0]}
          placeholder="ENT-SUITE"
          helperText="Uppercase. Used as unique identifier."
        />
        <Select
          id="product-status"
          label="Status"
          value={form.status}
          onChange={(e) =>
            setForm((f) => ({ ...f, status: e.target.value as ProductStatus }))
          }
          options={[
            { value: "active", label: "Active" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <Input
          id="product-type"
          label="Product type"
          value={form.product_type}
          onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))}
          placeholder="saas, service, license…"
        />
        <Input
          id="product-sales-price"
          label="Sales price"
          type="number"
          min={0}
          step="0.01"
          value={form.sales_price}
          onChange={(e) => setForm((f) => ({ ...f, sales_price: e.target.value }))}
        />
        <Input
          id="product-cost-price"
          label="Cost price"
          type="number"
          min={0}
          step="0.01"
          value={form.cost_price}
          onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
        />
        <Input
          id="product-pricing-currency"
          label="Pricing currency"
          value={form.pricing_currency}
          onChange={(e) =>
            setForm((f) => ({ ...f, pricing_currency: e.target.value.toUpperCase() }))
          }
          maxLength={3}
        />
      </div>
      <Textarea
        id="product-description"
        label="Description"
        value={form.description}
        onChange={(e) =>
          setForm((f) => ({ ...f, description: e.target.value }))
        }
        placeholder="Describe what this product offers…"
        rows={3}
      />
    </div>
  );
}
