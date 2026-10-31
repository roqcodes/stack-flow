import { Metadata } from "next";
import { requirePermission } from "@/modules/auth/auth-utils";
import { ensureRequestScope } from "@/lib/request-scope";
import { listQuotationsAction } from "@/modules/quotations/actions";
import { listCustomersAction } from "@/modules/customers/actions";
import { listQuotationTemplatesAction } from "@/modules/quotations/actions";
import { QuotationsClient } from "./quotations-client";

export const instant = false;

export const metadata: Metadata = {
  title: "Quotations — Brightloop",
  description: "Create, manage and track customer quotations.",
};

export default async function QuotationsPage() {
  await ensureRequestScope();
  await requirePermission("quotations:view");

  const [quotationsResult, customersResult, templatesResult] = await Promise.all([
    listQuotationsAction({ page: 1, limit: 20 }),
    listCustomersAction({ page: 1, limit: 100, status: "active" }),
    listQuotationTemplatesAction(),
  ]);

  return (
    <QuotationsClient
      initialQuotations={
        quotationsResult.success
          ? quotationsResult.data
          : { items: [], total: 0, page: 1, limit: 20 }
      }
      customers={customersResult.success ? customersResult.data.items : []}
      templates={templatesResult.success ? templatesResult.data : []}
    />
  );
}
