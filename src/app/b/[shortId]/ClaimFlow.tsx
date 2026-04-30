"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calculateClaimerTotal,
  centsToDollarString,
  dollarsToCents,
  formatCents,
} from "@/lib/money";
import type { PublicBill } from "@/lib/types";

type Mode = "items" | "custom";
type SharePercent = 25 | 50 | 75 | 100;

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "splity-session-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      crypto.randomUUID?.() ??
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function ClaimFlow({ bill }: { bill: PublicBill }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("items");
  const [picked, setPicked] = useState<Map<string, SharePercent>>(new Map());
  const [customCents, setCustomCents] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    const stored = localStorage.getItem("splity-name");
    if (stored) setName(stored);
  }, []);

  const subtotal = useMemo(() => {
    let s = 0;
    for (const it of bill.items) {
      const pct = picked.get(it.id);
      if (!pct) continue;
      const lineCents = Math.round(it.price_cents * it.quantity * (pct / 100));
      if (it.is_shared) {
        const others = it.claimed_by.filter((c) => c.name !== name).length;
        s += Math.round(lineCents / (others + 1));
      } else {
        s += lineCents;
      }
    }
    return s;
  }, [picked, bill, name]);

  const itemsTotal = calculateClaimerTotal(
    subtotal,
    bill.subtotal_cents,
    bill.tax_cents,
    bill.tip_cents
  );

  const total = mode === "custom" ? customCents : itemsTotal;

  function togglePick(id: string) {
    setPicked((p) => {
      const n = new Map(p);
      if (n.has(id)) n.delete(id);
      else n.set(id, 100);
      return n;
    });
  }

  function setPercent(id: string, pct: SharePercent) {
    setPicked((p) => {
      const n = new Map(p);
      n.set(id, pct);
      return n;
    });
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Tell us your name first.");
      return;
    }
    if (mode === "items" && picked.size === 0) {
      setError("Tap the items you owe for, or switch to a custom amount.");
      return;
    }
    if (mode === "custom" && customCents <= 0) {
      setError("Enter a dollar amount above zero.");
      return;
    }
    localStorage.setItem("splity-name", name.trim());
    setSubmitting(true);
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        short_id: bill.short_id,
        claimer_session_id: sessionId,
        claimer_name: name.trim(),
        selections:
          mode === "items"
            ? [...picked.entries()].map(([item_id, share_percent]) => ({
                item_id,
                share_percent,
              }))
            : [],
        custom_amount_cents: mode === "custom" ? customCents : null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
      return;
    }
    const { claim_id } = await res.json();
    router.push(`/b/${bill.short_id}/pay?cid=${claim_id}&amt=${total}`);
  }

  return (
    <div className="reveal pb-32">
      <div className="mt-2">
        <div className="font-display text-2xl text-[var(--color-ink)]">
          {bill.payer.display_name} paid{" "}
          <span className="font-mono">{formatCents(bill.total_cents)}</span>
        </div>
        {bill.restaurant_name ? (
          <div className="text-[var(--color-muted)] mt-0.5">
            at {bill.restaurant_name}
          </div>
        ) : null}
        {bill.has_receipt ? (
          <a
            href={`/api/receipt/${bill.short_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            View receipt
          </a>
        ) : null}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="mt-6 w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      {/* Mode toggle */}
      <div className="mt-5 flex gap-1 p-1 rounded-[var(--radius-pill)] bg-[var(--color-surface)] text-sm">
        <button
          type="button"
          onClick={() => setMode("items")}
          className={`flex-1 px-4 py-2 rounded-[var(--radius-pill)] transition-colors ${
            mode === "items"
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-muted)]"
          }`}
        >
          Pick items
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`flex-1 px-4 py-2 rounded-[var(--radius-pill)] transition-colors ${
            mode === "custom"
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-muted)]"
          }`}
        >
          Custom amount
        </button>
      </div>

      {mode === "items" ? (
        <>
          <p className="text-xs text-[var(--color-muted)] mt-4">
            Tap an item, then choose how much of it is yours. Shared items
            split evenly with everyone else who picks them.
          </p>

          <ul className="mt-3 space-y-2">
            {bill.items.map((it) => {
              const pct = picked.get(it.id);
              const isPicked = !!pct;
              const otherClaimers = it.claimed_by.filter(
                (c) => c.name !== name
              );
              return (
                <li key={it.id}>
                  <div
                    className={`rounded-[var(--radius-md)] border transition-colors ${
                      isPicked
                        ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                        : "bg-[var(--color-surface)] border-[var(--color-divider)] text-[var(--color-ink)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => togglePick(it.id)}
                      className="tap w-full text-left p-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {it.name}
                            {it.quantity > 1 ? ` ×${it.quantity}` : ""}
                          </div>
                          <div
                            className={`text-xs mt-0.5 ${
                              isPicked
                                ? "text-white/80"
                                : "text-[var(--color-muted)]"
                            }`}
                          >
                            {it.assigned_to ? `For ${it.assigned_to} · ` : ""}
                            {it.is_shared ? "Shared · " : ""}
                            {otherClaimers.length === 0
                              ? "No one else yet"
                              : `Also claimed by ${otherClaimers
                                  .map((c) => c.name ?? "someone")
                                  .slice(0, 3)
                                  .join(", ")}${
                                  otherClaimers.length > 3
                                    ? ` +${otherClaimers.length - 3}`
                                    : ""
                                }`}
                          </div>
                        </div>
                        <span className="font-mono">
                          {formatCents(it.price_cents * it.quantity)}
                        </span>
                      </div>
                    </button>
                    {isPicked ? (
                      <div className="px-3 pb-3 -mt-1">
                        <div
                          className="flex gap-1 p-1 rounded-[var(--radius-pill)] bg-white/15 text-xs"
                          role="radiogroup"
                          aria-label="Your share"
                        >
                          {([100, 75, 50, 25] as SharePercent[]).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPercent(it.id, p)}
                              className={`flex-1 px-2 py-1.5 rounded-[var(--radius-pill)] transition-colors ${
                                pct === p
                                  ? "bg-white text-[var(--color-accent)]"
                                  : "text-white"
                              }`}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="mt-5">
          <label className="block">
            <span className="text-sm text-[var(--color-ink)]">
              I want to pay
            </span>
            <div className="mt-1 flex items-center px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus-within:border-[var(--color-accent)]">
              <span className="text-[var(--color-muted)] font-mono text-lg">
                $
              </span>
              <input
                inputMode="decimal"
                autoFocus
                value={centsToDollarString(customCents)}
                onChange={(e) => setCustomCents(dollarsToCents(e.target.value))}
                placeholder="0.00"
                className="flex-1 ml-2 bg-transparent focus:outline-none font-mono text-lg"
              />
            </div>
          </label>
          <p className="text-xs text-[var(--color-muted)] mt-3">
            Use this for partial payments or when items don&apos;t map cleanly
            — e.g. &ldquo;here&apos;s $20 toward gas.&rdquo;
          </p>
        </div>
      )}

      {error ? (
        <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>
      ) : null}

      <div className="fixed bottom-0 inset-x-0 px-6 pt-3 pb-6 bg-[var(--color-bg)] border-t border-[var(--color-divider)]">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-[var(--color-muted)]">You owe</span>
            <span className="font-mono font-display text-2xl text-[var(--color-ink)]">
              {formatCents(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={
              submitting ||
              !name.trim() ||
              (mode === "items" && picked.size === 0) ||
              (mode === "custom" && customCents <= 0)
            }
            className="tap w-full mt-3 px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
          >
            {submitting ? "Saving…" : `Done — pay ${bill.payer.display_name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
