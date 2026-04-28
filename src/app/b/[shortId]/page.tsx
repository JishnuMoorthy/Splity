import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getPublicBill } from "@/lib/public-bill";
import { ClaimFlow } from "./ClaimFlow";

export const dynamic = "force-dynamic";

export default async function PublicBillPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const bill = await getPublicBill(shortId);
  if (!bill) notFound();

  return (
    <AppShell>
      <ClaimFlow bill={bill} />
    </AppShell>
  );
}
