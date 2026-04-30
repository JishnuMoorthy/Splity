"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { deleteBillAction } from "./actions";

export function BillCard({
  bill,
  appUrl,
}: {
  bill: {
    id: string;
    short_id: string;
    restaurant_name: string | null;
    total_cents: number;
    created_at: string;
    has_receipt?: boolean;
  };
  appUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const link = `${appUrl}/b/${bill.short_id}`;

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      // Try the native share sheet on mobile (no-op if not supported)
      if (navigator.share) {
        navigator
          .share({
            title: "Splity",
            text: `I paid for ${bill.restaurant_name ?? "us"}. Tap your items:`,
            url: link,
          })
          .catch(() => {});
      }
    } catch {
      // Clipboard unavailable; surface the link for manual copy
      window.prompt("Copy this link", link);
    }
  }

  function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this bill? This can't be undone.")) return;
    startTransition(async () => {
      const res = await deleteBillAction(bill.id);
      if (!res?.error) router.refresh();
    });
  }

  return (
    <div className="block p-4 rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <Link href={`/b/${bill.short_id}`} className="block">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium truncate">
              {bill.restaurant_name ?? "Receipt"}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">
              {new Date(bill.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              · /{bill.short_id}
            </div>
          </div>
          <MoneyDisplay
            cents={bill.total_cents}
            className="text-[var(--color-ink)]"
          />
        </div>
        {appUrl ? (
          <div className="mt-2 text-xs text-[var(--color-muted)] truncate">
            {link}
          </div>
        ) : null}
      </Link>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="tap flex-1 px-3 py-2 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white text-xs font-medium"
        >
          {copied ? "Copied!" : "Copy / share link"}
        </button>
        {bill.has_receipt ? (
          <a
            href={`/api/receipt/${bill.short_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap px-3 py-2 rounded-[var(--radius-pill)] text-xs text-[var(--color-muted)] hover:bg-[var(--color-divider)]"
          >
            Receipt
          </a>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="tap px-3 py-2 rounded-[var(--radius-pill)] text-xs text-[var(--color-error)] hover:bg-[var(--color-divider)] disabled:opacity-50"
        >
          {pending ? "…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
