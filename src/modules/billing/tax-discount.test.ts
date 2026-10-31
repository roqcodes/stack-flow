import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findApplicableTaxes, calculateTaxesForAmount } from "@/modules/taxes/tax-calculator";
import { validateAndCalculateDiscount } from "@/modules/discounts/discount-engine";
import { Tax } from "@/modules/taxes/types";
import { Discount } from "@/modules/discounts/types";

describe("Taxes & Discount Engines Integration (Prompts 4.1 & 4.2)", () => {
  const sampleTaxes: Tax[] = [
    {
      id: "tax-1",
      name: "US California Sales Tax",
      code: "TAX-US-CA",
      country: "US",
      state_province: "CA",
      rate: 7.25,
      is_compound: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "tax-2",
      name: "Germany VAT",
      code: "TAX-DE",
      country: "DE",
      state_province: null,
      rate: 19.0,
      is_compound: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "tax-3",
      name: "Environmental Surcharge (Compound)",
      code: "TAX-US-ENV",
      country: "US",
      state_province: "CA",
      rate: 2.0,
      is_compound: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  describe("Tax Jurisdiction Matching & Compound Calculation", () => {
    it("matches specific state and country jurisdictions", () => {
      const caTaxes = findApplicableTaxes(sampleTaxes, "US", "CA");
      assert.equal(caTaxes.length, 2); // Base CA tax + Environmental compound tax

      const nyTaxes = findApplicableTaxes(sampleTaxes, "US", "NY");
      assert.equal(nyTaxes.length, 0); // No NY rule defined

      const deTaxes = findApplicableTaxes(sampleTaxes, "DE");
      assert.equal(deTaxes.length, 1);
      assert.equal(deTaxes[0].code, "TAX-DE");
    });

    it("calculates compound taxes on top of base taxes accurately", () => {
      const caTaxes = findApplicableTaxes(sampleTaxes, "US", "CA");
      const result = calculateTaxesForAmount(100.0, caTaxes);

      // Base: $100.00
      // Tax 1 (7.25%): $7.25 -> running base = $107.25
      // Tax 2 compound (2.0% on $107.25): 107.25 * 0.02 = 2.145 -> rounds to $2.15
      // Total tax: 7.25 + 2.15 = 9.40
      assert.equal(result.taxableAmount, 100.0);
      assert.equal(result.totalTax, 9.4);
      assert.equal(result.breakdown.length, 2);
      assert.equal(result.breakdown[0].taxAmount, 7.25);
      assert.equal(result.breakdown[1].taxAmount, 2.15);
      assert.equal(result.appliedSnapshots.length, 2);
    });
  });

  describe("Discount Engine Validation & Quotas", () => {
    const activeDiscount: Discount = {
      id: "disc-1",
      name: "Save 20%",
      code: "SAVE20",
      type: "percentage",
      value: 20,
      currency: "USD",
      times_redeemed: 3,
      max_redemptions: 5,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("accepts valid percentage discount within quotas", () => {
      const res = validateAndCalculateDiscount({
        discount: activeDiscount,
        subtotal: 200.0,
      });

      assert.equal(res.isValid, true);
      assert.equal(res.discountAmount, 40.0); // 20% of 200
    });

    it("rejects discounts that reached their redemption limits", () => {
      const exhaustedDiscount = { ...activeDiscount, times_redeemed: 5, max_redemptions: 5 };
      const res = validateAndCalculateDiscount({
        discount: exhaustedDiscount,
        subtotal: 200.0,
      });

      assert.equal(res.isValid, false);
      assert.equal(res.code, "DISCOUNT_LIMIT_REACHED");
    });

    it("caps fixed amount discount so it never exceeds subtotal", () => {
      const fixedDiscount: Discount = {
        id: "disc-2",
        name: "$100 Off",
        code: "HUNDRED",
        type: "fixed_amount",
        value: 100,
        times_redeemed: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = validateAndCalculateDiscount({
        discount: fixedDiscount,
        subtotal: 45.0, // Subtotal smaller than discount
      });

      assert.equal(res.isValid, true);
      assert.equal(res.discountAmount, 45.0); // Capped at $45.00
    });
  });
});
