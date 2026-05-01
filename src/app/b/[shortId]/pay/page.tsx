import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getPublicBill } from "@/lib/public-bill";
import { createServiceClient } from "@/lib/supabase/server";
import { PayScreen } from "./PayScreen";

export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ shortId: string }>;
  searchParams: Promise<{ cid?: string; amt?: string }>;
}) {
  const { shortId } = await params;
  const sp = await searchParams;
  const bill = await getPublicBill(shortId);
  if (!bill) notFound();

  const amountCents = Math.max(0, parseInt(sp.amt ?? "0") || 0);
  const claimId = sp.cid ?? null;

  // Fetch the latest paid/confirmed timestamps for this claim so the
  // PayScreen can show "awaiting confirmation" vs "confirmed".
  let initialPaidAt: string | null = null;
  let initialConfirmedAt: string | null = null;
  if (claimId) {
    const sb = createServiceClient();
    const { data: claim } = await sb
      .from("claims")
      .select("paid_at, payer_confirmed_at")
      .eq("id", claimId)
      .maybeSingle();
    if (claim) {
      initialPaidAt = (claim as { paid_at: string | null }).paid_at;
      initialConfirmedAt = (claim as { payer_confirmed_at: string | null })
        .payer_confirmed_at;
    }
  }

  return (
    <AppShell back={`/b/${shortId}`}>
      <PayScreen
        bill={bill}
        amountCents={amountCents}
        claimId={claimId}
        initialPaidAt={initialPaidAt}
        initialConfirmedAt={initialConfirmedAt}
      />
    </AppShell>
  );
}
