import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getPublicBill } from "@/lib/public-bill";
import { createClient } from "@/lib/supabase/server";
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

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const isPayer = !!user && user.id === bill.payer_user_id;

  return (
    <AppShell>
      <ClaimFlow bill={bill} isPayer={isPayer} />
    </AppShell>
  );
}
