import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/phone");

  const { data: payer } = await supabase
    .from("payers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!payer) redirect("/me/payment-methods?first=1");

  const { data: bills } = await supabase
    .from("bills")
    .select("id, short_id, restaurant_name, total_cents, created_at, status")
    .eq("payer_id", payer.id)
    .order("created_at", { ascending: false });

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

      <div className="mt-10 space-y-3">
        {!bills || bills.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] text-center py-8">
            No bills yet. Upload a receipt to get started.
          </p>
        ) : (
          bills.map((b) => (
            <Link
              key={b.id}
              href={`/b/${b.short_id}`}
              className="tap block p-4 rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {b.restaurant_name ?? "Receipt"}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    {new Date(b.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · /{b.short_id}
                  </div>
                </div>
                <MoneyDisplay
                  cents={b.total_cents}
                  className="text-[var(--color-ink)]"
                />
              </div>
              {appUrl ? (
                <div className="mt-2 text-xs text-[var(--color-muted)] truncate">
                  {appUrl}/b/{b.short_id}
                </div>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
