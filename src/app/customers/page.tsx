import { Metadata } from "next";
import { requirePermission } from "@/modules/auth/auth-utils";
import { ensureRequestScope } from "@/lib/request-scope";
import { listCustomersAction } from "@/modules/customers/actions";
import { CustomersClient } from "./customers-client";

export const instant = false;

export const metadata: Metadata = {
  title: "Customers — Brightloop",
  description: "Manage your customer directory, company details, and account links.",
};

export default async function CustomersPage() {
  await ensureRequestScope();
  await requirePermission("customers:view");

  const result = await listCustomersAction({ page: 1, limit: 20 });

  return (
    <CustomersClient
      initialData={result.success ? result.data : { items: [], total: 0, page: 1, limit: 20 }}
    />
  );
}
