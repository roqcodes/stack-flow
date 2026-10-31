/**
 * PostgreSQL Database Schema Types for Brightloop
 * Generated from migrations 20261031000000_initial_schema.sql,
 * 20261031000001_row_level_security.sql,
 * 20261031000002_auth_trigger_and_bootstrap.sql,
 * and 20261031000003_add_profile_status_and_permissions.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "staff" | "customer";
export type BillingCycle = "daily" | "weekly" | "monthly" | "yearly";
export type CustomerStatus = "active" | "suspended" | "archived";
export type ProductStatus = "active" | "draft" | "archived";
export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired";
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "partially_paid"
  | "void"
  | "uncollectible";
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
export type DiscountType = "percentage" | "fixed_amount";
export type BillingActionType =
  | "cycle_run"
  | "invoice_generated"
  | "auto_charge_attempted"
  | "dunning_attempt"
  | "subscription_renewed"
  | "subscription_cancelled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          is_active: boolean;
          permissions: Json;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          is_active?: boolean;
          permissions?: Json;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          is_active?: boolean;
          permissions?: Json;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          profile_id: string | null;
          company_name: string;
          contact_name: string;
          email: string;
          phone: string | null;
          business_number: string | null;
          currency: string;
          billing_address_line1: string | null;
          billing_address_line2: string | null;
          billing_city: string | null;
          billing_state: string | null;
          billing_postal_code: string | null;
          billing_country: string | null;
          status: CustomerStatus;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          company_name: string;
          contact_name: string;
          email: string;
          phone?: string | null;
          business_number?: string | null;
          currency?: string;
          billing_address_line1?: string | null;
          billing_address_line2?: string | null;
          billing_city?: string | null;
          billing_state?: string | null;
          billing_postal_code?: string | null;
          billing_country?: string | null;
          status?: CustomerStatus;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          company_name?: string;
          contact_name?: string;
          email?: string;
          phone?: string | null;
          business_number?: string | null;
          currency?: string;
          billing_address_line1?: string | null;
          billing_address_line2?: string | null;
          billing_city?: string | null;
          billing_state?: string | null;
          billing_postal_code?: string | null;
          billing_country?: string | null;
          status?: CustomerStatus;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          status: ProductStatus;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          status?: ProductStatus;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          description?: string | null;
          status?: ProductStatus;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          sku: string;
          attributes: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          sku: string;
          attributes?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          sku?: string;
          attributes?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string | null;
          name: string;
          code: string;
          billing_cycle: BillingCycle;
          billing_interval_count: number;
          currency: string;
          price: number;
          trial_period_days: number;
          setup_fee: number;
          status: ProductStatus;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          variant_id?: string | null;
          name: string;
          code: string;
          billing_cycle?: BillingCycle;
          billing_interval_count?: number;
          currency?: string;
          price?: number;
          trial_period_days?: number;
          setup_fee?: number;
          status?: ProductStatus;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          variant_id?: string | null;
          name?: string;
          code?: string;
          billing_cycle?: BillingCycle;
          billing_interval_count?: number;
          currency?: string;
          price?: number;
          trial_period_days?: number;
          setup_fee?: number;
          status?: ProductStatus;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      plan_rules: {
        Row: {
          id: string;
          plan_id: string;
          rule_type: string;
          rule_value: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          rule_type: string;
          rule_value: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          rule_type?: string;
          rule_value?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      quotation_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          terms: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          terms?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          terms?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      quotation_template_items: {
        Row: {
          id: string;
          template_id: string;
          product_id: string;
          plan_id: string | null;
          quantity: number;
          default_discount_percentage: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          product_id: string;
          plan_id?: string | null;
          quantity?: number;
          default_discount_percentage?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          product_id?: string;
          plan_id?: string | null;
          quantity?: number;
          default_discount_percentage?: number;
          created_at?: string;
        };
      };
      quotations: {
        Row: {
          id: string;
          quotation_number: string;
          customer_id: string;
          template_id: string | null;
          status: QuotationStatus;
          currency: string;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          valid_until: string;
          accepted_at: string | null;
          converted_subscription_id: string | null;
          notes: string | null;
          terms: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quotation_number: string;
          customer_id: string;
          template_id?: string | null;
          status?: QuotationStatus;
          currency?: string;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          valid_until: string;
          accepted_at?: string | null;
          converted_subscription_id?: string | null;
          notes?: string | null;
          terms?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quotation_number?: string;
          customer_id?: string;
          template_id?: string | null;
          status?: QuotationStatus;
          currency?: string;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          valid_until?: string;
          accepted_at?: string | null;
          converted_subscription_id?: string | null;
          notes?: string | null;
          terms?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      quotation_items: {
        Row: {
          id: string;
          quotation_id: string;
          product_id: string | null;
          plan_id: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          discount_amount: number;
          tax_rate: number;
          tax_amount: number;
          total_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quotation_id: string;
          product_id?: string | null;
          plan_id?: string | null;
          description: string;
          quantity?: number;
          unit_price: number;
          discount_amount?: number;
          tax_rate?: number;
          tax_amount?: number;
          total_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          quotation_id?: string;
          product_id?: string | null;
          plan_id?: string | null;
          description?: string;
          quantity?: number;
          unit_price?: number;
          discount_amount?: number;
          tax_rate?: number;
          tax_amount?: number;
          total_amount?: number;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          subscription_number: string;
          customer_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          billing_cycle: BillingCycle;
          currency: string;
          unit_price: number;
          quantity: number;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          trial_start: string | null;
          trial_end: string | null;
          current_period_start: string;
          current_period_end: string;
          next_billing_date: string;
          cancelled_at: string | null;
          cancel_reason: string | null;
          ended_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subscription_number: string;
          customer_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          billing_cycle: BillingCycle;
          currency?: string;
          unit_price: number;
          quantity?: number;
          subtotal: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount: number;
          trial_start?: string | null;
          trial_end?: string | null;
          current_period_start: string;
          current_period_end: string;
          next_billing_date: string;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          ended_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subscription_number?: string;
          customer_id?: string;
          plan_id?: string;
          status?: SubscriptionStatus;
          billing_cycle?: BillingCycle;
          currency?: string;
          unit_price?: number;
          quantity?: number;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          trial_start?: string | null;
          trial_end?: string | null;
          current_period_start?: string;
          current_period_end?: string;
          next_billing_date?: string;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          ended_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscription_items: {
        Row: {
          id: string;
          subscription_id: string;
          product_id: string;
          plan_id: string | null;
          variant_id: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          product_id: string;
          plan_id?: string | null;
          variant_id?: string | null;
          description: string;
          quantity?: number;
          unit_price: number;
          subtotal: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string;
          product_id?: string;
          plan_id?: string | null;
          variant_id?: string | null;
          description?: string;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      taxes: {
        Row: {
          id: string;
          name: string;
          code: string;
          country: string;
          state_province: string | null;
          rate: number;
          is_compound: boolean;
          is_active: boolean;
          valid_from: string | null;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          country: string;
          state_province?: string | null;
          rate: number;
          is_compound?: boolean;
          is_active?: boolean;
          valid_from?: string | null;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          country?: string;
          state_province?: string | null;
          rate?: number;
          is_compound?: boolean;
          is_active?: boolean;
          valid_from?: string | null;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      discounts: {
        Row: {
          id: string;
          code: string;
          name: string;
          type: DiscountType;
          value: number;
          currency: string | null;
          max_redemptions: number | null;
          times_redeemed: number;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          type: DiscountType;
          value: number;
          currency?: string | null;
          max_redemptions?: number | null;
          times_redeemed?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          type?: DiscountType;
          value?: number;
          currency?: string | null;
          max_redemptions?: number | null;
          times_redeemed?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      discount_products: {
        Row: {
          id: string;
          discount_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          discount_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          discount_id?: string;
          product_id?: string;
          created_at?: string;
        };
      };
      discount_usages: {
        Row: {
          id: string;
          discount_id: string;
          customer_id: string;
          invoice_id: string | null;
          subscription_id: string | null;
          redeemed_amount: number;
          redeemed_at: string;
        };
        Insert: {
          id?: string;
          discount_id: string;
          customer_id: string;
          invoice_id?: string | null;
          subscription_id?: string | null;
          redeemed_amount: number;
          redeemed_at?: string;
        };
        Update: {
          id?: string;
          discount_id?: string;
          customer_id?: string;
          invoice_id?: string | null;
          subscription_id?: string | null;
          redeemed_amount?: number;
          redeemed_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          customer_id: string;
          subscription_id: string | null;
          status: InvoiceStatus;
          currency: string;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          amount_paid: number;
          amount_due: number;
          period_start: string | null;
          period_end: string | null;
          issue_date: string;
          due_date: string;
          paid_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          customer_id: string;
          subscription_id?: string | null;
          status?: InvoiceStatus;
          currency?: string;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          amount_paid?: number;
          amount_due?: number;
          period_start?: string | null;
          period_end?: string | null;
          issue_date?: string;
          due_date: string;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          customer_id?: string;
          subscription_id?: string | null;
          status?: InvoiceStatus;
          currency?: string;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          amount_paid?: number;
          amount_due?: number;
          period_start?: string | null;
          period_end?: string | null;
          issue_date?: string;
          due_date?: string;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          product_id: string | null;
          plan_id: string | null;
          description: string;
          quantity: number;
          unit_amount: number;
          discount_amount: number;
          tax_rate: number;
          tax_amount: number;
          total_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          product_id?: string | null;
          plan_id?: string | null;
          description: string;
          quantity?: number;
          unit_amount: number;
          discount_amount?: number;
          tax_rate?: number;
          tax_amount?: number;
          total_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          product_id?: string | null;
          plan_id?: string | null;
          description?: string;
          quantity?: number;
          unit_amount?: number;
          discount_amount?: number;
          tax_rate?: number;
          tax_amount?: number;
          total_amount?: number;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          payment_number: string;
          customer_id: string;
          amount: number;
          currency: string;
          status: PaymentStatus;
          payment_method_type: PaymentMethodType;
          transaction_reference: string | null;
          failure_reason: string | null;
          refunded_amount: number;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_number: string;
          customer_id: string;
          amount: number;
          currency?: string;
          status?: PaymentStatus;
          payment_method_type?: PaymentMethodType;
          transaction_reference?: string | null;
          failure_reason?: string | null;
          refunded_amount?: number;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          payment_number?: string;
          customer_id?: string;
          amount?: number;
          currency?: string;
          status?: PaymentStatus;
          payment_method_type?: PaymentMethodType;
          transaction_reference?: string | null;
          failure_reason?: string | null;
          refunded_amount?: number;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_allocations: {
        Row: {
          id: string;
          payment_id: string;
          invoice_id: string;
          allocated_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          invoice_id: string;
          allocated_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          invoice_id?: string;
          allocated_amount?: number;
          created_at?: string;
        };
      };
      billing_logs: {
        Row: {
          id: string;
          subscription_id: string | null;
          customer_id: string | null;
          invoice_id: string | null;
          action: BillingActionType;
          status: "success" | "failure" | "warning";
          message: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id?: string | null;
          customer_id?: string | null;
          invoice_id?: string | null;
          action: BillingActionType;
          status: "success" | "failure" | "warning";
          message: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string | null;
          customer_id?: string | null;
          invoice_id?: string | null;
          action?: BillingActionType;
          status?: "success" | "failure" | "warning";
          message?: string;
          payload?: Json;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          table_name: string;
          record_id: string;
          action: "INSERT" | "UPDATE" | "DELETE";
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          table_name: string;
          record_id: string;
          action: "INSERT" | "UPDATE" | "DELETE";
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          table_name?: string;
          record_id?: string;
          action?: "INSERT" | "UPDATE" | "DELETE";
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
