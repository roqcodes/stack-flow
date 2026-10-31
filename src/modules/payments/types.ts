import { Customer } from "@/modules/customers/types";

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentMethodType =
  | "credit_card"
  | "bank_transfer"
  | "ach"
  | "wire"
  | "manual";

export interface Payment {
  id: string;
  payment_number: string;
  customer_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method_type: PaymentMethodType;
  transaction_reference?: string | null;
  failure_reason?: string | null;
  refunded_amount: number;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  created_at: string;
  invoices?: {
    id: string;
    invoice_number: string;
    total_amount: number;
    amount_paid: number;
    amount_due: number;
    status: string;
  } | null;
}

export interface PaymentWithAllocations extends Payment {
  customer?: Customer | null;
  allocations: PaymentAllocation[];
}

export interface RecordPaymentInput {
  customerId: string;
  amount: number;
  currency?: string;
  paymentMethodType: PaymentMethodType;
  subChannel?: "upi" | "cash" | "card" | "wire" | "ach" | "other";
  transactionReference?: string;
  invoiceAllocations?: {
    invoiceId: string;
    amount: number;
  }[];
}

export interface RefundPaymentInput {
  paymentId: string;
  amount: number;
  reason?: string;
}

export interface PaymentFilters {
  search?: string;
  status?: PaymentStatus;
  method?: PaymentMethodType;
  customerId?: string;
  page?: number;
  pageSize?: number;
}
