export type CustomerStatus = "active" | "suspended" | "archived";

export interface Customer {
  id: string;
  profile_id?: string | null;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  business_number?: string | null; // VAT / Tax ID / EIN
  currency: string; // ISO 4217, e.g. "USD"
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
  status: CustomerStatus;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
