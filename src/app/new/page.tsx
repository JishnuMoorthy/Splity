import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { NewBillFlow } from "./Flow";

export const dynamic = "force-dynamic";

export default async function NewBillPage() {
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

  return (
    <AppShell back="/me" title="New receipt">
      <NewBillFlow />
    </AppShell>
  );
}
