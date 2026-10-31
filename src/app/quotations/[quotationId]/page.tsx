import { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth/auth-utils";
import { getQuotationAction } from "@/modules/quotations/actions";
import { QuotationDetailClient } from "./quotation-detail-client";

export const instant = false;

interface PageProps {
  params: Promise<{ quotationId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { quotationId } = await params;
  const result = await getQuotationAction(quotationId);
  const number = result.success ? result.data.quotation_number : "Quotation";
  return {
    title: `${number} — Brightloop`,
    description: "Quotation snapshot, PDF export, and customer delivery.",
  };
}

export default async function QuotationDetailPage({ params }: PageProps) {
  await requirePermission("quotations:view");
  const { quotationId } = await params;
  const result = await getQuotationAction(quotationId);

  if (!result.success) {
    notFound();
  }

  return <QuotationDetailClient quotation={result.data} />;
}
