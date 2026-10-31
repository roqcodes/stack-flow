-- =============================================================================
-- BRIGHTLOOP SUBSCRIPTION MANAGEMENT & RECURRING BILLING PLATFORM
-- Migration: 20261031000002_auth_trigger_and_bootstrap.sql
-- Description: Supabase Auth New User Trigger & Secure Admin Bootstrap Function
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AUTOMATIC PROFILE CREATION TRIGGER ON auth.users
-- -----------------------------------------------------------------------------
-- CRITICAL BUSINESS RULE:
-- Public registration ALWAYS creates a 'customer' account.
-- Public metadata must NEVER be allowed to grant admin or staff roles.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_company_name TEXT;
  v_contact_name TEXT;
  v_customer_id UUID;
BEGIN
  -- Extract names from metadata safely
  v_contact_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', v_contact_name || ' Organization');

  -- 1. Insert Profile with hardcoded 'customer' role
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    v_contact_name,
    'customer'::public.user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;

  -- 2. Automatically provision initial customer organization record linked to this profile
  INSERT INTO public.customers (
    profile_id,
    company_name,
    contact_name,
    email,
    currency,
    status,
    is_active
  )
  VALUES (
    NEW.id,
    v_company_name,
    v_contact_name,
    NEW.email,
    'USD',
    'active',
    true
  )
  ON CONFLICT (email) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. SECURE INITIAL ADMIN BOOTSTRAP PROCEDURE
-- -----------------------------------------------------------------------------
-- This procedure safely elevates a specified registered user to 'admin'.
-- Security constraint: If an active admin already exists, this function can ONLY
-- be executed by an existing admin or service role.

CREATE OR REPLACE FUNCTION public.bootstrap_initial_admin(p_email TEXT)
RETURNS jsonb AS $$
DECLARE
  v_existing_admin_count INT;
  v_target_profile_id UUID;
BEGIN
  -- Check if any admin already exists in profiles
  SELECT COUNT(*) INTO v_existing_admin_count
  FROM public.profiles
  WHERE role = 'admin';

  -- If an admin already exists, verify that the caller is an admin
  IF v_existing_admin_count > 0 THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'SECURITY ERROR: An administrator is already registered. Only existing administrators can promote accounts.';
    END IF;
  END IF;

  -- Locate target profile by email
  SELECT id INTO v_target_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email));

  IF v_target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile with email % not found. User must register first before elevation.', p_email;
  END IF;

  -- Elevate role to admin
  UPDATE public.profiles
  SET role = 'admin',
      updated_at = NOW()
  WHERE id = v_target_profile_id;

  -- Record audit log
  INSERT INTO public.audit_logs (
    user_id,
    table_name,
    record_id,
    action,
    new_values
  )
  VALUES (
    v_target_profile_id,
    'profiles',
    v_target_profile_id,
    'UPDATE',
    jsonb_build_object('role', 'admin', 'reason', 'initial_admin_bootstrap')
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('User %s successfully elevated to administrator.', p_email),
    'profile_id', v_target_profile_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 3. STAFF PROVISIONING PROCEDURE (ADMIN ONLY)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_staff_role(p_email TEXT)
RETURNS jsonb AS $$
DECLARE
  v_target_profile_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'SECURITY ERROR: Only administrators can assign staff accounts.';
  END IF;

  SELECT id INTO v_target_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email));

  IF v_target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile with email % does not exist.', p_email;
  END IF;

  UPDATE public.profiles
  SET role = 'staff',
      updated_at = NOW()
  WHERE id = v_target_profile_id;

  INSERT INTO public.audit_logs (
    user_id,
    table_name,
    record_id,
    action,
    new_values
  )
  VALUES (
    auth.uid(),
    'profiles',
    v_target_profile_id,
    'UPDATE',
    jsonb_build_object('role', 'staff', 'promoted_by', auth.uid())
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Staff role assigned to %s.', p_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
