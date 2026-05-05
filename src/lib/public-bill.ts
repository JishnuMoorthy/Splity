import { createServiceClient } from "@/lib/supabase/server";
import type { Country, PublicBill } from "@/lib/types";

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
      payer:payers (user_id, display_name, country, venmo_handle, zelle_contact, cashapp_handle, upi_id, paytm_phone),
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
      user_id: string;
      display_name: string;
      country: Country | null;
      venmo_handle: string | null;
      zelle_contact: string | null;
      cashapp_handle: string | null;
      upi_id: string | null;
      paytm_phone: string | null;
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
    .select(
      "id, claimer_name, total_cents, is_payer_self, claim_items(item_id, share_fraction, units)"
    )
    .eq("bill_id", billRow.id);

  type Claimer = {
    name: string | null;
    share_fraction: number;
    units: number;
    is_payer_self: boolean;
  };
  const byItem = new Map<string, Array<Claimer>>();
  let claimedTotal = 0;
  for (const c of claims ?? []) {
    type CRow = {
      claimer_name: string | null;
      total_cents: number;
      is_payer_self: boolean;
      claim_items: Array<{
        item_id: string;
        share_fraction: number;
        units: number;
      }>;
    };
    const cr = c as unknown as CRow;
    claimedTotal += cr.total_cents ?? 0;
    for (const ci of cr.claim_items ?? []) {
      const list = byItem.get(ci.item_id) ?? [];
      list.push({
        name: cr.claimer_name,
        share_fraction: Number(ci.share_fraction),
        units: Number(ci.units),
        is_payer_self: !!cr.is_payer_self,
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
    claimed_total_cents: claimedTotal,
    payer_user_id: billRow.payer.user_id,
    payer: {
      display_name: billRow.payer.display_name,
      country: billRow.payer.country ?? "US",
      venmo_handle: billRow.payer.venmo_handle,
      zelle_contact: billRow.payer.zelle_contact,
      cashapp_handle: billRow.payer.cashapp_handle,
      upi_id: billRow.payer.upi_id,
      paytm_phone: billRow.payer.paytm_phone,
    },
    items: [...billRow.items]
      .sort((a, b) => a.position - b.position)
      .map((it) => {
        const claimers = byItem.get(it.id) ?? [];
        const claimed_units = claimers.reduce((s, c) => s + c.units, 0);
        const covered_by_payer = claimers.some((c) => c.is_payer_self);
        return { ...it, claimed_units, covered_by_payer, claimed_by: claimers };
      }),
  };
}
