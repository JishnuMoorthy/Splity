import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { EditBillFlow } from "./EditFlow";

export const dynamic = "force-dynamic";

export default async function EditBillPage({
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
      "id, short_id, restaurant_name, tax_cents, tip_cents, currency, payer_id"
    )
    .eq("short_id", shortId)
    .maybeSingle();
  if (!bill || bill.payer_id !== payer.id) notFound();
  const currency =
    (bill as { currency?: string | null }).currency === "INR" ? "INR" : "USD";

  const { data: items } = await supabase
    .from("bill_items")
    .select("name, price_cents, quantity, is_shared, assigned_to, position")
    .eq("bill_id", bill.id)
    .order("position", { ascending: true });

  const { data: claims } = await supabase
    .from("claims")
    .select("id, is_payer_self")
    .eq("bill_id", bill.id);
  const externalClaimsCount = (claims ?? []).filter((c) => !c.is_payer_self).length;

  return (
    <AppShell back={`/me/b/${bill.short_id}`} title="Edit bill">
      {externalClaimsCount > 0 ? (
        <div className="reveal mt-4 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--color-ink)]">
            This bill has {externalClaimsCount} claim
            {externalClaimsCount === 1 ? "" : "s"} from people you shared it
            with. Editing items would invalidate those claims.
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-2">
            To make changes, either ask claimants to undo their claims first,
            or{" "}
            <Link href="/new" className="underline">
              create a new bill
            </Link>
            .
          </p>
        </div>
      ) : (
        <EditBillFlow
          billId={bill.id}
          shortId={bill.short_id}
          currency={currency}
          initial={{
            restaurant_name: bill.restaurant_name ?? "",
            tax_cents: bill.tax_cents,
            tip_cents: bill.tip_cents,
            items: (items ?? []).map((it) => ({
              name: it.name,
              price_cents: it.price_cents,
              quantity: it.quantity,
              is_shared: it.is_shared,
              assigned_name: it.assigned_to ?? "",
            })),
          }}
        />
      )}
    </AppShell>
  );
}
