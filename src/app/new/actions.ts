"use server";

import { createClient } from "@/lib/supabase/server";
import { generateShortId } from "@/lib/short-id";
import { ParsedReceiptSchema } from "@/lib/ocr";
import { z } from "zod";

const CreateBillSchema = z.object({
  restaurant_name: z.string().nullable(),
  receipt_path: z.string().nullable().optional(),
  subtotal_cents: z.number().int().nonnegative(),
  tax_cents: z.number().int().nonnegative(),
  tip_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      name: z.string().min(1),
      price_cents: z.number().int().nonnegative(),
      quantity: z.number().int().positive(),
      is_shared: z.boolean(),
      assigned_to: z.string().nullable().optional(),
    })
  ).min(1),
});

export async function createBillAction(payloadJson: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in. Refresh and sign in again." };

  const { data: payer, error: payerErr } = await supabase
    .from("payers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (payerErr) return { error: `Payer lookup failed: ${payerErr.message}` };
  if (!payer) return { error: "Set up payment methods first.", redirect: "/me/payment-methods?first=1" };

  let parsed: z.infer<typeof CreateBillSchema>;
  try {
    parsed = CreateBillSchema.parse(JSON.parse(payloadJson));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid bill data" };
  }

  // Retry on rare short_id collision
  let short_id = "";
  for (let i = 0; i < 5; i++) {
    short_id = generateShortId();
    const { data: existing } = await supabase
      .from("bills")
      .select("id")
      .eq("short_id", short_id)
      .maybeSingle();
    if (!existing) break;
  }

  const { data: bill, error: billErr } = await supabase
    .from("bills")
    .insert({
      short_id,
      payer_id: payer.id,
      restaurant_name: parsed.restaurant_name,
      receipt_path: parsed.receipt_path ?? null,
      subtotal_cents: parsed.subtotal_cents,
      tax_cents: parsed.tax_cents,
      tip_cents: parsed.tip_cents,
      total_cents: parsed.total_cents,
    })
    .select("id, short_id")
    .single();

  if (billErr || !bill) {
    return { error: billErr?.message ?? "Failed to create bill" };
  }

  const { error: itemsErr } = await supabase.from("bill_items").insert(
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

  if (itemsErr) {
    await supabase.from("bills").delete().eq("id", bill.id);
    return { error: itemsErr.message };
  }

  return { ok: true, short_id: bill.short_id };
}

// Re-export for type usage in client
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
