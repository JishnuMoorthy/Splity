import { formatCents } from "@/lib/money";

export function MoneyDisplay({
  cents,
  className = "",
}: {
  cents: number;
  className?: string;
}) {
  return <span className={`font-mono ${className}`}>{formatCents(cents)}</span>;
}
