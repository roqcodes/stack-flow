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
}
