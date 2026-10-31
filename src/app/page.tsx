"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Database,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  const { success, info } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const architecturalModules = [
    {
      name: "Authentication & Users",
      path: "/modules/auth",
      status: "Configured",
      description: "Supabase SSR Auth, session refresh & RBAC (Admin, Staff, Customer).",
    },
    {
      name: "Products & Plans",
      path: "/modules/products",
      status: "Ready",
      description: "Multi-variant product catalog, billing intervals, and rule constraints.",
    },
    {
      name: "Customers",
      path: "/modules/customers",
      status: "Ready",
      description: "Company records, tax IDs, currency assignments, and contact ledgers.",
    },
    {
      name: "Quotations",
      path: "/modules/quotations",
      status: "Ready",
      description: "Sales quotes with conversion-to-subscription pipeline and itemized terms.",
    },
    {
      name: "Subscriptions",
      path: "/modules/subscriptions",
      status: "Ready",
      description: "Lifecycle tracking (active, trialing, paused, past_due) & historical periods.",
    },
    {
      name: "Billing & Invoices",
      path: "/modules/invoices",
      status: "Ready",
      description: "Server-authoritative billing engine, duplicate cycle lock, NUMERIC(14,2) precision.",
    },
    {
      name: "Taxes & Jurisdictions",
      path: "/modules/taxes",
      status: "Ready",
      description: "Territory tax rates, compound calculations, and historical tax snapshots.",
    },
    {
      name: "Discounts & Usages",
      path: "/modules/discounts",
      status: "Ready",
      description: "Fixed/percentage promotions, coupon limits, and redemption ledgers.",
    },
    {
      name: "Payments & Allocations",
      path: "/modules/payments",
      status: "Ready",
      description: "Multi-invoice split allocations, refund journals, and transaction tracking.",
    },
    {
      name: "Revenue Analytics",
      path: "/modules/analytics",
      status: "Ready",
      description: "Real-time MRR, ARR, churn, and cash flow ledger metrics.",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Brightloop Platform Architecture
            </h1>
            <Badge variant="success">Foundation Online</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise Subscription Lifecycle & Recurring Billing Monolith
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => info("Supabase PostgreSQL migrations loaded in supabase/migrations/")}
          >
            <Database className="h-4 w-4 mr-1 text-slate-500" />
            Database Contracts
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Sparkles className="h-4 w-4 mr-1" />
                Component Showcase
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reusable UI Foundation Modal</DialogTitle>
                <DialogDescription>
                  This accessible dialog component supports keyboard escape handling, scroll locking, and backdrop dismissal.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-600 space-y-2 border border-slate-200">
                <p className="font-semibold text-slate-900">Design System Standards Verified:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Strict TypeScript definitions without any usage</li>
                  <li>Tailwind CSS v4 design tokens and CSS custom variables</li>
                  <li>Accessible ARIA dialog roles and focus trap behavior</li>
                  <li>Zero unvetted or insecure external UI package dependencies</li>
                </ul>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setDialogOpen(false);
                    success("Component system verified successfully!");
                  }}
                >
                  Confirm & Test Toast
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Architecture Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Financial Integrity Engine
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              NUMERIC(14,2)
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              All financial calculations (taxes, discounts, invoices, allocations) are executed server-side. Zero client-supplied financial totals are trusted.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Security & Authorization
            </CardTitle>
            <Layers className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              Supabase SSR + RLS
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Database Row Level Security policies enforced across all tables. Role-Based Access Control partitioning Admin, Staff, and Customer scopes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Architectural Separation
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              11 Monolithic Modules
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Clean modular monolith structure in <code className="text-slate-800 font-mono text-[11px]">src/modules/*</code> ensuring isolated business ownership and zero cross-module coupling.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Architectural Module Registry Table */}
      <Card>
        <CardHeader>
          <CardTitle>Business Module Status Registry</CardTitle>
          <CardDescription>
            Autonomous domain modules configured according to the master engineering specification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Module</TableHead>
                <TableHead>Architecture & Scope</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-28 text-right">Contract</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {architecturalModules.map((module) => (
                <TableRow key={module.name}>
                  <TableCell className="font-semibold text-slate-900">
                    {module.name}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {module.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={module.status === "Configured" ? "default" : "secondary"}>
                      <Clock className="h-3 w-3 mr-1 inline" />
                      {module.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center text-xs text-blue-600 font-medium">
                      Bound <CheckCircle2 className="h-3.5 w-3.5 ml-1 text-emerald-600" />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
