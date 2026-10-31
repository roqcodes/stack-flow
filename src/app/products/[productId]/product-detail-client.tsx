"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Plus,
  Layers,
  Tag,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  createVariantAction,
  updateVariantAction,
  deactivateVariantAction,
  createPlanAction,
  updatePlanAction,
  deactivatePlanAction,
  createPlanRuleAction,
  deletePlanRuleAction,
  getPlanAction,
} from "@/modules/products/actions";
import { Product, ProductVariant, Plan, PlanRule, BillingCycle } from "@/modules/products/types";
import { formatDate, formatCurrency, getStatusBadgeVariant } from "@/lib/utils";

interface ProductDetailClientProps {
  data: {
    product: Product;
    variants: ProductVariant[];
    plans: Plan[];
  };
}

type Tab = "overview" | "variants" | "plans";

export function ProductDetailClient({ data: initialData }: ProductDetailClientProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const [variants, setVariants] = React.useState(initialData.variants);
  const [plans, setPlans] = React.useState(initialData.plans);

  const { product } = initialData;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/products")}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          className="mb-3"
        >
          Products
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {product.name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
                  {product.code}
                </code>
                <Badge variant={getStatusBadgeVariant(product.status)}>
                  {product.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        {product.description && (
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">{product.description}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        {(["overview", "variants", "plans"] as Tab[]).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Created</span>
                <p className="font-medium text-slate-900">{formatDate(product.created_at)}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Last Updated</span>
                <p className="font-medium text-slate-900">{formatDate(product.updated_at)}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Variants</span>
                <p className="font-medium text-slate-900">{variants.length}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Plans</span>
                <p className="font-medium text-slate-900">{plans.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Quick Plan Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {plans.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No plans configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {plans.slice(0, 5).map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{plan.name}</p>
                        <p className="text-xs text-slate-400">
                          {plan.billing_interval_count > 1
                            ? `Every ${plan.billing_interval_count} ${plan.billing_cycle}s`
                            : `Per ${plan.billing_cycle}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">
                          {formatCurrency(plan.price, plan.currency)}
                        </p>
                        <Badge variant={getStatusBadgeVariant(plan.status)} className="text-[10px]">
                          {plan.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "variants" && (
        <VariantsTab
          productId={product.id}
          variants={variants}
          setVariants={setVariants}
          success={success}
          toastError={toastError}
        />
      )}

      {activeTab === "plans" && (
        <PlansTab
          productId={product.id}
          variants={variants}
          plans={plans}
          setPlans={setPlans}
          success={success}
          toastError={toastError}
        />
      )}
    </div>
  );
}

// ─── Variants Tab ──────────────────────────────────────────────────────────────

interface VariantsTabProps {
  productId: string;
  variants: ProductVariant[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>;
  success: (msg: string) => void;
  toastError: (msg: string) => void;
}

function VariantsTab({ productId, variants, setVariants, success, toastError }: VariantsTabProps) {
  const [open, setOpen] = React.useState(false);
  const [editVariant, setEditVariant] = React.useState<ProductVariant | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", sku: "" });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const resetForm = () => {
    setForm({ name: "", sku: "" });
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFieldErrors({});

    const result = editVariant
      ? await updateVariantAction(editVariant.id, { name: form.name, sku: form.sku.toUpperCase() })
      : await createVariantAction({
          product_id: productId,
          name: form.name,
          sku: form.sku.toUpperCase(),
          attributes: {},
          is_active: true,
        });

    setSubmitting(false);

    if (!result.success) {
      if (result.error.details) setFieldErrors(result.error.details as Record<string, string[]>);
      toastError(result.error.message);
      return;
    }

    success(editVariant ? "Variant updated." : "Variant created.");

    if (editVariant) {
      setVariants((prev) => prev.map((v) => (v.id === result.data.id ? result.data : v)));
    } else {
      setVariants((prev) => [...prev, result.data]);
    }

    setOpen(false);
    setEditVariant(null);
    resetForm();
  };

  const handleDeactivate = async (variant: ProductVariant) => {
    const result = await deactivateVariantAction(variant.id);
    if (!result.success) { toastError(result.error.message); return; }
    success("Variant deactivated.");
    setVariants((prev) => prev.map((v) => (v.id === result.data.id ? result.data : v)));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Variants
          </CardTitle>
          <CardDescription>SKU-level product variants with custom attributes.</CardDescription>
        </div>
        <Dialog open={open || !!editVariant} onOpenChange={(o) => { if (!o) { setOpen(false); setEditVariant(null); resetForm(); } else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              Add Variant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editVariant ? "Edit Variant" : "Add Variant"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input id="variant-name" label="Variant Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={fieldErrors.name?.[0]} placeholder="e.g. Pro — 10 Seats" />
              <Input id="variant-sku" label="SKU" required value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))} error={fieldErrors.sku?.[0]} placeholder="ENT-PRO-10" helperText="Auto-uppercased unique stock keeping unit." />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); setEditVariant(null); resetForm(); }}>Cancel</Button>
              <Button size="sm" isLoading={submitting} onClick={handleSubmit}>
                {editVariant ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <TableEmpty colSpan={4} message="No variants yet" />
            ) : (
              variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">{v.sku}</code></TableCell>
                  <TableCell><Badge variant={v.is_active ? "success" : "outline"}>{v.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditVariant(v); setForm({ name: v.name, sku: v.sku }); }}>Edit</Button>
                      {v.is_active && <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDeactivate(v)}>Deactivate</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Plans Tab ─────────────────────────────────────────────────────────────────

interface PlansTabProps {
  productId: string;
  variants: ProductVariant[];
  plans: Plan[];
  setPlans: React.Dispatch<React.SetStateAction<Plan[]>>;
  success: (msg: string) => void;
  toastError: (msg: string) => void;
}

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function PlansTab({ productId, variants, plans, setPlans, success, toastError }: PlansTabProps) {
  const [open, setOpen] = React.useState(false);
  const [editPlan, setEditPlan] = React.useState<Plan | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [planRules, setPlanRules] = React.useState<PlanRule[]>([]);
  const [rulesDialogPlanId, setRulesDialogPlanId] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    code: "",
    billing_cycle: "monthly" as BillingCycle,
    billing_interval_count: 1,
    currency: "USD",
    price: 0,
    trial_period_days: 0,
    setup_fee: 0,
    status: "active" as "active" | "draft" | "archived",
    variant_id: "",
  });

  const resetForm = () => {
    setForm({ name: "", code: "", billing_cycle: "monthly", billing_interval_count: 1, currency: "USD", price: 0, trial_period_days: 0, setup_fee: 0, status: "active", variant_id: "" });
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFieldErrors({});

    const payload = {
      ...form,
      code: form.code.toUpperCase(),
      variant_id: form.variant_id || null,
    };

    const result = editPlan
      ? await updatePlanAction(editPlan.id, payload)
      : await createPlanAction({ ...payload, product_id: productId, is_active: true });

    setSubmitting(false);

    if (!result.success) {
      if (result.error.details) setFieldErrors(result.error.details as Record<string, string[]>);
      toastError(result.error.message);
      return;
    }

    success(editPlan ? "Plan updated." : "Plan created.");
    if (editPlan) {
      setPlans((prev) => prev.map((p) => (p.id === result.data.id ? result.data : p)));
    } else {
      setPlans((prev) => [...prev, result.data]);
    }
    setOpen(false);
    setEditPlan(null);
    resetForm();
  };

  const openRules = async (planId: string) => {
    const result = await getPlanAction(planId);
    if (result.success) {
      setPlanRules(result.data.rules);
      setRulesDialogPlanId(planId);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const result = await deletePlanRuleAction(ruleId);
    if (!result.success) { toastError(result.error.message); return; }
    setPlanRules((prev) => prev.filter((r) => r.id !== ruleId));
    success("Rule deleted.");
  };

  const handleDeactivatePlan = async (plan: Plan) => {
    const result = await deactivatePlanAction(plan.id);
    if (!result.success) { toastError(result.error.message); return; }
    success("Plan archived.");
    setPlans((prev) => prev.map((p) => (p.id === result.data.id ? result.data : p)));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" /> Subscription Plans
            </CardTitle>
            <CardDescription>Configure billing cycles, prices, trial periods and rules.</CardDescription>
          </div>
          <Dialog open={open || !!editPlan} onOpenChange={(o) => { if (!o) { setOpen(false); setEditPlan(null); resetForm(); } else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>Add Plan</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
                <DialogDescription>Configure billing cycle, price, trial period, and variant link.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Input id="plan-name" label="Plan Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={fieldErrors.name?.[0]} placeholder="Monthly Pro" />
                  </div>
                  <Input id="plan-code" label="Plan Code" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} error={fieldErrors.code?.[0]} placeholder="PRO-MONTHLY" />
                  <Select id="plan-variant" label="Variant (optional)" value={form.variant_id} onChange={(e) => setForm((f) => ({ ...f, variant_id: e.target.value }))}>
                    <option value="">No variant</option>
                    {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </Select>
                  <Select id="plan-billing-cycle" label="Billing Cycle" required value={form.billing_cycle} onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value as BillingCycle }))} options={BILLING_CYCLES} />
                  <Input id="plan-interval" label="Interval Count" type="number" min={1} value={form.billing_interval_count} onChange={(e) => setForm((f) => ({ ...f, billing_interval_count: Number(e.target.value) }))} error={fieldErrors.billing_interval_count?.[0]} helperText="e.g. 3 = every 3 months" />
                  <Input id="plan-price" label="Price" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} error={fieldErrors.price?.[0]} leftAddon={<span className="text-xs">$</span>} />
                  <Input id="plan-currency" label="Currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} error={fieldErrors.currency?.[0]} placeholder="USD" />
                  <Input id="plan-trial" label="Trial Days" type="number" min={0} value={form.trial_period_days} onChange={(e) => setForm((f) => ({ ...f, trial_period_days: Number(e.target.value) }))} />
                  <Input id="plan-setup-fee" label="Setup Fee" type="number" min={0} step="0.01" value={form.setup_fee} onChange={(e) => setForm((f) => ({ ...f, setup_fee: Number(e.target.value) }))} leftAddon={<span className="text-xs">$</span>} />
                  <Select id="plan-status" label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "draft" | "archived" }))} options={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }]} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => { setOpen(false); setEditPlan(null); resetForm(); }}>Cancel</Button>
                <Button size="sm" isLoading={submitting} onClick={handleSubmit}>
                  {editPlan ? "Save" : "Create Plan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableEmpty colSpan={6} message="No plans yet" />
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <p className="font-medium text-slate-900">{plan.name}</p>
                      <code className="text-xs text-slate-400 font-mono">{plan.code}</code>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {plan.billing_interval_count > 1
                        ? `Every ${plan.billing_interval_count} ${plan.billing_cycle}s`
                        : `Per ${plan.billing_cycle}`}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(plan.price, plan.currency)}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {plan.trial_period_days > 0 ? `${plan.trial_period_days}d` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(plan.status)}>{plan.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openRules(plan.id)} rightIcon={<ChevronRight className="h-3 w-3" />}>Rules</Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditPlan(plan); setForm({ name: plan.name, code: plan.code, billing_cycle: plan.billing_cycle, billing_interval_count: plan.billing_interval_count, currency: plan.currency, price: plan.price, trial_period_days: plan.trial_period_days, setup_fee: plan.setup_fee, status: plan.status, variant_id: plan.variant_id ?? "" }); }}>Edit</Button>
                        {plan.status !== "archived" && (
                          <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDeactivatePlan(plan)}>Archive</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Plan Rules Dialog */}
      <PlanRulesDialog
        planId={rulesDialogPlanId}
        rules={planRules}
        setRules={setPlanRules}
        onClose={() => { setRulesDialogPlanId(null); setPlanRules([]); }}
        onDeleteRule={handleDeleteRule}
        success={success}
        toastError={toastError}
      />
    </div>
  );
}

// ─── Plan Rules Dialog ─────────────────────────────────────────────────────────

interface PlanRulesDialogProps {
  planId: string | null;
  rules: PlanRule[];
  setRules: React.Dispatch<React.SetStateAction<PlanRule[]>>;
  onClose: () => void;
  onDeleteRule: (ruleId: string) => void;
  success: (msg: string) => void;
  toastError: (msg: string) => void;
}

const RULE_TYPE_OPTIONS = [
  { value: "allow_pause", label: "Allow Pause" },
  { value: "allow_renewal", label: "Allow Renewal" },
  { value: "allow_early_closure", label: "Allow Early Closure" },
  { value: "auto_close_after_days", label: "Auto Close After (days)" },
  { value: "min_quantity", label: "Minimum Quantity" },
  { value: "max_quantity", label: "Maximum Quantity" },
  { value: "seat_limit", label: "Seat Limit" },
  { value: "storage_gb", label: "Storage (GB)" },
  { value: "api_rate_limit", label: "API Rate Limit" },
  { value: "availability_start", label: "Availability Start Date" },
  { value: "availability_end", label: "Availability End Date" },
];

function PlanRulesDialog({ planId, rules, setRules, onClose, onDeleteRule, success, toastError }: PlanRulesDialogProps) {
  const [form, setForm] = React.useState({ rule_type: "allow_pause", rule_value: "true", description: "" });
  const [submitting, setSubmitting] = React.useState(false);

  const handleAdd = async () => {
    if (!planId) return;
    setSubmitting(true);
    const result = await createPlanRuleAction({ plan_id: planId, ...form });
    setSubmitting(false);
    if (!result.success) { toastError(result.error.message); return; }
    setRules((prev) => [...prev, result.data]);
    success("Rule added.");
    setForm({ rule_type: "allow_pause", rule_value: "true", description: "" });
  };

  return (
    <Dialog open={!!planId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan Rules</DialogTitle>
          <DialogDescription>Configure availability, permissions, and quota rules.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No rules configured.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{rule.rule_type}</p>
                    <p className="text-xs text-slate-500">{rule.rule_value}{rule.description ? ` — ${rule.description}` : ""}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 shrink-0" onClick={() => onDeleteRule(rule.id)}>Remove</Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Rule</p>
            <Select id="rule-type" label="Rule Type" value={form.rule_type} onChange={(e) => setForm((f) => ({ ...f, rule_type: e.target.value }))} options={RULE_TYPE_OPTIONS} />
            <Input id="rule-value" label="Value" value={form.rule_value} onChange={(e) => setForm((f) => ({ ...f, rule_value: e.target.value }))} placeholder='e.g. "true", "100", "2026-12-31"' />
            <Input id="rule-description" label="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Human-readable explanation" />
            <Button size="sm" isLoading={submitting} onClick={handleAdd} leftIcon={<Plus className="h-4 w-4" />}>Add Rule</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
