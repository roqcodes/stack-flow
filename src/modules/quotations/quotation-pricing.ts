import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateTaxesForAmount,
  findApplicableTaxes,
} from "@/modules/taxes/tax-calculator";
import type { Tax } from "@/modules/taxes/types";
import type { QuotationLineItemInput } from "./validations";

function readMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string
): number | null {
  if (!metadata) return null;
  const value = metadata[key];
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function effectiveTaxRatePercent(taxableAmount: number, totalTax: number): number {
  if (taxableAmount <= 0 || totalTax <= 0) return 0;
  return Math.round((totalTax / taxableAmount) * 10000) / 100;
}

/**
 * Re-resolves catalog-linked line items from the database and applies jurisdiction taxes.
 * Client-supplied unit_price and tax_rate are ignored when product_id or plan_id is set.
 */
export async function resolveAuthoritativeQuotationLines(
  supabase: SupabaseClient,
  customerId: string,
  lineItems: QuotationLineItemInput[]
): Promise<
  | { ok: true; lines: QuotationLineItemInput[]; terms?: string | null }
  | { ok: false; message: string }
> {
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, currency, billing_country, billing_state, status, is_active")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return { ok: false, message: "Customer not found" };
  }

  if (!customer.is_active || customer.status !== "active") {
    return { ok: false, message: "Quotations can only be created for active customers" };
  }

  const { data: taxRows } = await supabase.from("taxes").select("*").eq("is_active", true);
  const applicableTaxes = findApplicableTaxes(
    (taxRows ?? []) as Tax[],
    customer.billing_country ?? "US",
    customer.billing_state
  );

  const resolved: QuotationLineItemInput[] = [];

  for (const item of lineItems) {
    let unit_price = item.unit_price;
    let description = item.description;
    let discount_amount = item.discount_amount;
    let quantity = item.quantity;
    const product_id = item.product_id ?? null;
    const plan_id = item.plan_id ?? null;

    if (plan_id) {
      const { data: plan } = await supabase
        .from("plans")
        .select("id, name, price, currency, billing_cycle, is_active, status, product_id")
        .eq("id", plan_id)
        .single();

      if (!plan || !plan.is_active || plan.status !== "active") {
        return { ok: false, message: "One or more selected plans are not available" };
      }

      unit_price = Number(plan.price);
      if (!description?.trim()) {
        description = `${plan.name} (${plan.billing_cycle})`;
      }
    } else if (product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("id, name, is_active, status, metadata")
        .eq("id", product_id)
        .single();

      if (!product || !product.is_active || product.status !== "active") {
        return { ok: false, message: "One or more selected products are not available" };
      }

      const meta = (product.metadata ?? {}) as Record<string, unknown>;
      const salesPrice = readMetadataNumber(meta, "sales_price");
      if (salesPrice !== null) {
        unit_price = salesPrice;
      }
      if (!description?.trim()) {
        description = product.name;
      }
    }

    const lineSubtotal = Math.round(quantity * unit_price * 100) / 100;
    const taxableAmount = Math.round((lineSubtotal - discount_amount) * 100) / 100;
    const taxCalc = calculateTaxesForAmount(taxableAmount, applicableTaxes);
    const tax_rate = effectiveTaxRatePercent(taxableAmount, taxCalc.totalTax);

    resolved.push({
      product_id,
      plan_id,
      description,
      quantity,
      unit_price,
      discount_amount,
      tax_rate,
    });
  }

  return { ok: true, lines: resolved };
}

/**
 * Builds quotation line items from a template with server-side pricing snapshots.
 */
export async function resolveTemplateQuotationLines(
  supabase: SupabaseClient,
  templateId: string,
  customerId: string
): Promise<
  | {
      ok: true;
      lines: QuotationLineItemInput[];
      terms?: string | null;
      defaultValidUntil: string;
    }
  | { ok: false; message: string }
> {
  const { data: template, error: templateError } = await supabase
    .from("quotation_templates")
    .select("id, terms, is_active")
    .eq("id", templateId)
    .single();

  if (templateError || !template || !template.is_active) {
    return { ok: false, message: "Quotation template not found or inactive" };
  }

  const { data: templateItems, error: itemsError } = await supabase
    .from("quotation_template_items")
    .select("*")
    .eq("template_id", templateId);

  if (itemsError) {
    return { ok: false, message: itemsError.message };
  }

  if (!templateItems?.length) {
    return { ok: false, message: "Template has no line items configured" };
  }

  const draftLines: QuotationLineItemInput[] = templateItems.map((row) => ({
    product_id: row.product_id,
    plan_id: row.plan_id,
    description: "",
    quantity: row.quantity,
    unit_price: 0,
    discount_amount: 0,
    tax_rate: 0,
  }));

  const priced = await resolveAuthoritativeQuotationLines(
    supabase,
    customerId,
    draftLines
  );

  if (!priced.ok) {
    return priced;
  }

  const linesWithDiscount = priced.lines.map((line, index) => {
    const pct = Number(templateItems[index]?.default_discount_percentage ?? 0);
    if (pct <= 0) return line;
    const lineSub = line.quantity * line.unit_price;
    const discount_amount = Math.round(((lineSub * pct) / 100) * 100) / 100;
    return { ...line, discount_amount };
  });

  const repriced = await resolveAuthoritativeQuotationLines(
    supabase,
    customerId,
    linesWithDiscount
  );
  if (!repriced.ok) {
    return repriced;
  }

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  return {
    ok: true,
    lines: repriced.lines,
    terms: template.terms,
    defaultValidUntil: validUntil.toISOString().slice(0, 10),
  };
}
