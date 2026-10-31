import { Metadata } from "next";
import { requirePermission } from "@/modules/auth/auth-utils";
import { listProductsAction } from "@/modules/products/actions";
import { ProductsClient } from "./products-client";

export const instant = false;

export const metadata: Metadata = {
  title: "Products & Plans — Brightloop",
  description: "Manage your product catalog, variants, and subscription plans.",
};

export default async function ProductsPage() {
  await requirePermission("catalog:view");

  const result = await listProductsAction({ page: 1, limit: 20 });

  return (
    <ProductsClient
      initialData={result.success ? result.data : { items: [], total: 0, page: 1, limit: 20 }}
    />
  );
}
