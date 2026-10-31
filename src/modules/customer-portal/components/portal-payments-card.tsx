"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PortalPaymentSummary } from "../types";
import { CreditCard, CheckCircle2, Clock, AlertCircle, RefreshCw, FileText } from "lucide-react";

interface PortalPaymentsCardProps {
  payments: PortalPaymentSummary[];
}

export function PortalPaymentsCard({ payments }: PortalPaymentsCardProps) {
  const formatMethod = (method: string) => {
    switch (method?.toLowerCase()) {
      case "credit_card":
        return "Credit Card";
      case "bank_transfer":
        return "Bank Transfer";
      case "ach":
        return "ACH Direct Debit";
      case "wire":
        return "Wire Transfer";
      default:
        return method ? method.replace("_", " ") : "Electronic";
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "succeeded":
      case "completed":
        return (
          <Badge variant="success" className="text-[10px] gap-1 py-0.5">
            <CheckCircle2 className="h-3 w-3" />
            Succeeded
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="warning" className="text-[10px] gap-1 py-0.5">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-[10px] gap-1 py-0.5">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="secondary" className="text-[10px] gap-1 py-0.5 text-purple-700 bg-purple-50 border-purple-200">
            <RefreshCw className="h-3 w-3" />
            Refunded
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] capitalize py-0.5">
            {status}
          </Badge>
        );
    }
  };

  return (
    <Card className="border-slate-200 shadow-2xs">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm font-semibold">
              Payment Transactions
            </CardTitle>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {payments.length} {payments.length === 1 ? "transaction" : "transactions"}
          </span>
        </div>
        <CardDescription className="text-xs">
          Comprehensive ledger of payment settlements and recorded allocations
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment #</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Method & Reference</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableEmpty
                colSpan={6}
                message="No payment transactions recorded yet. Settlement records will appear here upon invoice payments."
              />
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-mono text-xs font-semibold text-slate-900 block">
                      {p.payment_number}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {formatDate(p.paid_at || p.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <span className="font-medium text-slate-800 capitalize block">
                        {formatMethod(p.payment_method_type)}
                      </span>
                      {p.transaction_reference && (
                        <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[150px]">
                          {p.transaction_reference}
                        </span>
                      )}
                      {p.failure_reason && (
                        <span className="text-[10px] text-rose-600 block mt-0.5">
                          {p.failure_reason}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.allocated_invoice_number ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                        <FileText className="h-3 w-3" />
                        {p.allocated_invoice_number}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-xs text-slate-900">
                    {formatCurrency(p.amount, p.currency)}
                    {p.refunded_amount > 0 && (
                      <span className="block text-[10px] font-normal text-purple-600">
                        Ref: -{formatCurrency(p.refunded_amount, p.currency)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderStatusBadge(p.status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

