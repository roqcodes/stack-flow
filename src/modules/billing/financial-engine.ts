/**
 * =============================================================================
 * BRIGHTLOOP FINANCIAL CALCULATION ENGINE
 * Module: @/modules/billing/financial-engine
 * 
 * Strict Invariants:
 * 1. Decimal-Safe Calculations: No IEEE 754 floating-point drift.
 * 2. Cent-Accurate Integer Math: Subtotals and lines computed with epsilon-safe rounding.
 * 3. Server-Side Finality: All final invoice totals are computed server-side.
 * =============================================================================
 */

/**
 * Rounds any monetary number to exactly 2 decimal places.
 * Uses Number.EPSILON to ensure symmetric arithmetic rounding without standard IEEE-754 floor bugs.
 */
export function roundFinancial(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Converts monetary amount to whole integer cents.
 */
export function toCents(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

/**
 * Converts whole integer cents back to dollar/currency amount.
 */
export function fromCents(cents: number): number {
  if (isNaN(cents) || !isFinite(cents)) return 0;
  return roundFinancial(cents / 100);
}

export interface LineItemInput {
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  taxRate?: number; // e.g. 8.25 for 8.25%
}

export interface LineItemTotals {
  quantity: number;
  unitPrice: number;
  subtotal: number;       // unitPrice * quantity
  discountAmount: number; // line discount applied
  taxableAmount: number;  // subtotal - discountAmount
  taxRate: number;
  taxAmount: number;      // taxableAmount * (taxRate / 100)
  totalAmount: number;    // taxableAmount + taxAmount
}

/**
 * Computes line item financials with decimal-safe rounding.
 */
export function calculateLineItemTotals(item: LineItemInput): LineItemTotals {
  const qty = Math.max(1, Math.floor(item.quantity || 1));
  const unitPrice = roundFinancial(Math.max(0, item.unitPrice || 0));
  const subtotal = roundFinancial(unitPrice * qty);

  const rawDiscount = Math.max(0, item.discountAmount || 0);
  const discountAmount = roundFinancial(Math.min(subtotal, rawDiscount));
  const taxableAmount = roundFinancial(Math.max(0, subtotal - discountAmount));

  const taxRate = Math.max(0, item.taxRate || 0);
  const taxAmount = roundFinancial((taxableAmount * taxRate) / 100);
  const totalAmount = roundFinancial(taxableAmount + taxAmount);

  return {
    quantity: qty,
    unitPrice,
    subtotal,
    discountAmount,
    taxableAmount,
    taxRate,
    taxAmount,
    totalAmount,
  };
}

export interface InvoiceTotalsInput {
  lines: LineItemInput[];
  invoiceLevelDiscount?: {
    type: "percentage" | "fixed_amount";
    value: number;
  };
  globalTaxRate?: number;
  amountPaid?: number;
}

export interface InvoiceTotalsResult {
  subtotal: number;
  itemDiscountsTotal: number;
  invoiceDiscountTotal: number;
  totalDiscount: number;
  taxableSubtotal: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
}

/**
 * Computes whole invoice totals, incorporating line item math,
 * invoice-level discounts, taxes, and balance remaining.
 */
export function calculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotalsResult {
  let subtotalCents = 0;
  let itemDiscountsCents = 0;
  let lineTaxesCents = 0;

  for (const line of input.lines) {
    const computed = calculateLineItemTotals(line);
    subtotalCents += toCents(computed.subtotal);
    itemDiscountsCents += toCents(computed.discountAmount);
    lineTaxesCents += toCents(computed.taxAmount);
  }

  const subtotal = fromCents(subtotalCents);
  const itemDiscounts = fromCents(itemDiscountsCents);
  const postItemDiscountSubtotal = Math.max(0, subtotal - itemDiscounts);

  // Apply invoice-level discount if any
  let invoiceDiscount = 0;
  if (input.invoiceLevelDiscount && input.invoiceLevelDiscount.value > 0) {
    if (input.invoiceLevelDiscount.type === "percentage") {
      const pct = Math.min(100, Math.max(0, input.invoiceLevelDiscount.value));
      invoiceDiscount = roundFinancial((postItemDiscountSubtotal * pct) / 100);
    } else {
      invoiceDiscount = roundFinancial(Math.min(postItemDiscountSubtotal, input.invoiceLevelDiscount.value));
    }
  }

  const totalDiscount = roundFinancial(itemDiscounts + invoiceDiscount);
  const taxableSubtotal = roundFinancial(Math.max(0, subtotal - totalDiscount));

  // If a global tax rate is provided and no line taxes were computed, calculate global tax
  let totalTax = fromCents(lineTaxesCents);
  if (totalTax === 0 && input.globalTaxRate && input.globalTaxRate > 0) {
    totalTax = roundFinancial((taxableSubtotal * input.globalTaxRate) / 100);
  }

  const totalAmount = roundFinancial(taxableSubtotal + totalTax);
  const amountPaid = roundFinancial(Math.max(0, input.amountPaid || 0));
  const amountDue = roundFinancial(Math.max(0, totalAmount - amountPaid));

  const isFullyPaid = amountPaid >= totalAmount && totalAmount > 0;
  const isPartiallyPaid = amountPaid > 0 && amountPaid < totalAmount;

  return {
    subtotal,
    itemDiscountsTotal: itemDiscounts,
    invoiceDiscountTotal: invoiceDiscount,
    totalDiscount,
    taxableSubtotal,
    totalTax,
    totalAmount,
    amountPaid,
    amountDue,
    isFullyPaid,
    isPartiallyPaid,
  };
}

/**
 * Validates a payment allocation amount against an invoice's remaining balance.
 */
export function validatePaymentAllocation(
  paymentAvailableAmount: number,
  invoiceAmountDue: number,
  requestedAmount: number
): {
  isValid: boolean;
  allocatedAmount: number;
  error?: string;
} {
  const paymentAvailable = roundFinancial(paymentAvailableAmount);
  const amountDue = roundFinancial(invoiceAmountDue);
  const requested = roundFinancial(requestedAmount);

  if (requested <= 0) {
    return { isValid: false, allocatedAmount: 0, error: "Allocation amount must be greater than zero." };
  }

  if (requested > paymentAvailable) {
    return {
      isValid: false,
      allocatedAmount: 0,
      error: `Requested allocation ($${requested.toFixed(2)}) exceeds available payment amount ($${paymentAvailable.toFixed(2)}).`,
    };
  }

  if (requested > amountDue) {
    return {
      isValid: false,
      allocatedAmount: 0,
      error: `Requested allocation ($${requested.toFixed(2)}) exceeds invoice remaining due balance ($${amountDue.toFixed(2)}).`,
    };
  }

  return { isValid: true, allocatedAmount: requested };
}
