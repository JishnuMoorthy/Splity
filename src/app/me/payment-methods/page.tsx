import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PaymentMethodsForm } from "./Form";

export const dynamic = "force-dynamic";

export default async function PaymentMethodsPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const sp = await searchParams;
  const first = sp.first === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: payer } = await supabase
    .from("payers")
    .select("display_name, venmo_handle, zelle_contact, cashapp_handle")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AppShell back={first ? undefined : "/me"} title="Payment methods">
      {first ? (
        <p className="text-sm text-[var(--color-muted)] mt-1">
          One-time setup so friends can pay you back.
        </p>
      ) : null}
      <div className="mt-6">
        <PaymentMethodsForm initial={payer ?? null} />
      </div>
    </AppShell>
  );
}
