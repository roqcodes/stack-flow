-- =============================================================================
-- BRIGHTLOOP SUBSCRIPTION MANAGEMENT & RECURRING BILLING PLATFORM
-- Migration: 20261031000001_row_level_security.sql
-- Description: Row Level Security (RLS) Policies and Role Helper Functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER FUNCTIONS (Prevent Infinite Recursion)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_role() IN ('admin', 'staff');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_customer_id_for_auth_user()
RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE profile_id = auth.uid();
  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY ACROSS ALL 22 TABLES
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. RLS POLICIES: PROFILES
-- -----------------------------------------------------------------------------

CREATE POLICY "profiles_select_own_or_staff"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR public.is_staff());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    -- Only admin can change role column
    (auth.uid() = id AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid()))
    OR public.is_admin()
  );

CREATE POLICY "profiles_insert_service_or_admin"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES: CUSTOMERS
-- -----------------------------------------------------------------------------

CREATE POLICY "customers_select_own_or_staff"
  ON customers FOR SELECT
  USING (profile_id = auth.uid() OR public.is_staff());

CREATE POLICY "customers_insert_staff"
  ON customers FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "customers_update_staff"
  ON customers FOR UPDATE
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "customers_delete_admin"
  ON customers FOR DELETE
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. RLS POLICIES: PRODUCTS, VARIANTS, PLANS, PLAN RULES
-- -----------------------------------------------------------------------------

-- Products
CREATE POLICY "products_select_active_or_staff"
  ON products FOR SELECT
  USING ((is_active = true AND status = 'active') OR public.is_staff());

CREATE POLICY "products_manage_admin"
  ON products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Product Variants
CREATE POLICY "product_variants_select_active_or_staff"
  ON product_variants FOR SELECT
  USING (is_active = true OR public.is_staff());

CREATE POLICY "product_variants_manage_admin"
  ON product_variants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Plans
CREATE POLICY "plans_select_active_or_staff"
  ON plans FOR SELECT
  USING ((is_active = true AND status = 'active') OR public.is_staff());

CREATE POLICY "plans_manage_admin"
  ON plans FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Plan Rules
CREATE POLICY "plan_rules_select_authenticated"
  ON plan_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "plan_rules_manage_admin"
  ON plan_rules FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. RLS POLICIES: QUOTATION TEMPLATES & ITEMS
-- -----------------------------------------------------------------------------

CREATE POLICY "quotation_templates_select_staff"
  ON quotation_templates FOR SELECT
  USING (public.is_staff());

CREATE POLICY "quotation_templates_manage_admin"
  ON quotation_templates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "quotation_template_items_select_staff"
  ON quotation_template_items FOR SELECT
  USING (public.is_staff());

CREATE POLICY "quotation_template_items_manage_admin"
  ON quotation_template_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 7. RLS POLICIES: QUOTATIONS & ITEMS
-- -----------------------------------------------------------------------------

CREATE POLICY "quotations_select_own_or_staff"
  ON quotations FOR SELECT
  USING (customer_id = public.get_customer_id_for_auth_user() OR public.is_staff());

CREATE POLICY "quotations_update_customer_status"
  ON quotations FOR UPDATE
  USING (customer_id = public.get_customer_id_for_auth_user() OR public.is_staff())
  WITH CHECK (
    -- Customer can only accept/reject their quote
    (customer_id = public.get_customer_id_for_auth_user() AND status IN ('accepted', 'rejected'))
    OR public.is_staff()
  );

CREATE POLICY "quotations_manage_staff"
  ON quotations FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "quotation_items_select_own_or_staff"
  ON quotation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_items.quotation_id
      AND (q.customer_id = public.get_customer_id_for_auth_user() OR public.is_staff())
    )
  );

CREATE POLICY "quotation_items_manage_staff"
  ON quotation_items FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- -----------------------------------------------------------------------------
-- 8. RLS POLICIES: SUBSCRIPTIONS & ITEMS
-- -----------------------------------------------------------------------------

CREATE POLICY "subscriptions_select_own_or_staff"
  ON subscriptions FOR SELECT
  USING (customer_id = public.get_customer_id_for_auth_user() OR public.is_staff());

CREATE POLICY "subscriptions_manage_staff"
  ON subscriptions FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "subscription_items_select_own_or_staff"
  ON subscription_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.id = subscription_items.subscription_id
      AND (s.customer_id = public.get_customer_id_for_auth_user() OR public.is_staff())
    )
  );

CREATE POLICY "subscription_items_manage_staff"
  ON subscription_items FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- -----------------------------------------------------------------------------
-- 9. RLS POLICIES: TAXES & DISCOUNTS
-- -----------------------------------------------------------------------------

-- Taxes
CREATE POLICY "taxes_select_active_or_staff"
  ON taxes FOR SELECT
  USING (is_active = true OR public.is_staff());

CREATE POLICY "taxes_manage_admin"
  ON taxes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Discounts
CREATE POLICY "discounts_select_active_or_staff"
  ON discounts FOR SELECT
  USING (is_active = true OR public.is_staff());

CREATE POLICY "discounts_manage_admin"
  ON discounts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Discount Products
CREATE POLICY "discount_products_select_authenticated"
  ON discount_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "discount_products_manage_admin"
  ON discount_products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Discount Usages
CREATE POLICY "discount_usages_select_own_or_staff"
  ON discount_usages FOR SELECT
  USING (customer_id = public.get_customer_id_for_auth_user() OR public.is_staff());

CREATE POLICY "discount_usages_manage_staff"
  ON discount_usages FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- -----------------------------------------------------------------------------
-- 10. RLS POLICIES: INVOICES & INVOICE ITEMS
-- -----------------------------------------------------------------------------

CREATE POLICY "invoices_select_own_or_staff"
  ON invoices FOR SELECT
  USING (customer_id = public.get_customer_id_for_auth_user() OR public.is_staff());

CREATE POLICY "invoices_manage_staff"
  ON invoices FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "invoice_items_select_own_or_staff"
  ON invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_items.invoice_id
      AND (i.customer_id = public.get_customer_id_for_auth_user() OR public.is_staff())
    )
  );

CREATE POLICY "invoice_items_manage_staff"
  ON invoice_items FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- -----------------------------------------------------------------------------
-- 11. RLS POLICIES: PAYMENTS & PAYMENT ALLOCATIONS
-- -----------------------------------------------------------------------------

CREATE POLICY "payments_select_own_or_staff"
  ON payments FOR SELECT
  USING (customer_id = public.get_customer_id_for_auth_user() OR public.is_staff());

CREATE POLICY "payments_manage_staff"
  ON payments FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "payment_allocations_select_own_or_staff"
  ON payment_allocations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      WHERE p.id = payment_allocations.payment_id
      AND (p.customer_id = public.get_customer_id_for_auth_user() OR public.is_staff())
    )
  );

CREATE POLICY "payment_allocations_manage_staff"
  ON payment_allocations FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- -----------------------------------------------------------------------------
-- 12. RLS POLICIES: BILLING LOGS & AUDIT LOGS
-- -----------------------------------------------------------------------------

-- Billing logs: Only staff and admin can view; only system / admin can insert
CREATE POLICY "billing_logs_select_staff"
  ON billing_logs FOR SELECT
  USING (public.is_staff());

CREATE POLICY "billing_logs_manage_admin"
  ON billing_logs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Audit logs: Strict security - only staff/admin view, immutable append-only
CREATE POLICY "audit_logs_select_staff"
  ON audit_logs FOR SELECT
  USING (public.is_staff());

CREATE POLICY "audit_logs_insert_authenticated"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
