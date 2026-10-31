"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  createQuotationTemplateAction,
  addTemplateItemAction,
  removeTemplateItemAction,
  QuotationTemplateWithItems,
} from "@/modules/quotations/actions";
import { Product } from "@/modules/products/types";

interface TemplatesClientProps {
  initialTemplates: QuotationTemplateWithItems[];
  products: Product[];
}

export function TemplatesClient({ initialTemplates, products }: TemplatesClientProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [terms, setTerms] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [itemTemplateId, setItemTemplateId] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);

  const handleCreateTemplate = async () => {
    setLoading(true);
    const result = await createQuotationTemplateAction({
      name,
      description: description || undefined,
      terms: terms || undefined,
      is_active: true,
    });
    setLoading(false);
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    setTemplates((prev) => [...prev, { ...result.data, items: [] }]);
    success("Template created.");
    setOpen(false);
    setName("");
    setDescription("");
    setTerms("");
    router.refresh();
  };

  const handleAddItem = async () => {
    if (!itemTemplateId || !productId) return;
    const result = await addTemplateItemAction({
      template_id: itemTemplateId,
      product_id: productId,
      quantity,
      default_discount_percentage: 0,
    });
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    success("Line added to template.");
    router.refresh();
  };

  const handleRemoveItem = async (itemId: string, templateId: string) => {
    const result = await removeTemplateItemAction(itemId);
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t
      )
    );
    success("Line removed.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-600" />
            Quotation Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Reusable layouts with product lines. Pricing is snapshotted when a quotation is created.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create template</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input id="tpl-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Textarea id="tpl-desc" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              <Textarea id="tpl-terms" label="Default terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button size="sm" isLoading={loading} onClick={handleCreateTemplate}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add template line</CardTitle>
          <CardDescription>Attach a catalog product (optional plan can be added via API later).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Select
            id="tpl-pick"
            label="Template"
            value={itemTemplateId}
            onChange={(e) => setItemTemplateId(e.target.value)}
            className="flex-1"
          >
            <option value="">Select template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <Select
            id="prod-pick"
            label="Product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="flex-1"
          >
            <option value="">Select product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Input
            id="qty"
            label="Qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-24"
          />
          <Button size="sm" className="self-end" onClick={handleAddItem}>
            Add line
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {templates.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No templates yet.</p>
        ) : (
          templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="text-base">{template.name}</CardTitle>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {template.items.length === 0 ? (
                  <p className="text-sm text-slate-400">No lines configured.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {template.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2"
                      >
                        <span>
                          {item.product?.name ?? item.product_id} × {item.quantity}
                          {item.plan ? ` · ${item.plan.name}` : ""}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => handleRemoveItem(item.id, template.id)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
