import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { SubscriptionStatus, SubscriptionLifecycleStatus } from "../types";
import { cn } from "@/lib/utils";

interface SubscriptionStatusBadgeProps {
  status: SubscriptionLifecycleStatus | SubscriptionStatus | string;
  className?: string;
}

export function SubscriptionStatusBadge({
  status,
  className,
}: SubscriptionStatusBadgeProps) {
  switch (status) {
    case "draft":
      return (
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1.5 font-medium text-slate-700 bg-slate-50 border-slate-300",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          Draft
        </Badge>
      );

    case "quotation":
      return (
        <Badge
          variant="secondary"
          className={cn(
            "flex items-center gap-1.5 font-medium text-indigo-700 bg-indigo-50 border-indigo-200",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          Quotation
        </Badge>
      );

    case "confirmed":
      return (
        <Badge
          variant="secondary"
          className={cn(
            "flex items-center gap-1.5 font-medium text-sky-700 bg-sky-50 border-sky-200",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          Confirmed
        </Badge>
      );

    case "active":
      return (
        <Badge
          variant="success"
          className={cn("flex items-center gap-1.5 font-medium", className)}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </Badge>
      );

    case "paused":
      return (
        <Badge
          variant="warning"
          className={cn("flex items-center gap-1.5 font-medium", className)}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Paused
        </Badge>
      );

    case "closed":
      return (
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1.5 font-medium text-zinc-600 bg-zinc-100 border-zinc-200",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          Closed
        </Badge>
      );

    case "trialing":
      return (
        <Badge
          variant="secondary"
          className={cn(
            "flex items-center gap-1.5 font-medium text-blue-700 bg-blue-50 border-blue-200",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Trialing
        </Badge>
      );

    case "past_due":
      return (
        <Badge
          variant="destructive"
          className={cn("flex items-center gap-1.5 font-medium", className)}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Past Due
        </Badge>
      );

    case "cancelled":
      return (
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1.5 font-medium text-slate-500 bg-slate-50",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Cancelled
        </Badge>
      );

    case "expired":
      return (
        <Badge
          variant="outline"
          className={cn("flex items-center gap-1.5 font-medium text-slate-500", className)}
        >
          Expired
        </Badge>
      );

    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
}
