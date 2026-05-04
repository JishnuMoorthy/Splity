"use client";

import { useMemo, useState } from "react";
import { BillCard } from "./BillCard";

export type BillRow = {
  id: string;
  short_id: string;
  restaurant_name: string | null;
  total_cents: number;
  created_at: string;
  receipt_path: string | null;
  claimed_cents: number;
  confirmed_cents: number;
};

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "name_asc";

const SORT_LABELS: Record<SortKey, string> = {
  date_desc: "Newest",
  date_asc: "Oldest",
  amount_desc: "Highest amount",
  amount_asc: "Lowest amount",
  name_asc: "Name (A–Z)",
};

export function BillsList({
  bills,
  appUrl,
}: {
  bills: BillRow[];
  appUrl: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date_desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? bills.filter((b) => {
          const name = (b.restaurant_name ?? "").toLowerCase();
          return name.includes(q) || b.short_id.toLowerCase().includes(q);
        })
      : bills.slice();

    list.sort((a, b) => {
      switch (sort) {
        case "date_desc":
          return b.created_at.localeCompare(a.created_at);
        case "date_asc":
          return a.created_at.localeCompare(b.created_at);
        case "amount_desc":
          return b.total_cents - a.total_cents;
        case "amount_asc":
          return a.total_cents - b.total_cents;
        case "name_asc":
          return (a.restaurant_name ?? "Receipt").localeCompare(
            b.restaurant_name ?? "Receipt"
          );
      }
    });

    return list;
  }, [bills, query, sort]);

  if (bills.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)] text-center py-8">
        No bills yet. Upload a receipt to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by restaurant or link"
          aria-label="Search bills"
          className="flex-1 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort bills"
          className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] text-center py-6">
          No bills match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <BillCard
              key={b.id}
              bill={{ ...b, has_receipt: !!b.receipt_path }}
              appUrl={appUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
