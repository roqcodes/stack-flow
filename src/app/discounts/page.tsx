"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  listDiscountsAction,
  createDiscountAction,
  toggleDiscountStatusAction,
  deleteDiscountAction,
} from "@/modules/discounts/actions";
import { DiscountWithProducts, DiscountType } from "@/modules/discounts/types";
import {
  Percent,
  Plus,
  Search,
  Tag,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  Filter,
  DollarSign,
  TrendingUp,
} from "lucide-react";

export default function DiscountsPage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [discounts, setDiscounts] = React.useState<DiscountWithProducts[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<"ALL" | DiscountType>("ALL");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Form states
  const [formName, setFormName] = React.useState("");
  const [formCode, setFormCode] = React.useState("");
  const [formType, setFormType] = React.useState<DiscountType>("percentage");
  const [formValue, setFormValue] = React.useState("");
  const [formMaxRedemptions, setFormMaxRedemptions] = React.useState("");
  const [formValidFrom, setFormValidFrom] = React.useState("");
  const [formValidUntil, setFormValidUntil] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const result = await listDiscountsAction();
        if (isMounted) {
          if (result.success && result.data) {
            setDiscounts(result.data);
          } else {
            toastError(result.error || "Failed to fetch discounts");
          }
        }
      } catch {
        if (isMounted) {
          toastError("Network error while loading discounts");
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
  }, [refreshKey, toastError]);

  const openCreateModal = () => {
    setFormName("");
    setFormCode("");
    setFormType("percentage");
    setFormValue("");
    setFormMaxRedemptions("");
    setFormValidFrom("");
    setFormValidUntil("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valNum = parseFloat(formValue);
    if (isNaN(valNum) || valNum <= 0) {
      toastError("Discount value must be greater than zero");
      return;
    }
    if (formType === "percentage" && valNum > 100) {
      toastError("Percentage discounts cannot exceed 100%");
      return;
    }

    const maxRedemptionsNum = formMaxRedemptions ? parseInt(formMaxRedemptions, 10) : undefined;

    setIsSubmitting(true);
    try {
      const result = await createDiscountAction({
        name: formName,
        code: formCode.toUpperCase(),
        type: formType,
        value: valNum,
        max_redemptions: maxRedemptionsNum || null,
        valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : null,
        valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : null,
        is_active: true,
      });

      if (result.success) {
        toastSuccess("Discount code created successfully");
        setIsModalOpen(false);
        setRefreshKey((k) => k + 1);
      } else {
        toastError(result.error || "Failed to create discount");
      }
    } catch {
      toastError("Error submitting discount");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (discount: DiscountWithProducts) => {
    try {
      const result = await toggleDiscountStatusAction(discount.id, !discount.is_active);
      if (result.success) {
        toastSuccess(`Discount ${!discount.is_active ? "activated" : "deactivated"}`);
        setDiscounts((prev) =>
          prev.map((d) => (d.id === discount.id ? { ...d, is_active: !discount.is_active } : d))
        );
      } else {
        toastError(result.error || "Failed to toggle status");
      }
    } catch {
      toastError("Network error while updating status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this discount?")) return;

    try {
      const result = await deleteDiscountAction(id);
      if (result.success) {
        toastSuccess("Discount deleted");
        setDiscounts((prev) => prev.filter((d) => d.id !== id));
      } else {
        toastError(result.error || "Failed to delete discount");
      }
    } catch {
      toastError("Network error while deleting discount");
    }
  };

  // Filtered list
  const filteredDiscounts = React.useMemo(() => {
    return discounts.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.code.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "ALL" || d.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [discounts, search, typeFilter]);

  // Metric stats
  const activeCount = discounts.filter((d) => d.is_active).length;
  const totalRedemptions = discounts.reduce((acc, d) => acc + d.times_redeemed, 0);
  const percentageCount = discounts.filter((d) => d.type === "percentage" && d.is_active).length;
  const fixedCount = discounts.filter((d) => d.type === "fixed_amount" && d.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Discounts & Coupons</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage promotional codes, percentage and fixed reductions, validity periods, and redemption caps.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="h-4 w-4" /> Create Coupon Code
        </Button>
      </div>
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Coupons</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</p>
                <p className="text-xs text-slate-400 mt-1">out of {discounts.length} total created</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Tag className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Times Redeemed</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalRedemptions}</p>
                <p className="text-xs text-slate-400 mt-1">total customer claims</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Percentage Rules</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{percentageCount}</p>
                <p className="text-xs text-slate-400 mt-1">rate-based reductions</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Percent className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Fixed Amount Rules</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{fixedCount}</p>
                <p className="text-xs text-slate-400 mt-1">dollar-off reductions</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
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
                placeholder="Search coupon code or name..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="h-3.5 w-3.5" /> Type:
              </div>
              <select
                aria-label="Filter Discount Type"
                className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "ALL" | DiscountType)}
              >
                <option value="ALL">All Discount Types</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount ($)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Discounts Data Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Active Coupons & Discounts</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Promotions evaluated server-side against subscriptions and invoice line items.
                </CardDescription>
              </div>
              <Badge variant="secondary">{filteredDiscounts.length} Coupons</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : filteredDiscounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Tag className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No discounts found</p>
                <p className="text-xs text-slate-500 mt-1">Create your first coupon code to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Coupon Code</TableHead>
                    <TableHead>Promotion Name</TableHead>
                    <TableHead>Discount Value</TableHead>
                    <TableHead>Redemptions</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDiscounts.map((discount) => (
                    <TableRow key={discount.id} className="hover:bg-slate-50/70">
                      <TableCell>
                        <code className="rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-mono font-semibold">
                          {discount.code}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {discount.name}
                      </TableCell>
                      <TableCell>
                        {discount.type === "percentage" ? (
                          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 font-semibold">
                            {discount.value}% OFF
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 font-semibold">
                            ${discount.value.toFixed(2)} OFF
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600">
                          {discount.times_redeemed}{" "}
                          {discount.max_redemptions ? `/ ${discount.max_redemptions}` : "(Unlimited)"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-500">
                          {discount.valid_until
                            ? `Expires ${new Date(discount.valid_until).toLocaleDateString()}`
                            : "Permanent"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleStatus(discount)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                        >
                          {discount.is_active ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <span className="text-emerald-700">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-500">Inactive</span>
                            </>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(discount.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Discount Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogHeader>
            <DialogTitle>Create Coupon / Discount</DialogTitle>
            <DialogDescription>
              Configure promotional codes, percentage/fixed discounts, and usage caps.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-slate-700">Promotion Name *</label>
              <Input
                placeholder="e.g. Q4 Growth Promo"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Promo Code *</label>
                <Input
                  placeholder="GROWTH20"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  required
                  className="mt-1 uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Discount Type *</label>
                <select
                  aria-label="Form Discount Type"
                  className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as DiscountType)}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed_amount">Fixed Amount ($)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">
                  {formType === "percentage" ? "Discount Rate (%) *" : "Discount Amount ($) *"}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={formType === "percentage" ? "100" : undefined}
                  placeholder={formType === "percentage" ? "20" : "50.00"}
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Max Total Redemptions</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Unlimited if empty"
                  value={formMaxRedemptions}
                  onChange={(e) => setFormMaxRedemptions(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Valid From (Optional)</label>
                <Input
                  type="date"
                  value={formValidFrom}
                  onChange={(e) => setFormValidFrom(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Valid Until (Optional)</label>
                <Input
                  type="date"
                  value={formValidUntil}
                  onChange={(e) => setFormValidUntil(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create Coupon"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      </div>
  );
}
