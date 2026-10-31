-- =============================================================================
-- BRIGHTLOOP SUBSCRIPTION MANAGEMENT & RECURRING BILLING PLATFORM
-- Migration: 20261031000003_add_profile_status_and_permissions.sql
-- Description: Add is_active flag and assigned permissions array to profiles
-- =============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
