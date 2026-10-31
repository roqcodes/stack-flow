export type DiscountType = "percentage" | "fixed_amount";

export interface Discount {
  id: string;
  code: string;
  name: string;
  type: DiscountType;
  value: number; // e.g. 20 for 20% or 50.00 for $50 off
  currency?: string | null;
  max_redemptions?: number | null;
  times_redeemed: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountProduct {
  id: string;
  discount_id: string;
  product_id: string;
  created_at: string;
}

export interface DiscountUsage {
  id: string;
  discount_id: string;
  customer_id: string;
  invoice_id?: string | null;
  subscription_id?: string | null;
  redeemed_amount: number;
  redeemed_at: string;
}
