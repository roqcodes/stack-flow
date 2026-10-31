export type ProductStatus = "active" | "draft" | "archived";
export type BillingCycle = "daily" | "weekly" | "monthly" | "yearly";

export interface Product {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: ProductStatus;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  attributes?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  product_id: string;
  variant_id?: string | null;
  name: string;
  code: string;
  billing_cycle: BillingCycle;
  billing_interval_count: number; // e.g. 1 for every 1 month, 3 for quarterly
  currency: string;
  price: number; // NUMERIC(14,2)
  trial_period_days: number;
  setup_fee: number;
  is_active: boolean;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface PlanRule {
  id: string;
  plan_id: string;
  rule_type: string; // e.g. "seat_limit", "storage_gb", "feature_flag"
  rule_value: string;
  description?: string | null;
  created_at: string;
}
