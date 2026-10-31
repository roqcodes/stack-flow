import { Customer } from "@/modules/customers/types";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "partially_paid"
  | "void"
  | "uncollectible";

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  subscription_id?: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  period_start?: string | null;
  period_end?: string | null;
  issue_date: string;
  due_date: string;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string | null;
  plan_id?: string | null;
  description: string;
  quantity: number;
  unit_amount: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
}

export interface InvoiceWithDetails extends Invoice {
  customer?: Customer | null;
  items: InvoiceItem[];
  payment_allocations?: {
    id: string;
    allocated_amount: number;
    created_at: string;
    payments?: {
      id: string;
      payment_number: string;
      payment_method_type: string;
      paid_at: string;
    } | null;
  }[];
}

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  subscriptionId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface GenerateInvoiceFromSubscriptionParams {
  subscriptionId: string;
  asOfDate?: Date | string;
  dueDate?: string;
  notes?: string;
}
