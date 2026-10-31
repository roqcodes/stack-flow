"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  Mail,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  acceptQuotationAction,
  rejectQuotationAction,
  sendQuotationAction,
  sendQuotationEmailAction,
  QuotationWithItems,
} from "@/modules/quotations/actions";
import { formatCurrency, formatDate, getStatusBadgeVariant } from "@/lib/utils";

interface QuotationDetailClientProps {
  quotation: QuotationWithItems;
}

export function QuotationDetailClient({ quotation: initial }: QuotationDetailClientProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [quotation, setQuotation] = React.useState(initial);
  const [emailLoading, setEmailLoading] = React.useState(false);

  const pdfUrl = `/api/quotations/${quotation.id}/pdf`;

  const refresh = () => router.refresh();

  const handleSend = async () => {
    const result = await sendQuotationAction(quotation.id);
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    setQuotation((q) => ({ ...q, status: result.data.status }));
    success("Quotation marked as sent.");
    refresh();
  };

  const handleAccept = async () => {
    const result = await acceptQuotationAction(quotation.id);
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    setQuotation(result.data);
    success("Quotation accepted. Snapshot preserved for billing.");
    refresh();
  };

  const handleReject = async () => {
    if (!confirm(`Reject ${quotation.quotation_number}?`)) return;
    const result = await rejectQuotationAction(quotation.id);
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    setQuotation((q) => ({ ...q, status: result.data.status }));
    success("Quotation rejected.");
    refresh();
  };

  const handleEmail = async () => {
    setEmailLoading(true);
    const result = await sendQuotationEmailAction(quotation.id);
    setEmailLoading(false);
    if (!result.success) {
      toastError(result.error.message);
      return;
    }
    success(result.data.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/quotations"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to quotations
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
            {quotation.quotation_number}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Valid until {formatDate(quotation.valid_until)} · Created{" "}
            {formatDate(quotation.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={getStatusBadgeVariant(quotation.status)} className="h-8 px-3">
            {quotation.status}
          </Badge>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center font-medium transition-colors rounded-lg border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50 h-8 px-3 text-sm"
          >
            <Download className="h-4 w-4 mr-1.5" />
            PDF
          </a>
          {["sent", "accepted"].includes(quotation.status) && (
            <Button
              variant="outline"
              size="sm"
              isLoading={emailLoading}
              onClick={handleEmail}
            >
              <Mail className="h-4 w-4 mr-1.5" />
              Email
            </Button>
          )}
          {quotation.status === "draft" && (
            <Button size="sm" onClick={handleSend}>
              <Send className="h-4 w-4 mr-1.5" />
              Send
            </Button>
          )}
          {quotation.status === "sent" && (
            <>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAccept}>
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Accept
              </Button>
              <Button variant="outline" size="sm" className="text-red-600" onClick={handleReject}>
                <XCircle className="h-4 w-4 mr-1.5" />
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
            <CardDescription>Billing contact at time of quotation</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {quotation.customer ? (
              <>
                <p className="font-semibold text-slate-900">{quotation.customer.company_name}</p>
                <p>{quotation.customer.contact_name}</p>
                <p className="text-blue-600">{quotation.customer.email}</p>
              </>
            ) : (
              <p className="text-slate-400 italic">No customer data</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Totals (server snapshot)</CardTitle>
            <CardDescription>
              Values stored on quotation_items — unchanged if catalog prices change later.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs uppercase">Subtotal</p>
              <p className="font-semibold">{formatCurrency(quotation.subtotal, quotation.currency)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase">Discount</p>
              <p className="font-semibold">{formatCurrency(quotation.discount_amount, quotation.currency)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase">Tax</p>
              <p className="font-semibold">{formatCurrency(quotation.tax_amount, quotation.currency)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase">Total</p>
              <p className="font-semibold text-lg">{formatCurrency(quotation.total_amount, quotation.currency)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Tax %</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unit_price, quotation.currency)}</TableCell>
                  <TableCell>{formatCurrency(item.discount_amount, quotation.currency)}</TableCell>
                  <TableCell>{item.tax_rate}%</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.total_amount, quotation.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(quotation.terms || quotation.notes) && (
        <div className="grid gap-4 md:grid-cols-2">
          {quotation.terms && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Terms</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 whitespace-pre-wrap">
                {quotation.terms}
              </CardContent>
            </Card>
          )}
          {quotation.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 whitespace-pre-wrap">
                {quotation.notes}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
