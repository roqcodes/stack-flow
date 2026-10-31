"use client";

import * as React from "react";
import Link from "next/link";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Subscription,
  SubscriptionWithDetails,
  SubscriptionStatus,
  SubscriptionLifecycleStatus,
} from "../types";
import { BillingCycle } from "@/modules/products/types";
import { SubscriptionStatusBadge } from "./subscription-status-badge";
import { SubscriptionActionsMenu } from "./subscription-actions-menu";
import { BillingPreviewModal } from "./billing-preview-modal";
import { Search, Plus } from "lucide-react";

interface SubscriptionTableProps {
  initialSubscriptions: SubscriptionWithDetails[];
  initialTotalCount?: number;
  onCreateNew?: () => void;
}

export function SubscriptionTable({
  initialSubscriptions,
  onCreateNew,
}: SubscriptionTableProps) {
  const subscriptions = initialSubscriptions;
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    SubscriptionLifecycleStatus | SubscriptionStatus | "all"
  >("all");
  const [cycleFilter, setCycleFilter] = React.useState<BillingCycle | "all">(
    "all"
  );
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  // Billing contract inspector modal state
  const [inspectModalSub, setInspectModalSub] =
    React.useState<Subscription | null>(null);

  // Client-side filtering when working with initial page or fast filter
  const filteredSubscriptions = React.useMemo(() => {
    return subscriptions.filter((sub) => {
      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const numMatch = sub.subscription_number.toLowerCase().includes(query);
        const custMatch = sub.customer?.company_name
          ?.toLowerCase()
          .includes(query);
        const emailMatch = sub.customer?.email?.toLowerCase().includes(query);
        const planMatch = sub.plan?.name?.toLowerCase().includes(query);
        if (!numMatch && !custMatch && !emailMatch && !planMatch) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const lifecycleMatch = sub.lifecycle_status === statusFilter;
        const dbStatusMatch = sub.status === statusFilter;
        if (!lifecycleMatch && !dbStatusMatch) {
          return false;
        }
      }

      // Cycle filter
      if (cycleFilter !== "all" && sub.billing_cycle !== cycleFilter) {
        return false;
      }

      return true;
    });
  }, [subscriptions, search, statusFilter, cycleFilter]);

  const totalPages = Math.ceil(filteredSubscriptions.length / pageSize) || 1;
  const paginatedList = React.useMemo(() => {
    const from = (page - 1) * pageSize;
    return filteredSubscriptions.slice(from, from + pageSize);
  }, [filteredSubscriptions, page, pageSize]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by subscription #, customer, or plan..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 text-xs"
          />
        </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "draft", label: "Draft" },
                { id: "quotation", label: "Quotation" },
                { id: "confirmed", label: "Confirmed" },
                { id: "paused", label: "Paused" },
                { id: "closed", label: "Closed" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setStatusFilter(item.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === item.id
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}

            <select
              aria-label="Filter by billing cycle"
              value={cycleFilter}
              onChange={(e) => {
                setCycleFilter(e.target.value as BillingCycle | "all");
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
            >
              <option value="all">All Cycles</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>

        {/* Action Button */}
        {onCreateNew && (
          <Button onClick={onCreateNew} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            New Subscription
          </Button>
        )}
      </div>

      {/* Table Container */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Subscription #</TableHead>
              <TableHead>Customer Organization</TableHead>
              <TableHead>Plan & Frequency</TableHead>
              <TableHead>Billing Interval</TableHead>
              <TableHead className="text-right">Cycle Total</TableHead>
              <TableHead className="text-center w-[120px]">Status</TableHead>
              <TableHead className="text-right w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedList.length === 0 ? (
              <TableEmpty
                colSpan={7}
                message={
                  search || statusFilter !== "all"
                    ? "No subscriptions match the selected search or status filters."
                    : "No subscriptions have been created yet. Convert an accepted quotation to begin."
                }
              />
            ) : (
              paginatedList.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-slate-50/60">
                  {/* Subscription Number */}
                  <TableCell>
                    <Link
                      href={`/subscriptions/${sub.id}`}
                      className="font-mono text-xs font-bold text-blue-600 hover:underline block"
                    >
                      {sub.subscription_number}
                    </Link>
                    <span className="text-[10px] text-slate-400">
                      Started {formatDate(sub.current_period_start)}
                    </span>
                  </TableCell>

                  {/* Customer */}
                  <TableCell>
                    <div className="font-medium text-xs text-slate-900">
                      {sub.customer?.company_name || "Unknown Customer"}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                      {sub.customer?.contact_name} ({sub.customer?.email})
                    </div>
                  </TableCell>

                  {/* Plan */}
                  <TableCell>
                    <div className="font-semibold text-xs text-slate-900">
                      {sub.plan?.name || "Standard Subscription"}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                      {sub.billing_cycle} tier (Qty: {sub.quantity})
                    </div>
                  </TableCell>

                  {/* Dates */}
                  <TableCell>
                    <div className="text-xs text-slate-700">
                      Due:{" "}
                      <span className="font-semibold text-slate-900">
                        {formatDate(sub.next_billing_date)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Period: {formatDate(sub.current_period_start)} -{" "}
                      {formatDate(sub.current_period_end)}
                    </div>
                  </TableCell>

                  {/* Financial Total */}
                  <TableCell className="text-right">
                    <span className="font-bold text-xs text-slate-900 block">
                      {formatCurrency(sub.total_amount, sub.currency)}
                    </span>
                    {sub.discount_amount > 0 && (
                      <span className="text-[10px] text-emerald-600">
                        -{formatCurrency(sub.discount_amount, sub.currency)} off
                      </span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="text-center">
                    <SubscriptionStatusBadge
                      status={sub.lifecycle_status || sub.status}
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <SubscriptionActionsMenu
                      subscription={sub}
                      onInspectBilling={(target) => setInspectModalSub(target)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {filteredSubscriptions.length > pageSize && (
          <div className="border-t border-slate-200 p-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              totalItems={filteredSubscriptions.length}
              pageSize={pageSize}
            />
          </div>
        )}
      </div>

      {/* Billing Contract Inspector Modal */}
      <BillingPreviewModal
        subscription={inspectModalSub}
        open={Boolean(inspectModalSub)}
        onOpenChange={(open) => !open && setInspectModalSub(null)}
      />
    </div>
  );
}

