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
    setForm({ name: "", code: "", description: "", status: "active" });
    setFieldErrors({});
  };

  const openEdit = (product: Product) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      code: product.code,
      description: product.description ?? "",
      status: product.status,
    });
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFieldErrors({});

    const payload = {
      ...form,
      code: form.code.toUpperCase(),
      description: form.description || undefined,
    };

    const result = editProduct
      ? await updateProductAction(editProduct.id, payload)
      : await createProductAction({
          ...payload,
          is_active: true,
          metadata: {},
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Products & Plans
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your product catalog, variants, and subscription plans.
          </p>
        </div>

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
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      code: string;
      description: string;
      status: ProductStatus;
    }>
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
