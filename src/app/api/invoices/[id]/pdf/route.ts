import { NextRequest } from "next/server";
import { getCurrentProfile } from "@/modules/auth/auth-utils";
import { invoiceService } from "@/modules/invoices/invoice-service";
import { generateInvoicePdf } from "@/modules/invoices/invoice-pdf";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const invoice = await invoiceService.getInvoiceById(id);

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const pdfBytes = await generateInvoicePdf(invoice);
  const filename = `${invoice.invoice_number}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
