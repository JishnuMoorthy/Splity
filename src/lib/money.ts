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

const FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCents(cents: number): string {
  return FORMATTER.format(cents / 100);
}

export function dollarsToCents(input: string | number): number {
  const n = typeof input === "string" ? parseFloat(input) : input;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDollarString(cents: number): string {
  return (cents / 100).toFixed(2);
}
