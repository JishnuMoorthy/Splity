import { createServiceClient } from "@/lib/supabase/server";
import type { PublicBill } from "@/lib/types";

// Service-role read of a public bill by short_id. Strips sensitive fields.
export async function getPublicBill(
  shortId: string
): Promise<PublicBill | null> {
  const sb = createServiceClient();

  const { data: bill, error } = await sb
    .from("bills")
    .select(
      `
      id, short_id, restaurant_name, subtotal_cents, tax_cents, tip_cents, total_cents, receipt_path,
      payer:payers (display_name, venmo_handle, zelle_contact, cashapp_handle),
      items:bill_items (id, name, price_cents, quantity, is_shared, position, assigned_to)
      `
    )
    .eq("short_id", shortId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !bill) return null;

  const billRow = bill as unknown as {
    id: string;
    short_id: string;
    restaurant_name: string | null;
    subtotal_cents: number;
    tax_cents: number;
    tip_cents: number;
    total_cents: number;
    receipt_path: string | null;
    payer: {
      display_name: string;
      venmo_handle: string | null;
      zelle_contact: string | null;
      cashapp_handle: string | null;
    };
    items: Array<{
      id: string;
      name: string;
      price_cents: number;
      quantity: number;
      is_shared: boolean;
      position: number;
      assigned_to: string | null;
    }>;
  };

  // Pull all claims with their item junctions (for "claimed by" display)
  const { data: claims } = await sb
    .from("claims")
    .select("id, claimer_name, claim_items(item_id, share_fraction)")
    .eq("bill_id", billRow.id);

  const byItem = new Map<
    string,
    Array<{ name: string | null; share_fraction: number }>
  >();
  for (const c of claims ?? []) {
    type CRow = {
      claimer_name: string | null;
      claim_items: Array<{ item_id: string; share_fraction: number }>;
    };
    const cr = c as unknown as CRow;
    for (const ci of cr.claim_items ?? []) {
      const list = byItem.get(ci.item_id) ?? [];
      list.push({
        name: cr.claimer_name,
        share_fraction: Number(ci.share_fraction),
      });
      byItem.set(ci.item_id, list);
    }
  }

  return {
    short_id: billRow.short_id,
    restaurant_name: billRow.restaurant_name,
    subtotal_cents: billRow.subtotal_cents,
    tax_cents: billRow.tax_cents,
    tip_cents: billRow.tip_cents,
    total_cents: billRow.total_cents,
    has_receipt: !!billRow.receipt_path,
    payer: billRow.payer,
    items: [...billRow.items]
      .sort((a, b) => a.position - b.position)
      .map((it) => ({
        ...it,
        claimed_by: byItem.get(it.id) ?? [],
      })),
  };
}
