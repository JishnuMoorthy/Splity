"use client";

import { useEffect, useState } from "react";
import { formatCents } from "@/lib/money";
// PayScreen reads currency from bill.payer.country indirectly via bill.currency.
import {
  venmoUrl,
  cashAppUrl,
  upiUrl,
  gpayUrl,
  paytmUrl,
} from "@/lib/payment-links";
import type { PublicBill } from "@/lib/types";

export function PayScreen({
  bill,
  amountCents,
  claimId,
  initialPaidAt,
  initialConfirmedAt,
}: {
  bill: PublicBill;
  amountCents: number;
  claimId: string | null;
  initialPaidAt: string | null;
  initialConfirmedAt: string | null;
}) {
  const [sessionId, setSessionId] = useState("");
  const [paid, setPaid] = useState(!!initialPaidAt);
  const confirmed = !!initialConfirmedAt;
  const [zelleCopied, setZelleCopied] = useState(false);
  const currency = bill.currency;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessionId(localStorage.getItem("splity-session-id") ?? "");
  }, []);

  const note = `${bill.restaurant_name ?? "Splity"} (via Splity)`;

  // UPI / PayTM both ride the same UPI rail; the API enum only stores
  // venmo/zelle/cashapp/other so they share the "other" bucket server-side.
  async function markPaid(
    method: "venmo" | "zelle" | "cashapp" | "upi" | "paytm"
  ) {
    setPaid(true);
    if (!claimId || !sessionId) return;
    const apiMethod =
      method === "upi" || method === "paytm" ? "other" : method;
    await fetch("/api/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim_id: claimId,
        claimer_session_id: sessionId,
        payment_method: apiMethod,
        paid: true,
      }),
    }).catch(() => {});
  }

  async function copyZelle() {
    const target = bill.payer.zelle_contact;
    if (!target) return;
    await navigator.clipboard.writeText(target).catch(() => {});
    setZelleCopied(true);
    setTimeout(() => setZelleCopied(false), 2000);
  }

  return (
    <div className="reveal mt-2">
      <div className="text-[var(--color-muted)] text-sm">You owe</div>
      <div className="font-display text-5xl mt-1 text-[var(--color-ink)] font-mono">
        {formatCents(amountCents, currency)}
      </div>
      <div className="text-[var(--color-muted)] mt-2">
        to {bill.payer.display_name}
        {bill.restaurant_name ? ` for ${bill.restaurant_name}` : ""}
      </div>

      <div className="mt-10 space-y-3">
        {bill.payer.country === "IN" && bill.payer.upi_id ? (
          <>
            <a
              href={gpayUrl({
                vpa: bill.payer.upi_id,
                payeeName: bill.payer.display_name,
                amountCents,
                note,
              })}
              onClick={() => markPaid("upi")}
              className="tap flex items-center justify-between px-5 py-4 rounded-[var(--radius-md)] bg-[#1A73E8] text-white font-medium shadow-[var(--shadow-soft)]"
            >
              <span>Pay on Google Pay</span>
              <span className="font-mono">{formatCents(amountCents, currency)}</span>
            </a>
            <a
              href={upiUrl({
                vpa: bill.payer.upi_id,
                payeeName: bill.payer.display_name,
                amountCents,
                note,
              })}
              onClick={() => markPaid("upi")}
              className="tap flex items-center justify-between px-5 py-4 rounded-[var(--radius-md)] bg-[#0F9D58] text-white font-medium shadow-[var(--shadow-soft)]"
            >
              <span className="text-left">
                <div>Any UPI app</div>
                <div className="text-xs opacity-80 mt-0.5 font-mono">
                  PhonePe, BHIM, Amazon Pay, etc.
                </div>
              </span>
              <span className="font-mono">{formatCents(amountCents, currency)}</span>
            </a>
          </>
        ) : null}

        {bill.payer.country === "IN" && bill.payer.paytm_phone ? (
          <a
            href={paytmUrl({
              phone: bill.payer.paytm_phone,
              payeeName: bill.payer.display_name,
              amountCents,
              note,
            })}
            onClick={() => markPaid("paytm")}
            className="tap flex items-center justify-between px-5 py-4 rounded-[var(--radius-md)] bg-[#00BAF2] text-white font-medium shadow-[var(--shadow-soft)]"
          >
            <span>Pay on PayTM</span>
            <span className="font-mono">{formatCents(amountCents, currency)}</span>
          </a>
        ) : null}

        {bill.payer.country !== "IN" && bill.payer.venmo_handle ? (
          <a
            href={venmoUrl({
              handle: bill.payer.venmo_handle,
              amountCents,
              note,
            })}
            onClick={() => markPaid("venmo")}
            className="tap flex items-center justify-between px-5 py-4 rounded-[var(--radius-md)] bg-[#3D95CE] text-white font-medium shadow-[var(--shadow-soft)]"
          >
            <span>Pay on Venmo</span>
            <span className="font-mono">{formatCents(amountCents, currency)}</span>
          </a>
        ) : null}

        {bill.payer.country !== "IN" && bill.payer.cashapp_handle ? (
          <a
            href={cashAppUrl({
              handle: bill.payer.cashapp_handle,
              amountCents,
            })}
            onClick={() => markPaid("cashapp")}
            className="tap flex items-center justify-between px-5 py-4 rounded-[var(--radius-md)] bg-[#00D54B] text-white font-medium shadow-[var(--shadow-soft)]"
          >
            <span>Pay on Cash App</span>
            <span className="font-mono">{formatCents(amountCents, currency)}</span>
          </a>
        ) : null}

        {bill.payer.country !== "IN" && bill.payer.zelle_contact ? (
          <button
            type="button"
            onClick={() => {
              copyZelle();
              markPaid("zelle");
            }}
            className="tap w-full flex items-center justify-between px-5 py-4 rounded-[var(--radius-md)] bg-[#6D1ED4] text-white font-medium shadow-[var(--shadow-soft)]"
          >
            <span className="text-left">
              <div>Pay on Zelle</div>
              <div className="text-xs opacity-80 mt-0.5 font-mono">
                {zelleCopied
                  ? "Copied!"
                  : `Tap to copy: ${bill.payer.zelle_contact}`}
              </div>
            </span>
            <span className="font-mono">{formatCents(amountCents, currency)}</span>
          </button>
        ) : null}
      </div>

      {confirmed ? (
        <p className="mt-6 text-center text-sm text-[var(--color-success)]">
          ✓ {bill.payer.display_name} confirmed receipt. You&apos;re all set.
        </p>
      ) : paid ? (
        <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
          Marked as paid — awaiting confirmation from{" "}
          {bill.payer.display_name}.
        </p>
      ) : (
        <p className="mt-8 text-center text-xs text-[var(--color-muted)]">
          Already sent it? Tap any button above to mark as paid.
        </p>
      )}
    </div>
  );
}
