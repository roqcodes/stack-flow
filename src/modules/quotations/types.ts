export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  template_id?: string | null;
  status: QuotationStatus;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  valid_until: string;
  accepted_at?: string | null;
  converted_subscription_id?: string | null;
  notes?: string | null;
  terms?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id?: string | null;
  plan_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  terms?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationTemplateItem {
  id: string;
  template_id: string;
  product_id: string;
  plan_id?: string | null;
  quantity: number;
  default_discount_percentage: number;
  created_at: string;
}
