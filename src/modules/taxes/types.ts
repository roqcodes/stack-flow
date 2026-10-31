export interface Tax {
  id: string;
  name: string; // e.g. "US California State Tax", "EU Standard VAT"
  code: string;
  country: string; // ISO 3166-1 alpha-2, e.g. "US"
  state_province?: string | null;
  rate: number; // e.g. 8.25 for 8.25%
  is_compound: boolean;
  is_active: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  created_at: string;
  updated_at: string;
}
