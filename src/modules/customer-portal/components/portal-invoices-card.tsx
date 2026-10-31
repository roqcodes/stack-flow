import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PortalInvoiceSummary } from "../types";
import { Receipt, FileText, CheckCircle2, Clock } from "lucide-react";

interface PortalInvoicesCardProps {
  invoices: PortalInvoiceSummary[];
}

export function PortalInvoicesCard({ invoices }: PortalInvoicesCardProps) {
  return (
    <Card className="border-slate-200 shadow-2xs">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-semibold">
              Billing History & Invoices
            </CardTitle>
          </div>
          <span className="text-xs text-slate-400">
            {invoices.length} {invoices.length === 1 ? "statement" : "statements"}
          </span>
        </div>
        <CardDescription className="text-xs">
          Historical statements issued by the Brightloop billing engine
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableEmpty
                colSpan={5}
                message="No invoices found. Statements will appear here following automated cycle execution."
              />
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      {inv.invoice_number}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {formatDate(inv.issue_date)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {formatDate(inv.due_date)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <span className="font-bold text-slate-900 block">
                      {formatCurrency(inv.total_amount, inv.currency)}
                    </span>
                    {inv.amount_due > 0 && inv.status !== "paid" && (
                      <span className="text-[10px] text-amber-700 font-semibold block">
                        Due: {formatCurrency(inv.amount_due, inv.currency)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {inv.status === "paid" ? (
                      <Badge variant="success" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                      </Badge>
                    ) : inv.status === "partially_paid" ? (
                      <Badge variant="warning" className="text-[10px]">
                        Partially Paid
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3" />
                        {inv.status}
                      </Badge>
                    )}
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

