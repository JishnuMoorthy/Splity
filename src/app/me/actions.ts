"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function upsertPayerAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/phone");

  const display_name = String(formData.get("display_name") ?? "").trim();
  const venmo_handle =
    String(formData.get("venmo_handle") ?? "").trim().replace(/^@/, "") || null;
  const zelle_contact =
    String(formData.get("zelle_contact") ?? "").trim() || null;
  const cashapp_handle =
    String(formData.get("cashapp_handle") ?? "").trim().replace(/^\$/, "") ||
    null;

  if (!display_name) {
    return { error: "Display name is required" };
  }
  if (!venmo_handle && !zelle_contact && !cashapp_handle) {
    return { error: "Add at least one payment method (Venmo, Zelle, or Cash App)" };
  }

  const { error } = await supabase.from("payers").upsert(
    {
      user_id: user.id,
      phone: user.phone ?? "",
      display_name,
      venmo_handle,
      zelle_contact,
      cashapp_handle,
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/me");
  revalidatePath("/me/payment-methods");
  return { ok: true };
}

export async function deleteBillAction(billId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("bills").delete().eq("id", billId);
  if (error) return { error: error.message };
  revalidatePath("/me");
  return { ok: true };
}
