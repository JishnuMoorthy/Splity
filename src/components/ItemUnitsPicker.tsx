"use client";

/**
 * Stepper / percentage picker for choosing how much of a line item the
 * current user is claiming or covering. Used in:
 *  - Payee claim flow (other people's units factored in via `max`)
 *  - Payer self-cover flow (cover step before sharing)
 *
 * Multi-quantity lines (e.g. "Kingfisher × 5") render a +/- stepper from
 * 0 to `max`. Single-quantity lines render a 0/25/50/75/100 % picker.
 */
export type ItemUnitsPickerProps = {
  quantity: number;
  units: number; // 0 when none selected; for qty==1 holds fractional share
  onChange: (units: number) => void;
  /** Hard cap on the stepper (e.g. quantity minus what others claimed). */
  max?: number;
  /** Visual variant — light buttons (default) or accent-on-white. */
  variant?: "muted" | "accent";
  ariaLabel?: string;
};

const PERCENTS = [0, 25, 50, 75, 100] as const;

export function ItemUnitsPicker({
  quantity,
  units,
  onChange,
  max,
  variant = "muted",
  ariaLabel,
}: ItemUnitsPickerProps) {
  const isMulti = quantity > 1;
  const cap = Math.min(quantity, max ?? quantity);

  const trackClass =
    variant === "accent"
      ? "bg-white/15 text-white"
      : "bg-[var(--color-divider)] text-[var(--color-ink)]";
  const buttonIdleClass =
    variant === "accent" ? "text-white" : "text-[var(--color-ink)]";
  const buttonSelectedClass =
    variant === "accent"
      ? "bg-white text-[var(--color-accent)]"
      : "bg-[var(--color-accent)] text-white";

  if (isMulti) {
    return (
      <div
        className={`flex items-center gap-2 p-1 rounded-[var(--radius-pill)] text-xs ${trackClass}`}
        aria-label={ariaLabel ?? "Units"}
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(0, units - 1))}
          disabled={units <= 0}
          className={`tap w-9 h-7 rounded-[var(--radius-pill)] text-base leading-none disabled:opacity-40 ${
            variant === "accent"
              ? "bg-white/15 text-white"
              : "bg-white text-[var(--color-ink)]"
          }`}
          aria-label="Decrease"
        >
          −
        </button>
        <div className="flex-1 text-center">
          <span className="font-mono text-sm">
            {units} of {quantity}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(cap, units + 1))}
          disabled={units >= cap}
          className={`tap w-9 h-7 rounded-[var(--radius-pill)] text-base leading-none disabled:opacity-40 ${
            variant === "accent"
              ? "bg-white/15 text-white"
              : "bg-white text-[var(--color-ink)]"
          }`}
          aria-label="Increase"
        >
          +
        </button>
      </div>
    );
  }

  // qty === 1: percentage picker (units is fractional 0..1)
  const pickedPct = Math.round((units ?? 0) * 100);
  return (
    <div
      className={`flex gap-1 p-1 rounded-[var(--radius-pill)] text-xs ${trackClass}`}
      role="radiogroup"
      aria-label={ariaLabel ?? "Share"}
    >
      {PERCENTS.map((p) => {
        const selected = pickedPct === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p / 100)}
            className={`flex-1 px-2 py-1.5 rounded-[var(--radius-pill)] transition-colors ${
              selected ? buttonSelectedClass : buttonIdleClass
            }`}
          >
            {p}%
          </button>
        );
      })}
    </div>
  );
}
