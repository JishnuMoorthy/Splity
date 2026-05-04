"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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
  if (!user) redirect("/auth");

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
      phone: user.phone ?? null,
      email: user.email ?? null,
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

const UpdateBillSchema = z.object({
  bill_id: z.string().uuid(),
  restaurant_name: z.string().nullable(),
  tax_cents: z.number().int().nonnegative(),
  tip_cents: z.number().int().nonnegative(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        price_cents: z.number().int().nonnegative(),
        quantity: z.number().int().positive(),
        is_shared: z.boolean(),
        assigned_to: z.string().nullable().optional(),
      })
    )
    .min(1),
});

export async function updateBillAction(payloadJson: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  let parsed: z.infer<typeof UpdateBillSchema>;
  try {
    parsed = UpdateBillSchema.parse(JSON.parse(payloadJson));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid update data" };
  }

  const { data: payer } = await supabase
    .from("payers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!payer) return { error: "Payer profile missing." };

  const { data: bill } = await supabase
    .from("bills")
    .select("id, payer_id, short_id")
    .eq("id", parsed.bill_id)
    .maybeSingle();
  if (!bill) return { error: "Bill not found." };
  if (bill.payer_id !== payer.id) return { error: "Not your bill." };

  // Check for non-self claims — these would orphan if we replace items.
  const { data: claims } = await supabase
    .from("claims")
    .select("id, is_payer_self")
    .eq("bill_id", bill.id);
  const externalClaims = (claims ?? []).filter((c) => !c.is_payer_self);
  if (externalClaims.length > 0) {
    return {
      error:
        "This bill already has claims from people you shared it with. Delete those claims first or create a new bill.",
    };
  }

  const subtotal = parsed.items.reduce(
    (s, it) => s + it.price_cents * it.quantity,
    0
  );
  const total = subtotal + parsed.tax_cents + parsed.tip_cents;

  const { error: billErr } = await supabase
    .from("bills")
    .update({
      restaurant_name: parsed.restaurant_name,
      subtotal_cents: subtotal,
      tax_cents: parsed.tax_cents,
      tip_cents: parsed.tip_cents,
      total_cents: total,
    })
    .eq("id", bill.id);
  if (billErr) return { error: billErr.message };

  // Replace bill_items. Cascade deletes any payer-self claim_items.
  const { error: delErr } = await supabase
    .from("bill_items")
    .delete()
    .eq("bill_id", bill.id);
  if (delErr) return { error: delErr.message };

  const { error: insErr } = await supabase.from("bill_items").insert(
    parsed.items.map((it, idx) => ({
      bill_id: bill.id,
      name: it.name,
      price_cents: it.price_cents,
      quantity: it.quantity,
      is_shared: it.is_shared,
      assigned_to: it.assigned_to ?? null,
      position: idx,
    }))
  );
  if (insErr) return { error: insErr.message };

  // Drop any payer-self claims that lost their items.
  await supabase
    .from("claims")
    .delete()
    .eq("bill_id", bill.id)
    .eq("is_payer_self", true);

  revalidatePath("/me");
  revalidatePath(`/me/b/${bill.short_id}`);
  revalidatePath(`/me/b/${bill.short_id}/edit`);
  revalidatePath(`/b/${bill.short_id}`);

  return { ok: true, short_id: bill.short_id };
}
