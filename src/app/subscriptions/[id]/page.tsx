import * as React from "react";
import { Metadata } from "next";
import { SubscriptionDetailClient } from "./subscription-detail-client";

export const instant = false;

interface SubscriptionDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SubscriptionDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Subscription ${id} — Brightloop`,
    description: "Subscription details, lifecycle timeline, and billing contracts.",
  };
}

export default async function SubscriptionDetailPage({
  params,
}: SubscriptionDetailPageProps) {
  const { id } = await params;
  return <SubscriptionDetailClient id={id} />;
}
