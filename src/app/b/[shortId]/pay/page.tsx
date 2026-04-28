import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getPublicBill } from "@/lib/public-bill";
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

  return (
    <AppShell back={`/b/${shortId}`}>
      <PayScreen
        bill={bill}
        amountCents={amountCents}
        claimId={claimId}
      />
    </AppShell>
  );
}
