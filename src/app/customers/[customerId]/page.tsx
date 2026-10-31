import { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth/auth-utils";
import { getCustomerAction } from "@/modules/customers/actions";
import { CustomerDetailClient } from "./customer-detail-client";

export const instant = false;

interface PageProps {
  params: Promise<{ customerId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customerId } = await params;
  const result = await getCustomerAction(customerId);
  const name = result.success ? result.data.company_name : "Customer";
  return {
    title: `${name} — Brightloop`,
    description: "Customer profile, billing details, and account linkage.",
  };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  await requirePermission("customers:view");
  const { customerId } = await params;
  const result = await getCustomerAction(customerId);

  if (!result.success) {
    notFound();
  }

  return <CustomerDetailClient customer={result.data} />;
}
