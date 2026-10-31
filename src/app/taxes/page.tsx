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
  listTaxesAction,
  createTaxAction,
  updateTaxAction,
  toggleTaxStatusAction,
  deleteTaxAction,
} from "@/modules/taxes/actions";
import { Tax } from "@/modules/taxes/types";
import {
  Calculator,
  Plus,
  Search,
  Globe,
  Layers,
  Percent,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Loader2,
  Filter,
} from "lucide-react";

export default function TaxesPage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [taxes, setTaxes] = React.useState<Tax[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [countryFilter, setCountryFilter] = React.useState("ALL");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTax, setEditingTax] = React.useState<Tax | null>(null);

  // Form states
  const [formName, setFormName] = React.useState("");
  const [formCode, setFormCode] = React.useState("");
  const [formCountry, setFormCountry] = React.useState("US");
  const [formState, setFormState] = React.useState("");
  const [formRate, setFormRate] = React.useState("");
  const [formIsCompound, setFormIsCompound] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const result = await listTaxesAction();
        if (isMounted) {
          if (result.success && result.data) {
            setTaxes(result.data);
          } else {
            toastError(result.error || "Failed to fetch tax rules");
          }
        }
      } catch {
        if (isMounted) {
          toastError("Network error while loading tax rules");
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
    setEditingTax(null);
    setFormName("");
    setFormCode("");
    setFormCountry("US");
    setFormState("");
    setFormRate("");
    setFormIsCompound(false);
    setIsModalOpen(true);
  };

  const openEditModal = (tax: Tax) => {
    setEditingTax(tax);
    setFormName(tax.name);
    setFormCode(tax.code);
    setFormCountry(tax.country);
    setFormState(tax.state_province || "");
    setFormRate(tax.rate.toString());
    setFormIsCompound(tax.is_compound);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(formRate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      toastError("Please enter a valid rate between 0 and 100%");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTax) {
        const result = await updateTaxAction(editingTax.id, {
          name: formName,
          code: formCode.toUpperCase(),
          country: formCountry.toUpperCase(),
          state_province: formState.trim() || null,
          rate: rateNum,
          is_compound: formIsCompound,
        });

        if (result.success) {
          toastSuccess("Tax rule updated successfully");
          setIsModalOpen(false);
          setRefreshKey((k) => k + 1);
        } else {
          toastError(result.error || "Failed to update tax rule");
        }
      } else {
        const result = await createTaxAction({
          name: formName,
          code: formCode.toUpperCase(),
          country: formCountry.toUpperCase(),
          state_province: formState.trim() || null,
          rate: rateNum,
          is_compound: formIsCompound,
          is_active: true,
        });

        if (result.success) {
          toastSuccess("Tax jurisdiction created successfully");
          setIsModalOpen(false);
          setRefreshKey((k) => k + 1);
        } else {
          toastError(result.error || "Failed to create tax rule");
        }
      }
    } catch {
      toastError("Error submitting tax rule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (tax: Tax) => {
    try {
      const result = await toggleTaxStatusAction(tax.id, !tax.is_active);
      if (result.success) {
        toastSuccess(`Tax rule ${!tax.is_active ? "activated" : "deactivated"}`);
        setTaxes((prev) =>
          prev.map((t) => (t.id === tax.id ? { ...t, is_active: !tax.is_active } : t))
        );
      } else {
        toastError(result.error || "Failed to toggle status");
      }
    } catch {
      toastError("Network error while updating status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tax rule?")) return;

    try {
      const result = await deleteTaxAction(id);
      if (result.success) {
        toastSuccess("Tax rule deleted");
        setTaxes((prev) => prev.filter((t) => t.id !== id));
      } else {
        toastError(result.error || "Failed to delete tax rule");
      }
    } catch {
      toastError("Network error while deleting tax rule");
    }
  };

  // Filtered dataset
  const filteredTaxes = React.useMemo(() => {
    return taxes.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase()) ||
        t.country.toLowerCase().includes(search.toLowerCase());
      const matchesCountry = countryFilter === "ALL" || t.country === countryFilter;
      return matchesSearch && matchesCountry;
    });
  }, [taxes, search, countryFilter]);

  // Metric stats
  const uniqueCountries = new Set(taxes.map((t) => t.country)).size;
  const activeCount = taxes.filter((t) => t.is_active).length;
  const compoundCount = taxes.filter((t) => t.is_compound && t.is_active).length;
  const avgRate =
    taxes.length > 0 ? (taxes.reduce((acc, t) => acc + t.rate, 0) / taxes.length).toFixed(2) : "0.00";

  const allCountries = Array.from(new Set(taxes.map((t) => t.country))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Taxes & Jurisdictions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure tax rates, country & state jurisdictions, compound calculation rules, and snapshot policies.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="h-4 w-4" /> Add Tax Jurisdiction
        </Button>
      </div>
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Rules</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</p>
                <p className="text-xs text-slate-400 mt-1">out of {taxes.length} total defined</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calculator className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Countries Covered</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{uniqueCountries}</p>
                <p className="text-xs text-slate-400 mt-1">global tax jurisdictions</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Globe className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Average Rate</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{avgRate}%</p>
                <p className="text-xs text-slate-400 mt-1">across all active rates</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Percent className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Compound Rules</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{compoundCount}</p>
                <p className="text-xs text-slate-400 mt-1">stacked on base taxes</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search rule name or code..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="h-3.5 w-3.5" /> Filter Country:
              </div>
              <select
                aria-label="Filter Country"
                className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              >
                <option value="ALL">All Countries</option>
                {allCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Taxes Data Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Configured Tax Jurisdictions</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Tax rates applied server-side to subscriptions and permanently snapshotted onto invoices.
                </CardDescription>
              </div>
              <Badge variant="secondary">{filteredTaxes.length} Jurisdictions</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : filteredTaxes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calculator className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No tax jurisdictions found</p>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your search or add a new tax rule.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Jurisdiction Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Calculation Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTaxes.map((tax) => (
                    <TableRow key={tax.id} className="hover:bg-slate-50/70">
                      <TableCell className="font-medium text-slate-900">
                        {tax.name}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 font-mono">
                          {tax.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-semibold text-xs">
                            {tax.country}
                          </Badge>
                          {tax.state_province && (
                            <span className="text-xs text-slate-500">
                              / {tax.state_province}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm text-slate-900">
                          {tax.rate.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {tax.is_compound ? (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                            Compound
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                            Standard
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleStatus(tax)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                        >
                          {tax.is_active ? (
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(tax)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tax.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit Tax Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogHeader>
            <DialogTitle>
              {editingTax ? "Edit Tax Jurisdiction" : "Create Tax Jurisdiction"}
            </DialogTitle>
            <DialogDescription>
              Define tax collection rules for invoices and recurring subscriptions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-slate-700">Jurisdiction Name *</label>
              <Input
                placeholder="e.g. California State Sales Tax"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Tax Code *</label>
                <Input
                  placeholder="TAX-US-CA"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  required
                  className="mt-1 uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Tax Rate (%) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="8.25"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Country ISO Code (2 letters) *</label>
                <Input
                  placeholder="US"
                  maxLength={2}
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value.toUpperCase())}
                  required
                  className="mt-1 uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">State / Province (Optional)</label>
                <Input
                  placeholder="CA"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_compound"
                checked={formIsCompound}
                onChange={(e) => setFormIsCompound(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="is_compound" className="text-xs text-slate-700 cursor-pointer">
                <strong>Compound Tax</strong> (Calculates on top of base taxes instead of base subtotal)
              </label>
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : editingTax ? (
                  "Update Tax Rule"
                ) : (
                  "Create Tax Rule"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      </div>
  );
}
