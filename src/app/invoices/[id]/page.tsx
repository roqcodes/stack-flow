import * as React from "react";
import { Metadata } from "next";
import { InvoiceDetailClient } from "./invoice-detail-client";

export const instant = false;

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: InvoiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Invoice ${id} — Brightloop`,
    description: "Itemized invoice breakdown, tax snapshots, and settled payment audit trail.",
  };
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { id } = await params;
  return <InvoiceDetailClient id={id} />;
}
