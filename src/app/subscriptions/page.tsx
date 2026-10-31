"use client";

import * as React from "react";
import { listSubscriptionsAction } from "@/modules/subscriptions/actions";
import { SubscriptionStats, SubscriptionWithDetails } from "@/modules/subscriptions/types";
import { SubscriptionStatsCards } from "@/modules/subscriptions/components/subscription-stats-cards";
import { SubscriptionTable } from "@/modules/subscriptions/components/subscription-table";
import { CreateSubscriptionModal } from "@/modules/subscriptions/components/create-subscription-modal";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Repeat } from "lucide-react";

function SubscriptionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

function SubscriptionsContent() {
  const { error: toastError } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [subscriptions, setSubscriptions] = React.useState<SubscriptionWithDetails[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [stats, setStats] = React.useState<SubscriptionStats>({
    totalSubscriptions: 0,
    activeCount: 0,
    trialingCount: 0,
    pausedCount: 0,
    pastDueCount: 0,
    cancelledCount: 0,
    draftCount: 0,
    quotationCount: 0,
    confirmedCount: 0,
    closedCount: 0,
    dueForBillingCount: 0,
    monthlyRecurringRevenue: 0,
  });
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const result = await listSubscriptionsAction({ page: 1, pageSize: 20 });
        if (isMounted) {
          if (result.success) {
            setSubscriptions(result.data.subscriptions);
            setTotalCount(result.data.totalCount);
            setStats(result.data.stats);
          } else {
            toastError(result.error.message);
          }
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          toastError("Failed to fetch subscriptions.");
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [refreshKey, toastError]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Subscriptions"
        description="Recurring lifecycles, billing intervals, and engine execution status."
        icon={Repeat}
      />

      {loading ? (
        <SubscriptionsSkeleton />
      ) : (
        <>
          <SubscriptionStatsCards stats={stats} />
          <SubscriptionTable
            initialSubscriptions={subscriptions}
            initialTotalCount={totalCount}
            onCreateNew={() => setCreateModalOpen(true)}
          />
        </>
      )}

      {/* Creation Modal */}
      <CreateSubscriptionModal
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) {
            setLoading(true);
            setRefreshKey((k) => k + 1);
          }
        }}
      />
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <React.Suspense fallback={<SubscriptionsSkeleton />}>
      <SubscriptionsContent />
    </React.Suspense>
  );
}
