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

export interface QuotationCustomerSnapshot {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  currency: string;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
}

export interface QuotationWithItems extends Quotation {
  items: QuotationItem[];
  customer?: QuotationCustomerSnapshot;
}

export interface QuotationTemplateWithItems extends QuotationTemplate {
  items: (QuotationTemplateItem & {
    product?: { id: string; name: string; code: string } | null;
    plan?: { id: string; name: string; billing_cycle: string; price: number } | null;
  })[];
}
