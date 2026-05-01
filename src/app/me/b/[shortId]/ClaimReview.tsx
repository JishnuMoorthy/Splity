"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";

type ClaimRow = {
  id: string;
  claimer_name: string | null;
  total_cents: number;
  payment_method: "venmo" | "zelle" | "cashapp" | "other" | null;
  paid_at: string | null;
  payer_confirmed_at: string | null;
  is_payer_self: boolean;
  created_at: string;
};

export function ClaimReview({
  billTotal,
  shortId,
  claims,
}: {
  billTotal: number;
  shortId: string;
  claims: ClaimRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let claimed = 0;
    let payeeMarked = 0;
    let confirmed = 0;
    for (const c of claims) {
      claimed += c.total_cents;
      if (c.paid_at || c.is_payer_self) payeeMarked += c.total_cents;
      if (c.payer_confirmed_at || c.is_payer_self) confirmed += c.total_cents;
    }
    return { claimed, payeeMarked, confirmed };
  }, [claims]);

  async function setConfirmed(claimId: string, confirmed: boolean) {
    setBusy(claimId);
    setError(null);
    const res = await fetch("/api/claims/confirm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim_id: claimId, confirmed }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't update");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="reveal mt-2">
      <div className="font-display text-2xl text-[var(--color-ink)]">
        <span className="font-mono">{formatCents(billTotal)}</span> total
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Claimed" value={totals.claimed} total={billTotal} />
        <Stat label="Payee says paid" value={totals.payeeMarked} total={billTotal} />
        <Stat label="You confirmed" value={totals.confirmed} total={billTotal} />
      </div>

      <div className="mt-2 text-xs text-[var(--color-muted)] truncate">
        Public link: /b/{shortId}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>
      ) : null}

      <ul className="mt-6 space-y-2">
        {claims.length === 0 ? (
          <li className="text-sm text-[var(--color-muted)] text-center py-8">
            No claims yet. Share the link to get started.
          </li>
        ) : null}
        {claims.map((c) => {
          const status = c.is_payer_self
            ? "self"
            : c.payer_confirmed_at
              ? "confirmed"
              : c.paid_at
                ? "awaiting"
                : "open";
          return (
            <li
              key={c.id}
              className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {c.is_payer_self
                      ? "You — covering yourself"
                      : c.claimer_name ?? "Anonymous"}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    <StatusPill status={status} method={c.payment_method} />
                  </div>
                </div>
                <span className="font-mono">{formatCents(c.total_cents)}</span>
              </div>

              {!c.is_payer_self ? (
                <div className="mt-3 flex gap-2">
                  {c.payer_confirmed_at ? (
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => setConfirmed(c.id, false)}
                      className="tap flex-1 px-3 py-2 rounded-[var(--radius-pill)] text-xs text-[var(--color-muted)] hover:bg-[var(--color-divider)] disabled:opacity-50"
                    >
                      Undo confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => setConfirmed(c.id, true)}
                      className="tap flex-1 px-3 py-2 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white text-xs font-medium disabled:opacity-50"
                    >
                      {busy === c.id ? "…" : "Confirm received"}
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface)]">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </div>
      <div className="font-mono text-sm mt-1">{formatCents(value)}</div>
      <div className="text-[10px] text-[var(--color-muted)] mt-0.5">{pct}%</div>
    </div>
  );
}

function StatusPill({
  status,
  method,
}: {
  status: "self" | "confirmed" | "awaiting" | "open";
  method: "venmo" | "zelle" | "cashapp" | "other" | null;
}) {
  if (status === "self") return <span>You're covering this</span>;
  if (status === "confirmed")
    return (
      <span className="text-[var(--color-success)]">
        ✓ Confirmed{method ? ` · ${method}` : ""}
      </span>
    );
  if (status === "awaiting")
    return <span>Payee marked paid{method ? ` · ${method}` : ""} · awaiting your confirmation</span>;
  return <span>Open — not paid yet</span>;
}
