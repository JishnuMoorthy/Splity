import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { ClaimReview } from "./ClaimReview";

export const dynamic = "force-dynamic";

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

export default async function BillReviewPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: payer } = await supabase
    .from("payers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!payer) redirect("/me/payment-methods?first=1");

  const { data: bill } = await supabase
    .from("bills")
    .select(
      "id, short_id, restaurant_name, total_cents, status, payer_id"
    )
    .eq("short_id", shortId)
    .maybeSingle();
  if (!bill || bill.payer_id !== payer.id) notFound();

  const { data: claimsData } = await supabase
    .from("claims")
    .select(
      "id, claimer_name, total_cents, payment_method, paid_at, payer_confirmed_at, is_payer_self, created_at"
    )
    .eq("bill_id", bill.id)
    .order("created_at", { ascending: false });

  const claims = (claimsData ?? []) as ClaimRow[];

  return (
    <AppShell back="/me" title={bill.restaurant_name ?? "Bill"}>
      <ClaimReview
        billTotal={bill.total_cents}
        shortId={bill.short_id}
        claims={claims}
      />
      <div className="mt-8 text-center">
        <Link
          href={`/b/${bill.short_id}`}
          className="text-sm text-[var(--color-muted)] underline-offset-4 hover:underline"
        >
          View public share page
        </Link>
      </div>
    </AppShell>
  );
}
