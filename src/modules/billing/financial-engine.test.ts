import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  roundFinancial,
  toCents,
  fromCents,
  calculateLineItemTotals,
  calculateInvoiceTotals,
  validatePaymentAllocation,
} from "./financial-engine";

describe("Financial Calculation Engine (Prompt 4.3)", () => {
  describe("Decimal Precision & Cent Accuracy", () => {
    it("safely rounds classic IEEE 754 edge cases without drift", () => {
      // 0.1 + 0.2 = 0.30000000000000004
      const sum = 0.1 + 0.2;
      assert.equal(roundFinancial(sum), 0.3);

      // Half-up rounding on 1.005 -> 1.01
      assert.equal(roundFinancial(1.005), 1.01);
      assert.equal(roundFinancial(1.004), 1.0);
    });

    it("converts to and from integer cents with zero drift", () => {
      assert.equal(toCents(19.99), 1999);
      assert.equal(fromCents(1999), 19.99);
      assert.equal(toCents(0.01), 1);
      assert.equal(fromCents(1), 0.01);
      assert.equal(toCents(0), 0);
      assert.equal(fromCents(0), 0);
    });

    it("handles negative and NaN gracefully", () => {
      assert.equal(roundFinancial(NaN), 0);
      assert.equal(toCents(NaN), 0);
      assert.equal(fromCents(NaN), 0);
    });
  });

  describe("Line Item Calculations", () => {
    it("computes basic subtotal without tax or discount", () => {
      const line = calculateLineItemTotals({
        unitPrice: 49.0,
        quantity: 3,
      });

      assert.equal(line.quantity, 3);
      assert.equal(line.unitPrice, 49.0);
      assert.equal(line.subtotal, 147.0);
      assert.equal(line.discountAmount, 0);
      assert.equal(line.taxableAmount, 147.0);
      assert.equal(line.taxAmount, 0);
      assert.equal(line.totalAmount, 147.0);
    });

    it("applies line discount before calculating tax", () => {
      // $100 item with $20 discount -> $80 taxable, 10% tax -> $8 tax, $88 total
      const line = calculateLineItemTotals({
        unitPrice: 100.0,
        quantity: 1,
        discountAmount: 20.0,
        taxRate: 10.0,
      });

      assert.equal(line.subtotal, 100.0);
      assert.equal(line.discountAmount, 20.0);
      assert.equal(line.taxableAmount, 80.0);
      assert.equal(line.taxAmount, 8.0);
      assert.equal(line.totalAmount, 88.0);
    });

    it("clamps discount so taxable amount cannot be negative", () => {
      const line = calculateLineItemTotals({
        unitPrice: 50.0,
        quantity: 1,
        discountAmount: 100.0, // Exceeds line subtotal
      });

      assert.equal(line.subtotal, 50.0);
      assert.equal(line.discountAmount, 50.0);
      assert.equal(line.taxableAmount, 0.0);
      assert.equal(line.totalAmount, 0.0);
    });
  });

  describe("Invoice Totals Aggregation", () => {
    it("aggregates multiple lines with compound precision", () => {
      const result = calculateInvoiceTotals({
        lines: [
          { unitPrice: 49.99, quantity: 2, taxRate: 8.25 },
          { unitPrice: 199.0, quantity: 1, discountAmount: 50.0, taxRate: 8.25 },
        ],
      });

      // Line 1: 49.99 * 2 = 99.98 subtotal, 8.25% tax = 8.24835 -> 8.25 tax, total = 108.23
      // Line 2: 199.00 subtotal, 50.00 discount -> 149.00 taxable, 8.25% tax = 12.2925 -> 12.29 tax, total = 161.29
      assert.equal(result.subtotal, 298.98);
      assert.equal(result.totalDiscount, 50.0);
      assert.equal(result.taxableSubtotal, 248.98);
      assert.equal(result.totalTax, 20.54);
      assert.equal(result.totalAmount, 269.52);
      assert.equal(result.amountDue, 269.52);
      assert.equal(result.isFullyPaid, false);
    });

    it("tracks partial payments and full settlement correctly", () => {
      const initial = calculateInvoiceTotals({
        lines: [{ unitPrice: 100.0, quantity: 1 }],
        amountPaid: 40.0,
      });

      assert.equal(initial.totalAmount, 100.0);
      assert.equal(initial.amountPaid, 40.0);
      assert.equal(initial.amountDue, 60.0);
      assert.equal(initial.isPartiallyPaid, true);
      assert.equal(initial.isFullyPaid, false);

      const settled = calculateInvoiceTotals({
        lines: [{ unitPrice: 100.0, quantity: 1 }],
        amountPaid: 100.0,
      });

      assert.equal(settled.amountDue, 0.0);
      assert.equal(settled.isFullyPaid, true);
      assert.equal(settled.isPartiallyPaid, false);
    });
  });

  describe("Payment Allocation Validation", () => {
    it("accepts valid allocation within payment and invoice balance", () => {
      const check = validatePaymentAllocation(500.0, 300.0, 200.0);
      assert.equal(check.isValid, true);
      assert.equal(check.allocatedAmount, 200.0);
    });

    it("rejects allocation exceeding invoice amount due", () => {
      const check = validatePaymentAllocation(500.0, 300.0, 350.0);
      assert.equal(check.isValid, false);
      assert.match(check.error || "", /exceeds invoice remaining due/);
    });

    it("rejects allocation exceeding payment available amount", () => {
      const check = validatePaymentAllocation(150.0, 300.0, 200.0);
      assert.equal(check.isValid, false);
      assert.match(check.error || "", /exceeds available payment/);
    });
  });
});
