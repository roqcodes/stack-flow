"use client";

import Link from "next/link";
import { ArrowLeft, Building2, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Customer } from "@/modules/customers/types";
import { formatDate, getStatusBadgeVariant } from "@/lib/utils";

interface CustomerDetailClientProps {
  customer: Customer;
}

export function CustomerDetailClient({ customer }: CustomerDetailClientProps) {
  const address = [
    customer.billing_address_line1,
    customer.billing_address_line2,
    [customer.billing_city, customer.billing_state, customer.billing_postal_code]
      .filter(Boolean)
      .join(", "),
    customer.billing_country,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-600" />
          {customer.company_name}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={getStatusBadgeVariant(customer.status)}>{customer.status}</Badge>
          {!customer.is_active && (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
            <CardDescription>Primary business contact</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="font-medium text-slate-900">{customer.contact_name}</p>
            <p className="flex items-center gap-2 text-blue-600">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${customer.email}`}>{customer.email}</a>
            </p>
            {customer.phone && (
              <p className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4" />
                {customer.phone}
              </p>
            )}
            {customer.business_number && (
              <p className="text-slate-500">Business # {customer.business_number}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing</CardTitle>
            <CardDescription>Currency and address on file</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <span className="text-slate-500">Currency:</span>{" "}
              <span className="font-mono font-semibold">{customer.currency}</span>
            </p>
            {address ? (
              <pre className="text-slate-600 whitespace-pre-wrap font-sans">{address}</pre>
            ) : (
              <p className="text-slate-400 italic">No billing address recorded</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Account linkage</CardTitle>
            <CardDescription>Portal profile when linked</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {customer.profile_id ? (
              <p>
                Linked profile ID:{" "}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{customer.profile_id}</code>
              </p>
            ) : (
              <p className="text-slate-400 italic">No portal account linked yet.</p>
            )}
            <p className="text-xs text-slate-400 mt-4">
              Created {formatDate(customer.created_at)} · Updated {formatDate(customer.updated_at)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
