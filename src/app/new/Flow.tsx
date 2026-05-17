"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol, formatCents, type Currency } from "@/lib/money";
import { MoneyInput } from "@/components/MoneyInput";
import { QuantityInput } from "@/components/QuantityInput";
import { ItemUnitsPicker } from "@/components/ItemUnitsPicker";
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

type CreatedItem = {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
};

export function NewBillFlow({ currency = "USD" }: { currency?: Currency } = {}) {
  const router = useRouter();
  const symbol = currencySymbol(currency);
  const [stage, setStage] = useState<
    "upload" | "loading" | "validate" | "cover" | "done"
  >("upload");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [doneShortId, setDoneShortId] = useState<string | null>(null);
  const [createdItems, setCreatedItems] = useState<CreatedItem[]>([]);
  // Map of item_id -> covered units. For qty>1: integer count.
  // For qty===1: fractional share (0.25, 0.5, 0.75, 1).
  const [coveredUnits, setCoveredUnits] = useState<Map<string, number>>(
    new Map()
  );
  const [savingCover, setSavingCover] = useState(false);
  const [copied, setCopied] = useState(false);
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

  function startManualEntry() {
    setError(null);
    setDraft({
      restaurant_name: "",
      items: [
        { name: "", price_cents: 0, quantity: 1, is_shared: false, assigned_name: "" },
      ],
      tax_cents: 0,
      tip_cents: 0,
      receipt_path: null,
    });
    setStage("validate");
  }

  if (stage === "upload") {
    return (
      <div className="reveal mt-6 space-y-4">
        <p className="text-[var(--color-muted)]">
          Snap a receipt, upload one, or enter items by hand.
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
        <button
          type="button"
          onClick={startManualEntry}
          className="tap w-full px-6 py-8 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-divider)] text-[var(--color-ink)]"
        >
          <div className="font-display text-xl">Enter it yourself</div>
          <div className="text-xs text-[var(--color-muted)] mt-1">
            No receipt? Type the items in.
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
        setDoneShortId(res.short_id);
        setCreatedItems(res.items ?? []);
        // Skip the cover step entirely if there's nothing to cover
        // (e.g. only auto-assigned lines).
        setStage((res.items?.length ?? 0) > 0 ? "cover" : "done");
        router.refresh();
      }
    });
  }

  function setCoveredUnit(itemId: string, units: number) {
    setCoveredUnits((prev) => {
      const next = new Map(prev);
      if (units <= 0) next.delete(itemId);
      else next.set(itemId, units);
      return next;
    });
  }

  async function submitCover(skip: boolean) {
    if (!doneShortId) return;
    setError(null);
    const selections = Array.from(coveredUnits.entries())
      .filter(([, u]) => u > 0)
      .map(([item_id, units]) => ({ item_id, units }));
    if (skip || selections.length === 0) {
      setStage("done");
      return;
    }
    setSavingCover(true);
    try {
      const res = await fetch("/api/claims/payer-self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          short_id: doneShortId,
          selections,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save coverage. You can still share.");
        // Don't block the user — let them share anyway.
      }
      setStage("done");
    } catch {
      setError("Network error saving coverage. You can still share.");
      setStage("done");
    } finally {
      setSavingCover(false);
    }
  }

  async function copyDoneLink() {
    if (!doneShortId) return;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const link = `${appUrl}/b/${doneShortId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", link);
    }
  }

  async function shareDoneLink() {
    if (!doneShortId) return;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const link = `${appUrl}/b/${doneShortId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Splity",
          text: draft?.restaurant_name
            ? `I paid for ${draft.restaurant_name}. Tap your items:`
            : "I paid. Tap your items:",
          url: link,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copyDoneLink();
    }
  }

  if (stage === "cover" && doneShortId) {
    const coveredTotal = createdItems.reduce((s, it) => {
      const u = coveredUnits.get(it.id) ?? 0;
      return s + Math.round(it.price_cents * u);
    }, 0);
    const coveredCount = Array.from(coveredUnits.values()).filter(
      (u) => u > 0
    ).length;
    return (
      <div className="reveal mt-6 space-y-5 pb-40">
        <div>
          <div className="font-display text-3xl text-[var(--color-ink)]">
            Anything you&apos;re covering?
          </div>
          <p className="text-[var(--color-muted)] mt-1 text-sm">
            Pick how much of each item you&apos;re paying for yourself — for
            multi-quantity lines, pick the count; otherwise pick a share.
            Covered items won&apos;t show up as claimable on the share page.
          </p>
        </div>

        <ul className="space-y-3">
          {createdItems.map((it) => {
            const u = coveredUnits.get(it.id) ?? 0;
            const lineCents = Math.round(it.price_cents * u);
            return (
              <li
                key={it.id}
                className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {it.name}
                      {it.quantity > 1 ? (
                        <span className="ml-1 text-xs text-[var(--color-muted)]">
                          × {it.quantity}
                        </span>
                      ) : null}
                    </div>
                    {u > 0 ? (
                      <div className="text-xs text-[var(--color-muted)] mt-0.5">
                        Covering {formatCents(lineCents, currency)}
                      </div>
                    ) : null}
                  </div>
                  <span className="font-mono text-sm text-[var(--color-muted)] whitespace-nowrap">
                    {formatCents(it.price_cents * it.quantity, currency)}
                  </span>
                </div>
                <div className="mt-2">
                  <ItemUnitsPicker
                    quantity={it.quantity}
                    units={u}
                    onChange={(units) => setCoveredUnit(it.id, units)}
                    ariaLabel={`Covering ${it.name}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {error ? (
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        ) : null}

        <div className="fixed bottom-0 inset-x-0 px-6 pt-3 pb-6 bg-[var(--color-bg)] border-t border-[var(--color-divider)]">
          <div className="max-w-xl mx-auto">
            <div className="flex justify-between text-sm text-[var(--color-muted)]">
              <span>You&apos;re covering</span>
              <span className="font-mono">
                {formatCents(coveredTotal, currency)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => submitCover(false)}
              disabled={savingCover}
              className="tap w-full mt-3 px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
            >
              {savingCover
                ? "Saving…"
                : coveredCount > 0
                  ? `Continue — covering ${coveredCount} item${coveredCount === 1 ? "" : "s"}`
                  : "Continue without covering anything"}
            </button>
            <button
              type="button"
              onClick={() => submitCover(true)}
              disabled={savingCover}
              className="tap w-full mt-2 px-6 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "done" && doneShortId) {
    const appUrl =
      typeof window !== "undefined"
        ? process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "";
    const link = `${appUrl}/b/${doneShortId}`;
    return (
      <div className="reveal mt-6 space-y-5">
        <div>
          <div className="font-display text-3xl text-[var(--color-ink)]">
            Your link is ready
          </div>
          <p className="text-[var(--color-muted)] mt-1">
            Share it with anyone who owes you. They tap their items and pay
            you back — no app, no sign up.
          </p>
        </div>

        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
          <div className="text-xs text-[var(--color-muted)]">Share link</div>
          <div className="mt-1 font-mono text-sm break-all text-[var(--color-ink)]">
            {link}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={shareDoneLink}
            className="tap flex-1 px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium"
          >
            Share
          </button>
          <button
            type="button"
            onClick={copyDoneLink}
            className="tap flex-1 px-6 py-3.5 rounded-[var(--radius-pill)] border border-[var(--color-divider)] text-[var(--color-ink)] font-medium"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/me"
            className="tap flex-1 text-center px-4 py-3 rounded-[var(--radius-pill)] text-sm text-[var(--color-muted)] hover:bg-[var(--color-divider)]"
          >
            Back to my bills
          </Link>
          <Link
            href={`/b/${doneShortId}`}
            className="tap flex-1 text-center px-4 py-3 rounded-[var(--radius-pill)] text-sm text-[var(--color-muted)] hover:bg-[var(--color-divider)]"
          >
            Preview
          </Link>
        </div>
      </div>
    );
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
          symbol={symbol}
        />
        <DollarField
          label="Tip"
          cents={draft.tip_cents}
          onChange={(c) => setDraft((d) => (d ? { ...d, tip_cents: c } : d))}
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
