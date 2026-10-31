-- =============================================================================
-- BRIGHTLOOP SUBSCRIPTION MANAGEMENT & RECURRING BILLING PLATFORM
-- Migration: 20261031000005_atomic_billing_engine.sql
-- Description: Atomic Stored Procedure for Subscription Invoicing, Period Advancement,
--              Discount Usage Tracking, Duplicate Billing Prevention, and Billing Logs.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.execute_atomic_subscription_billing(
  p_subscription_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_due_date DATE,
  p_currency VARCHAR(3),
  p_subtotal NUMERIC(14,2),
  p_discount_amount NUMERIC(14,2),
  p_tax_amount NUMERIC(14,2),
  p_total_amount NUMERIC(14,2),
  p_line_items JSONB,
  p_discount_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_customer_id UUID;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_item RECORD;
  v_existing_invoice_id UUID;
  v_next_billing_date TIMESTAMPTZ;
  v_date_prefix TEXT;
  v_random_suffix TEXT;
BEGIN
  -- 1. Verify subscription existence and get customer_id
  SELECT customer_id INTO v_customer_id
  FROM public.subscriptions
  WHERE id = p_subscription_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Subscription with ID % not found.', p_subscription_id;
  END IF;

  -- 2. Duplicate Billing Protection (Period Overlap Invariant)
  SELECT id INTO v_existing_invoice_id
  FROM public.invoices
  WHERE subscription_id = p_subscription_id
    AND period_start = p_period_start
    AND period_end = p_period_end;

  IF v_existing_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_BILLING: Invoice % already generated for subscription % period [% to %].',
      v_existing_invoice_id, p_subscription_id, p_period_start, p_period_end;
  END IF;

  -- 3. Generate Unique Sequential/Hashed Invoice Number (INV-YYYYMMDD-XXXXXX)
  v_date_prefix := to_char(CURRENT_DATE, 'YYYYMMDD');
  v_random_suffix := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  v_invoice_number := 'INV-' || v_date_prefix || '-' || v_random_suffix;

  -- 4. Insert Invoice Record
  INSERT INTO public.invoices (
    invoice_number,
    customer_id,
    subscription_id,
    status,
    currency,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    amount_paid,
    amount_due,
    period_start,
    period_end,
    issue_date,
    due_date,
    notes,
    created_at,
    updated_at
  )
  VALUES (
    v_invoice_number,
    v_customer_id,
    p_subscription_id,
    'issued'::public.invoice_status,
    p_currency,
    p_subtotal,
    p_discount_amount,
    p_tax_amount,
    p_total_amount,
    0.00,
    p_total_amount,
    p_period_start,
    p_period_end,
    CURRENT_DATE,
    COALESCE(p_due_date, CURRENT_DATE + INTERVAL '14 days'),
    p_notes,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_invoice_id;

  -- 5. Insert Line Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_line_items) AS x(
    product_id UUID,
    plan_id UUID,
    description TEXT,
    quantity INT,
    unit_amount NUMERIC(14,2),
    discount_amount NUMERIC(14,2),
    tax_rate NUMERIC(5,2),
    tax_amount NUMERIC(14,2),
    total_amount NUMERIC(14,2)
  )
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id,
      product_id,
      plan_id,
      description,
      quantity,
      unit_amount,
      discount_amount,
      tax_rate,
      tax_amount,
      total_amount,
      created_at
    )
    VALUES (
      v_invoice_id,
      v_item.product_id,
      v_item.plan_id,
      v_item.description,
      COALESCE(v_item.quantity, 1),
      COALESCE(v_item.unit_amount, 0.00),
      COALESCE(v_item.discount_amount, 0.00),
      COALESCE(v_item.tax_rate, 0.00),
      COALESCE(v_item.tax_amount, 0.00),
      COALESCE(v_item.total_amount, 0.00),
      NOW()
    );
  END LOOP;

  -- 6. Record Discount Usage if discount applied
  IF p_discount_id IS NOT NULL AND p_discount_amount > 0 THEN
    INSERT INTO public.discount_usages (
      discount_id,
      customer_id,
      invoice_id,
      subscription_id,
      redeemed_amount,
      redeemed_at
    )
    VALUES (
      p_discount_id,
      v_customer_id,
      v_invoice_id,
      p_subscription_id,
      p_discount_amount,
      NOW()
    );

    UPDATE public.discounts
    SET times_redeemed = times_redeemed + 1,
        updated_at = NOW()
    WHERE id = p_discount_id;
  END IF;

  -- 7. Advance Subscription Period & Next Billing Date Atomically
  v_next_billing_date := p_period_end;

  UPDATE public.subscriptions
  SET current_period_start = p_period_start,
      current_period_end = p_period_end,
      next_billing_date = v_next_billing_date,
      status = 'active',
      updated_at = NOW()
  WHERE id = p_subscription_id;

  -- 8. Write Billing Engine Execution Log
  INSERT INTO public.billing_logs (
    subscription_id,
    customer_id,
    invoice_id,
    action,
    status,
    message,
    payload,
    created_at
  )
  VALUES (
    p_subscription_id,
    v_customer_id,
    v_invoice_id,
    'invoice_generated'::public.billing_action_type,
    'success',
    format('Generated invoice %s for period %s to %s', v_invoice_number, p_period_start, p_period_end),
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'total_amount', p_total_amount,
      'currency', p_currency
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total_amount', p_total_amount,
    'amount_due', p_total_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
