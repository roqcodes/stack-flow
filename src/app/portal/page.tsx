"use client";

import * as React from "react";
import { getCustomerPortalDataAction } from "@/modules/customer-portal/actions";
import { CustomerPortalData } from "@/modules/customer-portal/types";
import { PortalOverview } from "@/modules/customer-portal/components/portal-overview";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Building2 } from "lucide-react";

function PortalSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 lg:col-span-2 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

function CustomerPortalContent() {
  const { error: toastError } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [portalData, setPortalData] = React.useState<CustomerPortalData | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function loadPortal() {
      setLoading(true);
      try {
        const res = await getCustomerPortalDataAction();
        if (isMounted) {
          if (res.success) {
            setPortalData(res.data);
          } else {
            setErrorMessage(res.error.message);
            toastError(res.error.message);
          }
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          const msg = "Failed to load customer portal profile.";
          setErrorMessage(msg);
          toastError(msg);
          setLoading(false);
        }
      }
    }

    loadPortal();
    return () => {
      isMounted = false;
    };
  }, [toastError]);

  if (loading) {
    return <PortalSkeleton />;
  }

  if (!portalData) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <Building2 className="h-12 w-12 text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">
          Customer Portal
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {errorMessage ||
            "No customer organization is linked to your account. If you are an administrator or staff member, you can preview customer accounts from the Customers directory."}
        </p>
      </div>
    );
  }

  return <PortalOverview data={portalData} />;
}

export default function CustomerPortalPage() {
  return (
    <React.Suspense fallback={<PortalSkeleton />}>
      <CustomerPortalContent />
    </React.Suspense>
  );
}
