import { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/modules/auth/auth-utils";
import {
  listQuotationTemplatesAction,
  getQuotationTemplateAction,
} from "@/modules/quotations/actions";
import { listProductsAction } from "@/modules/products/actions";
import { TemplatesClient } from "./templates-client";

export const instant = false;

export const metadata: Metadata = {
  title: "Quotation Templates — Brightloop",
  description: "Reusable quotation templates with product lines and pricing snapshots.",
};

export default async function QuotationTemplatesPage() {
  await requirePermission("quotations:view");

  const [templatesResult, productsResult] = await Promise.all([
    listQuotationTemplatesAction(),
    listProductsAction({ page: 1, limit: 100, is_active: true }),
  ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const products = productsResult.success ? productsResult.data.items : [];

  const templatesWithItems = await Promise.all(
    templates.map(async (t) => {
      const detail = await getQuotationTemplateAction(t.id);
      return detail.success ? detail.data : { ...t, items: [] };
    })
  );

  return (
    <div className="space-y-4">
      <Link href="/quotations" className="text-sm text-slate-500 hover:text-blue-600">
        ← Back to quotations
      </Link>
      <TemplatesClient initialTemplates={templatesWithItems} products={products} />
    </div>
  );
}
