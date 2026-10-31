import { roundFinancial } from "@/modules/billing/financial-engine";
import type { DiscountValidationParams, DiscountValidationResult } from "./types";

/**
 * Validates a discount against cart/invoice parameters and computes
 * the applicable discount amount with decimal-safe rounding.
 */
export function validateAndCalculateDiscount(
  params: DiscountValidationParams
): DiscountValidationResult {
  const { discount, subtotal, productIds, applicableProductIds, asOfDate } = params;

  // 1. Active check
  if (!discount.is_active) {
    return {
      isValid: false,
      discountAmount: 0,
      error: `Discount "${discount.code}" is inactive.`,
      code: "DISCOUNT_INACTIVE",
    };
  }

  // 2. Date window check
  const now = asOfDate ? new Date(asOfDate) : new Date();

  if (discount.valid_from && new Date(discount.valid_from) > now) {
    return {
      isValid: false,
      discountAmount: 0,
      error: `Discount "${discount.code}" is not yet active.`,
      code: "DISCOUNT_NOT_STARTED",
    };
  }

  if (discount.valid_until && new Date(discount.valid_until) < now) {
    return {
      isValid: false,
      discountAmount: 0,
      error: `Discount "${discount.code}" has expired.`,
      code: "DISCOUNT_EXPIRED",
    };
  }

  // 3. Redemption quota check
  if (
    typeof discount.max_redemptions === "number" &&
    discount.times_redeemed >= discount.max_redemptions
  ) {
    return {
      isValid: false,
      discountAmount: 0,
      error: `Discount "${discount.code}" has reached its maximum redemptions limit (${discount.max_redemptions}).`,
      code: "DISCOUNT_LIMIT_REACHED",
    };
  }

  // 4. Product applicability whitelist check (if specified)
  if (applicableProductIds && applicableProductIds.length > 0) {
    if (!productIds || productIds.length === 0) {
      return {
        isValid: false,
        discountAmount: 0,
        error: `Discount "${discount.code}" is restricted to specific products.`,
        code: "DISCOUNT_PRODUCT_MISMATCH",
      };
    }

    const hasMatchingProduct = productIds.some((pId) => applicableProductIds.includes(pId));
    if (!hasMatchingProduct) {
      return {
        isValid: false,
        discountAmount: 0,
        error: `Discount "${discount.code}" is not applicable to any of the products in this order.`,
        code: "DISCOUNT_PRODUCT_MISMATCH",
      };
    }
  }

  // 5. Compute discount amount
  const safeSubtotal = roundFinancial(Math.max(0, subtotal));
  if (safeSubtotal <= 0) {
    return { isValid: true, discountAmount: 0 };
  }

  let computedAmount = 0;
  if (discount.type === "percentage") {
    const rate = Math.min(100, Math.max(0, discount.value));
    computedAmount = roundFinancial((safeSubtotal * rate) / 100);
  } else {
    // Fixed amount capped at subtotal
    computedAmount = roundFinancial(Math.min(safeSubtotal, discount.value));
  }

  return {
    isValid: true,
    discountAmount: computedAmount,
  };
}
