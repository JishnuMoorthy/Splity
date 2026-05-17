import { formatCents, type Currency } from "@/lib/money";

export function MoneyDisplay({
  cents,
  currency = "USD",
  className = "",
}: {
  cents: number;
  currency?: Currency;
  className?: string;
}) {
  return (
    <span className={`font-mono ${className}`}>
      {formatCents(cents, currency)}
    </span>
  );
}
