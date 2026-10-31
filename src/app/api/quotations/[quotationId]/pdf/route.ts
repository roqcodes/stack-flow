import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/modules/auth/auth-utils";
import { buildQuotationPdf } from "@/modules/quotations/generate-pdf";
import type { QuotationWithItems } from "@/modules/quotations/types";

interface RouteContext {
  params: Promise<{ quotationId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const profile = await getCurrentProfile();
  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { quotationId } = await context.params;
  const supabase = await createClient();

  const [quotationRes, itemsRes] = await Promise.all([
    supabase
      .from("quotations")
      .select(
        `
        *,
        customer:customers(
          id, company_name, contact_name, email, currency,
          billing_address_line1, billing_address_line2,
          billing_city, billing_state, billing_postal_code, billing_country
        )
      `
      )
      .eq("id", quotationId)
      .single(),
    supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: true }),
  ]);

  if (quotationRes.error || !quotationRes.data) {
    return new Response("Quotation not found", { status: 404 });
  }

  const quotation = {
    ...(quotationRes.data as QuotationWithItems),
    items: itemsRes.data ?? [],
  } as QuotationWithItems;

  const pdfBytes = await buildQuotationPdf(quotation);
  const filename = `${quotation.quotation_number}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
