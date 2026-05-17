"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol, formatCents, type Currency } from "@/lib/money";
import { MoneyInput } from "@/components/MoneyInput";
import { QuantityInput } from "@/components/QuantityInput";
import { updateBillAction } from "@/app/me/actions";

type DraftItem = {
  name: string;
  price_cents: number;
  quantity: number;
  is_shared: boolean;
  assigned_name: string;
};

type Initial = {
  restaurant_name: string;
  items: DraftItem[];
  tax_cents: number;
  tip_cents: number;
};

export function EditBillFlow({
  billId,
  shortId,
  initial,
  currency = "USD",
}: {
  billId: string;
  shortId: string;
  initial: Initial;
  currency?: Currency;
}) {
  const router = useRouter();
  const symbol = currencySymbol(currency);
  const [draft, setDraft] = useState<Initial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotal = draft.items.reduce(
    (s, it) => s + it.price_cents * it.quantity,
    0
  );
  const total = subtotal + draft.tax_cents + draft.tip_cents;

  function update(idx: number, patch: Partial<DraftItem>) {
    setDraft((d) => {
      const items = [...d.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...d, items };
    });
  }

  function addItem() {
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        { name: "", price_cents: 0, quantity: 1, is_shared: false, assigned_name: "" },
      ],
    }));
  }

  function removeItem(idx: number) {
    setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));
  }

  function submit() {
    setError(null);
    const cleaned = draft.items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name.length > 0 && it.price_cents > 0);
    if (cleaned.length === 0) {
      setError("Add at least one item.");
      return;
    }
    const payload = {
      bill_id: billId,
      restaurant_name: draft.restaurant_name.trim() || null,
      tax_cents: draft.tax_cents,
      tip_cents: draft.tip_cents,
      items: cleaned.map((it) => ({
        name: it.name,
        price_cents: it.price_cents,
        quantity: it.quantity,
        is_shared: it.is_shared,
        assigned_to: it.assigned_name.trim() || null,
      })),
    };
    startTransition(async () => {
      const res = await updateBillAction(JSON.stringify(payload));
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push(`/me/b/${shortId}`);
      router.refresh();
    });
  }

  return (
    <div className="reveal mt-2 space-y-5 pb-32">
      <input
        value={draft.restaurant_name}
        onChange={(e) =>
          setDraft((d) => ({ ...d, restaurant_name: e.target.value }))
        }
        placeholder="Where (optional) — e.g. Joe's Pizza, Shell, AMC"
        className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)] font-display text-lg"
      />

      <div className="space-y-2">
        {draft.items.map((it, idx) => (
          <div
            key={idx}
            className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
          >
            <div className="flex gap-2 items-center">
              <input
                value={it.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="Item name"
                className="flex-1 px-2 py-2 bg-transparent focus:outline-none"
              />
              <span className="text-[var(--color-muted)] font-mono">{symbol}</span>
              <MoneyInput
                cents={it.price_cents}
                onChange={(c) => update(idx, { price_cents: c })}
                aria-label="Item price"
                className="w-20 min-w-0 px-2 py-2 bg-transparent text-right focus:outline-none font-mono"
              />
            </div>
            <div className="flex gap-3 items-center mt-2 text-xs text-[var(--color-muted)]">
              <label className="flex items-center gap-1">
                Qty
                <QuantityInput
                  value={it.quantity}
                  onChange={(q) => update(idx, { quantity: q })}
                  aria-label="Quantity"
                  className="w-12 ml-1 px-1 py-0.5 bg-transparent border-b border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={it.is_shared}
                  onChange={(e) => update(idx, { is_shared: e.target.checked })}
                />
                Shared
              </label>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="ml-auto text-[var(--color-error)] hover:underline"
              >
                Remove
              </button>
            </div>
            <input
              value={it.assigned_name}
              onChange={(e) => update(idx, { assigned_name: e.target.value })}
              placeholder="Assign to (optional) — e.g. Mary"
              className="mt-2 w-full px-2 py-1.5 text-xs bg-transparent border-b border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="tap w-full px-4 py-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-divider)] text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          + Add item
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DollarField
          label="Tax"
          cents={draft.tax_cents}
          onChange={(c) => setDraft((d) => ({ ...d, tax_cents: c }))}
          symbol={symbol}
        />
        <DollarField
          label="Tip"
          cents={draft.tip_cents}
          onChange={(c) => setDraft((d) => ({ ...d, tip_cents: c }))}
          symbol={symbol}
        />
      </div>

      {error ? (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      ) : null}

      <div className="fixed bottom-0 inset-x-0 px-6 pt-3 pb-6 bg-[var(--color-bg)] border-t border-[var(--color-divider)]">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between text-sm text-[var(--color-muted)]">
            <span>Subtotal</span>
            <span className="font-mono">{formatCents(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-base mt-1">
            <span className="font-medium">Total</span>
            <span className="font-mono font-medium">{formatCents(total, currency)}</span>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="tap w-full mt-3 px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DollarField({
  label,
  cents,
  onChange,
  symbol,
}: {
  label: string;
  cents: number;
  onChange: (c: number) => void;
  symbol: string;
}) {
  return (
    <label className="block w-full">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <div className="mt-1 flex items-center w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus-within:border-[var(--color-accent)]">
        <span className="text-[var(--color-muted)] font-mono">{symbol}</span>
        <MoneyInput
          cents={cents}
          onChange={onChange}
          aria-label={label}
          className="flex-1 min-w-0 ml-1 bg-transparent text-right focus:outline-none font-mono"
        />
      </div>
    </label>
  );
}
