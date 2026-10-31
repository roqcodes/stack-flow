export type BillingActionType =
  | "cycle_run"
  | "invoice_generated"
  | "auto_charge_attempted"
  | "dunning_attempt"
  | "subscription_renewed"
  | "subscription_cancelled";

export type BillingStatus = "success" | "failure" | "warning";

export interface BillingLog {
  id: string;
  subscription_id?: string | null;
  customer_id?: string | null;
  invoice_id?: string | null;
  action: BillingActionType;
  status: BillingStatus;
  message: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}
