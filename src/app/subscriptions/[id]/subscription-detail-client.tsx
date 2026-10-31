"use client";

import * as React from "react";
import Link from "next/link";
import { getSubscriptionByIdAction } from "@/modules/subscriptions/actions";
import { SubscriptionWithDetails } from "@/modules/subscriptions/types";
import { SubscriptionDetailsCard } from "@/modules/subscriptions/components/subscription-details-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface SubscriptionDetailClientProps {
  id: string;
}

export function SubscriptionDetailClient({ id }: SubscriptionDetailClientProps) {
  const { error: toastError } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [subscription, setSubscription] = React.useState<SubscriptionWithDetails | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function loadSub() {
      setLoading(true);
      try {
        const res = await getSubscriptionByIdAction(id);
        if (isMounted) {
          if (res.success) {
            setSubscription(res.data);
          } else {
            toastError(res.error.message);
          }
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          toastError("Failed to load subscription details.");
          setLoading(false);
        }
      }
    }

    loadSub();
    return () => {
      isMounted = false;
    };
  }, [id, toastError]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">
          Subscription Not Found
        </h2>
        <p className="text-xs text-slate-500">
          The requested subscription ID <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{id}</code> could not be found or you do not have permission to access it.
        </p>
        <Link href="/subscriptions" className="inline-block mt-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Subscriptions
          </Button>
        </Link>
      </div>
    );
  }

  return <SubscriptionDetailsCard subscription={subscription} />;
}

