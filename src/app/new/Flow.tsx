"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dollarsToCents, formatCents, centsToDollarString } from "@/lib/money";
import { createBillAction } from "./actions";

type DraftItem = {
  name: string;
  price_cents: number;
  quantity: number;
  is_shared: boolean;
  assigned_name: string;
};

type Draft = {
  restaurant_name: string;
  items: DraftItem[];
  tax_cents: number;
  tip_cents: number;
  receipt_path: string | null;
};

export function NewBillFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<"upload" | "loading" | "validate">(
    "upload"
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError(null);
    setStage("loading");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "OCR failed. Try again or enter items manually.");
      setStage("validate");
      setDraft({
        restaurant_name: "",
        items: [{ name: "", price_cents: 0, quantity: 1, is_shared: false, assigned_name: "" }],
        tax_cents: 0,
        tip_cents: 0,
        receipt_path: null,
      });
      return;
    }
    const { parsed, receipt_path } = await res.json();
    setDraft({
      restaurant_name: parsed.restaurant_name ?? "",
      items: parsed.items.map((it: DraftItem) => ({
        name: it.name,
        price_cents: it.price_cents,
        quantity: it.quantity,
        is_shared: false,
        assigned_name: "",
      })),
      tax_cents: parsed.tax_cents,
      tip_cents: parsed.tip_cents,
      receipt_path: receipt_path ?? null,
    });
    setStage("validate");
  }

  if (stage === "upload") {
    return (
      <div className="reveal mt-6 space-y-4">
        <p className="text-[var(--color-muted)]">
          Snap or upload a receipt — restaurant, gas, tickets, anything.
          PDFs from email work too.
        </p>
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          className="tap w-full px-6 py-8 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-divider)] text-[var(--color-ink)]"
        >
          <div className="font-display text-xl">Take a photo</div>
          <div className="text-xs text-[var(--color-muted)] mt-1">
            Use your camera
          </div>
        </button>
        <button
          type="button"
          onClick={() => libraryInput.current?.click()}
          className="tap w-full px-6 py-8 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-divider)] text-[var(--color-ink)]"
        >
          <div className="font-display text-xl">Upload a file</div>
          <div className="text-xs text-[var(--color-muted)] mt-1">
            Image or PDF from your library
          </div>
        </button>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
        <input
          ref={libraryInput}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
      </div>
    );
  }

  if (stage === "loading") {
    return (
      <div className="mt-16 text-center">
        <div className="inline-flex items-center gap-3 text-[var(--color-ink)]">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
          <span>Reading your receipt…</span>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  const subtotal = draft.items.reduce(
    (s, it) => s + it.price_cents * it.quantity,
    0
  );
  const total = subtotal + draft.tax_cents + draft.tip_cents;

  function update(idx: number, patch: Partial<DraftItem>) {
    setDraft((d) => {
      if (!d) return d;
      const items = [...d.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...d, items };
    });
  }

  function addItem() {
    setDraft((d) =>
      d
        ? {
            ...d,
            items: [
              ...d.items,
              { name: "", price_cents: 0, quantity: 1, is_shared: false, assigned_name: "" },
            ],
          }
        : d
    );
  }

  function removeItem(idx: number) {
    setDraft((d) =>
      d ? { ...d, items: d.items.filter((_, i) => i !== idx) } : d
    );
  }

  function submit() {
    if (!draft) return;
    setError(null);
    const cleaned = draft.items
      .map((it) => ({
        ...it,
        name: it.name.trim(),
      }))
      .filter((it) => it.name.length > 0 && it.price_cents > 0);
    if (cleaned.length === 0) {
      setError("Add at least one item.");
      return;
    }
    const payload = {
      restaurant_name: draft.restaurant_name.trim() || null,
      receipt_path: draft.receipt_path,
      items: cleaned.map((it) => ({
        name: it.name,
        price_cents: it.price_cents,
        quantity: it.quantity,
        is_shared: it.is_shared,
        assigned_to: it.assigned_name.trim() || null,
      })),
      subtotal_cents: cleaned.reduce(
        (s, it) => s + it.price_cents * it.quantity,
        0
      ),
      tax_cents: draft.tax_cents,
      tip_cents: draft.tip_cents,
      total_cents:
        cleaned.reduce((s, it) => s + it.price_cents * it.quantity, 0) +
        draft.tax_cents +
        draft.tip_cents,
    };
    startTransition(async () => {
      const res = await createBillAction(JSON.stringify(payload));
      if (res?.error) {
        setError(res.error);
        if (res.redirect) {
          setTimeout(() => router.push(res.redirect!), 1500);
        }
        return;
      }
      if (res?.short_id) {
        router.push(`/me?new=${res.short_id}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="reveal mt-2 space-y-5 pb-32">
      <input
        value={draft.restaurant_name}
        onChange={(e) =>
          setDraft((d) => (d ? { ...d, restaurant_name: e.target.value } : d))
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
              <span className="text-[var(--color-muted)] font-mono">$</span>
              <input
                inputMode="decimal"
                value={centsToDollarString(it.price_cents)}
                onChange={(e) =>
                  update(idx, { price_cents: dollarsToCents(e.target.value) })
                }
                className="w-20 px-2 py-2 bg-transparent text-right focus:outline-none font-mono"
              />
            </div>
            <div className="flex gap-3 items-center mt-2 text-xs text-[var(--color-muted)]">
              <label className="flex items-center gap-1">
                Qty
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) =>
                    update(idx, {
                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-12 ml-1 px-1 py-0.5 bg-transparent border-b border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={it.is_shared}
                  onChange={(e) =>
                    update(idx, { is_shared: e.target.checked })
                  }
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
          onChange={(c) => setDraft((d) => (d ? { ...d, tax_cents: c } : d))}
        />
        <DollarField
          label="Tip"
          cents={draft.tip_cents}
          onChange={(c) => setDraft((d) => (d ? { ...d, tip_cents: c } : d))}
        />
      </div>

      {error ? (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      ) : null}

      <div className="fixed bottom-0 inset-x-0 px-6 pt-3 pb-6 bg-[var(--color-bg)] border-t border-[var(--color-divider)]">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between text-sm text-[var(--color-muted)]">
            <span>Subtotal</span>
            <span className="font-mono">{formatCents(subtotal)}</span>
          </div>
          <div className="flex justify-between text-base mt-1">
            <span className="font-medium">Total</span>
            <span className="font-mono font-medium">{formatCents(total)}</span>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="tap w-full mt-3 px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
          >
            {pending ? "Creating link…" : "Looks good — get share link"}
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
}: {
  label: string;
  cents: number;
  onChange: (c: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <div className="mt-1 flex items-center px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)]">
        <span className="text-[var(--color-muted)] font-mono">$</span>
        <input
          inputMode="decimal"
          value={centsToDollarString(cents)}
          onChange={(e) => onChange(dollarsToCents(e.target.value))}
          className="flex-1 ml-1 bg-transparent text-right focus:outline-none font-mono"
        />
      </div>
    </label>
  );
}
