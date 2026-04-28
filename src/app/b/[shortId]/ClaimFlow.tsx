"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateClaimerTotal, formatCents } from "@/lib/money";
import type { PublicBill } from "@/lib/types";

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
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    const stored = localStorage.getItem("splity-name");
    if (stored) setName(stored);
  }, []);

  // Mark items already claimed by THIS session as picked, on load
  useEffect(() => {
    if (!sessionId) return;
    const mine = new Set<string>();
    for (const it of bill.items) {
      const got = it.claimed_by.some((c) =>
        // We don't know our own session_id from server; use name match as a hint.
        // (Anonymous browsing — best-effort restoration.)
        c.name && c.name === name
      );
      if (got) mine.add(it.id);
    }
    if (mine.size > 0) setPicked(mine);
  }, [sessionId, bill, name]);

  const subtotal = useMemo(() => {
    let s = 0;
    for (const it of bill.items) {
      if (!picked.has(it.id)) continue;
      const lineCents = it.price_cents * it.quantity;
      if (it.is_shared) {
        const others = it.claimed_by.filter((c) => c.name !== name).length;
        const denom = others + 1;
        s += Math.round(lineCents / denom);
      } else {
        s += lineCents;
      }
    }
    return s;
  }, [picked, bill, name]);

  const total = calculateClaimerTotal(
    subtotal,
    bill.subtotal_cents,
    bill.tax_cents,
    bill.tip_cents
  );

  const hasShared = bill.items.some(
    (it) => it.is_shared && picked.has(it.id)
  );

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Tell us your name first.");
      return;
    }
    if (picked.size === 0) {
      setError("Tap the items you ate.");
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
        selections: [...picked].map((id) => ({ item_id: id })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
      return;
    }
    const { claim_id } = await res.json();
    router.push(
      `/b/${bill.short_id}/pay?cid=${claim_id}&amt=${total}`
    );
  }

  return (
    <div className="reveal pb-32">
      <div className="mt-2">
        <div className="font-display text-2xl text-[var(--color-ink)]">
          {bill.payer.display_name} paid{" "}
          <span className="font-mono">
            {formatCents(bill.total_cents)}
          </span>
        </div>
        {bill.restaurant_name ? (
          <div className="text-[var(--color-muted)] mt-0.5">
            at {bill.restaurant_name}
          </div>
        ) : null}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="mt-6 w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <p className="text-xs text-[var(--color-muted)] mt-4">
        Tap what you ate. Shared items split evenly with everyone who picks
        them.
      </p>

      <ul className="mt-3 space-y-2">
        {bill.items.map((it) => {
          const isPicked = picked.has(it.id);
          const otherClaimers = it.claimed_by.filter((c) => c.name !== name);
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => toggle(it.id)}
                className={`tap w-full text-left p-3 rounded-[var(--radius-md)] border transition-colors ${
                  isPicked
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                    : "bg-[var(--color-surface)] border-[var(--color-divider)] text-[var(--color-ink)]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {it.name}
                      {it.quantity > 1 ? ` ×${it.quantity}` : ""}
                    </div>
                    <div
                      className={`text-xs mt-0.5 ${
                        isPicked ? "text-white/80" : "text-[var(--color-muted)]"
                      }`}
                    >
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
            </li>
          );
        })}
      </ul>

      {hasShared ? (
        <p className="text-xs text-[var(--color-muted)] mt-4">
          Total may update as others claim shared items.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>
      ) : null}

      <div className="fixed bottom-0 inset-x-0 px-6 pt-3 pb-6 bg-[var(--color-bg)] border-t border-[var(--color-divider)]">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-[var(--color-muted)]">
              You owe
            </span>
            <span className="font-mono font-display text-2xl text-[var(--color-ink)]">
              {formatCents(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || picked.size === 0 || !name.trim()}
            className="tap w-full mt-3 px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Done — pay " + bill.payer.display_name}
          </button>
        </div>
      </div>
    </div>
  );
}
