import { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth/auth-utils";
import { getProductAction } from "@/modules/products/actions";
import { ProductDetailClient } from "./product-detail-client";

export const instant = false;

interface Props {
  params: Promise<{ productId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productId } = await params;
  const result = await getProductAction(productId);
  const name = result.success ? result.data.product.name : "Product";
  return {
    title: `${name} — Brightloop`,
    description: `Manage product details, variants and plans for ${name}.`,
  };
}

export default async function ProductDetailPage({ params }: Props) {
  await requirePermission("catalog:view");

  const { productId } = await params;
  const result = await getProductAction(productId);

  if (!result.success) {
    notFound();
  }

  return <ProductDetailClient data={result.data} />;
}
