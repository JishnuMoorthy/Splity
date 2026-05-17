// Money math (CLAUDE.md §7). Always store cents as integers.

export function calculateClaimerTotal(
  claimerSubtotalCents: number,
  billSubtotalCents: number,
  billTaxCents: number,
  billTipCents: number
): number {
  if (billSubtotalCents <= 0) return 0;
  const proportion = claimerSubtotalCents / billSubtotalCents;
  const claimerTax = Math.round(billTaxCents * proportion);
  const claimerTip = Math.round(billTipCents * proportion);
  return claimerSubtotalCents + claimerTax + claimerTip;
}

export type Currency = "USD" | "INR";

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// INR: the user explicitly asked for the "Rs." prefix (rather than ₹). Use
// en-IN grouping so 100,000 renders as 1,00,000 — the Indian lakh format.
const INR_NUMBER = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function currencySymbol(currency: Currency = "USD"): string {
  return currency === "INR" ? "Rs." : "$";
}

export function formatCents(cents: number, currency: Currency = "USD"): string {
  if (currency === "INR") {
    return `Rs. ${INR_NUMBER.format(cents / 100)}`;
  }
  return USD_FORMATTER.format(cents / 100);
}

export function dollarsToCents(input: string | number): number {
  const n = typeof input === "string" ? parseFloat(input) : input;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDollarString(cents: number): string {
  if (cents === 0) return "";
  return (cents / 100).toFixed(2);
}
