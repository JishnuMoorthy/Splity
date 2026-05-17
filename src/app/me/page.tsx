import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { signOutAction } from "./actions";
import { BillsList } from "./BillsList";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: payer } = await supabase
    .from("payers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!payer) redirect("/me/payment-methods?first=1");

  const { data: billsRaw } = await supabase
    .from("bills")
    .select(
      "id, short_id, restaurant_name, total_cents, currency, created_at, status, receipt_path"
    )
    .eq("payer_id", payer.id)
    .order("created_at", { ascending: false });

  const billIds = (billsRaw ?? []).map((b) => b.id);
  const claimedByBill = new Map<string, { claimed: number; confirmed: number }>();
  if (billIds.length > 0) {
    const { data: claims } = await supabase
      .from("claims")
      .select("bill_id, total_cents, payer_confirmed_at, is_payer_self")
      .in("bill_id", billIds);
    for (const c of claims ?? []) {
      const bucket = claimedByBill.get(c.bill_id) ?? { claimed: 0, confirmed: 0 };
      bucket.claimed += c.total_cents;
      if (c.payer_confirmed_at || c.is_payer_self) bucket.confirmed += c.total_cents;
      claimedByBill.set(c.bill_id, bucket);
    }
  }

  const bills = (billsRaw ?? []).map((b) => {
    const totals = claimedByBill.get(b.id) ?? { claimed: 0, confirmed: 0 };
    return {
      ...b,
      claimed_cents: totals.claimed,
      confirmed_cents: totals.confirmed,
    };
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <AppShell title="Your bills">
      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">
          Hi, <span className="text-[var(--color-ink)]">{payer.display_name}</span>
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="tap text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)] underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>

      <Link
        href="/new"
        className="tap mt-6 block text-center px-6 py-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium shadow-[var(--shadow-soft)]"
      >
        + Split a new receipt
      </Link>

      <Link
        href="/me/payment-methods"
        className="tap mt-3 block text-center px-6 py-3 rounded-[var(--radius-pill)] text-sm text-[var(--color-ink)] hover:bg-[var(--color-divider)]"
      >
        Edit payment methods
      </Link>

      <div className="mt-10">
        <BillsList bills={bills} appUrl={appUrl} />
      </div>
    </AppShell>
  );
}
