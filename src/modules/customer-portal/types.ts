import {
  SubscriptionWithDetails,
  Subscription,
  SubscriptionPlan,
  PlanChangeRequest,
  PlanChangeType,
} from "../subscriptions/types";

export interface PortalInvoiceSummary {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  issue_date: string;
  due_date: string;
  paid_at?: string | null;
}

export interface PortalPaymentSummary {
  id: string;
  payment_number: string;
  customer_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method_type: string;
  transaction_reference?: string | null;
  failure_reason?: string | null;
  refunded_amount: number;
  paid_at?: string | null;
  created_at: string;
  allocated_invoice_number?: string | null;
  allocated_invoice_id?: string | null;
}

export interface CustomerPortalData {
  customer: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    business_number?: string | null;
    currency: string;
    billing_address_line1?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_postal_code?: string | null;
    billing_country?: string | null;
    status: string;
  };
  activeSubscription: SubscriptionWithDetails | null;
  subscriptionHistory: Subscription[];
  invoices: PortalInvoiceSummary[];
  payments: PortalPaymentSummary[];
  availablePlans: SubscriptionPlan[];
}

export type { PlanChangeRequest, PlanChangeType };

