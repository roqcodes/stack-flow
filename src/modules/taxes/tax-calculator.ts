import { roundFinancial } from "@/modules/billing/financial-engine";
import { Tax, TaxCalculationResult, TaxBreakdownItem, TaxSnapshot } from "./types";

/**
 * Finds all active taxes applicable to a customer's billing destination.
 */
export function findApplicableTaxes(
  taxes: Tax[],
  country: string,
  stateProvince?: string | null
): Tax[] {
  const normCountry = country.trim().toUpperCase();
  const normState = stateProvince ? stateProvince.trim().toUpperCase() : null;

  return taxes.filter((t) => {
    if (!t.is_active) return false;
    if (t.country.toUpperCase() !== normCountry) return false;

    // If the tax specifies a state/province, customer must match it
    if (t.state_province) {
      return normState !== null && t.state_province.toUpperCase() === normState;
    }

    // Country-level tax applies to all states
    return true;
  });
}

/**
 * Creates an immutable snapshot of a tax rule to freeze onto invoice records.
 */
export function createTaxSnapshot(tax: Tax): TaxSnapshot {
  return {
    tax_id: tax.id,
    name: tax.name,
    code: tax.code,
    rate: tax.rate,
    country: tax.country,
    state_province: tax.state_province,
    is_compound: tax.is_compound,
  };
}

/**
 * Calculates itemized taxes for a taxable amount, strictly executing
 * compound taxes on top of base taxes and returning an immutable breakdown.
 */
export function calculateTaxesForAmount(
  taxableAmount: number,
  taxes: Tax[]
): TaxCalculationResult {
  const baseAmount = roundFinancial(Math.max(0, taxableAmount));
  if (baseAmount === 0 || !taxes || taxes.length === 0) {
    return {
      taxableAmount: baseAmount,
      totalTax: 0,
      breakdown: [],
      appliedSnapshots: [],
    };
  }

  // Sort standard taxes first, compound taxes second
  const sortedTaxes = [...taxes].sort((a, b) => {
    if (a.is_compound === b.is_compound) return 0;
    return a.is_compound ? 1 : -1;
  });

  const breakdown: TaxBreakdownItem[] = [];
  const appliedSnapshots: TaxSnapshot[] = [];
  let runningBase = baseAmount;
  let totalTaxAccumulator = 0;

  for (const tax of sortedTaxes) {
    if (tax.rate <= 0) continue;

    // Standard tax calculates against base amount;
    // Compound tax calculates against (base amount + previous taxes)
    const effectiveTaxable = tax.is_compound ? runningBase : baseAmount;
    const computedTax = roundFinancial((effectiveTaxable * tax.rate) / 100);

    breakdown.push({
      taxId: tax.id,
      name: tax.name,
      code: tax.code,
      rate: tax.rate,
      taxableAmount: effectiveTaxable,
      taxAmount: computedTax,
      isCompound: tax.is_compound,
    });

    appliedSnapshots.push(createTaxSnapshot(tax));
    totalTaxAccumulator = roundFinancial(totalTaxAccumulator + computedTax);
    runningBase = roundFinancial(runningBase + computedTax);
  }

  return {
    taxableAmount: baseAmount,
    totalTax: totalTaxAccumulator,
    breakdown,
    appliedSnapshots,
  };
}
