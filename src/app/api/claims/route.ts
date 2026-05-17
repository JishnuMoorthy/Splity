import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateClaimerTotal, type Currency } from "@/lib/money";
import { sendPayerNudge } from "@/lib/email";

export const runtime = "nodejs";

// `units` is how many units of bill_items.quantity the claimer is taking.
// For qty=1 items, units in {0.25, 0.5, 0.75, 1.0} maps to the % picker.
// For qty>1 items, units is the integer count the claimer says they had.
const ClaimSchema = z
  .object({
    short_id: z.string().min(3).max(20),
    claimer_session_id: z.string().min(8).max(128),
    claimer_name: z.string().min(1).max(60),
    selections: z
      .array(
        z.object({
          item_id: z.string().uuid(),
          units: z.number().positive().max(10000),
        })
      )
      .max(200)
      .default([]),
    custom_amount_cents: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (v) => (v.custom_amount_cents ?? 0) > 0 || v.selections.length > 0,
    { message: "Pick at least one item or enter a custom amount" }
  );

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parse = ClaimSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: parse.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const {
    short_id,
    claimer_session_id,
    claimer_name,
    selections,
    custom_amount_cents,
  } = parse.data;

  const sb = createServiceClient();

  // Look up bill + items
  const { data: bill } = await sb
    .from("bills")
    .select(
      "id, subtotal_cents, tax_cents, tip_cents, items:bill_items(id, price_cents, quantity, is_shared)"
    )
    .eq("short_id", short_id)
    .eq("status", "active")
    .maybeSingle();

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const billRow = bill as unknown as {
    id: string;
    subtotal_cents: number;
    tax_cents: number;
    tip_cents: number;
    items: Array<{
      id: string;
      price_cents: number;
      quantity: number;
      is_shared: boolean;
    }>;
  };

  const itemMap = new Map(billRow.items.map((it) => [it.id, it]));

  // Pull existing claims for shared-item denominators
  const { data: existingClaims } = await sb
    .from("claims")
    .select("id, claimer_session_id, claim_items(item_id)")
    .eq("bill_id", billRow.id);

  type ECRow = {
    id: string;
    claimer_session_id: string;
    claim_items: Array<{ item_id: string }>;
  };
  const existing = (existingClaims ?? []) as unknown as ECRow[];

  const sharedClaimerCount = new Map<string, Set<string>>();
  for (const c of existing) {
    if (c.claimer_session_id === claimer_session_id) continue; // exclude self
    for (const ci of c.claim_items) {
      const set = sharedClaimerCount.get(ci.item_id) ?? new Set();
      set.add(c.claimer_session_id);
      sharedClaimerCount.set(ci.item_id, set);
    }
  }

  // Compute this claimer's subtotal + share fractions
  let claimerSubtotal = 0;
  const claimItemsRows: Array<{
    item_id: string;
    units: number;
    share_fraction: number;
    share_percent: number;
  }> = [];

  const seen = new Set<string>();
  for (const sel of selections) {
    if (seen.has(sel.item_id)) continue;
    seen.add(sel.item_id);
    const item = itemMap.get(sel.item_id);
    if (!item) continue;

    // Clamp: never claim more units than the line has.
    const units = Math.min(sel.units, item.quantity);
    if (units <= 0) continue;

    // line_cents = unit_price * units; if shared, divide by claimer count.
    let lineCents = Math.round(item.price_cents * units);
    let fraction = (units / item.quantity);
    if (item.is_shared) {
      const others = sharedClaimerCount.get(item.id)?.size ?? 0;
      const denom = others + 1;
      lineCents = Math.round(lineCents / denom);
      fraction = fraction / denom;
    }
    claimerSubtotal += lineCents;

    // share_percent kept for backwards compat with anything still reading it.
    // Clamp to one of {25,50,75,100} for qty=1, else 100.
    const sharePctRaw =
      item.quantity === 1 ? Math.round(units * 100) : 100;
    const sharePct = ([25, 50, 75, 100] as const).reduce((closest, p) =>
      Math.abs(p - sharePctRaw) < Math.abs(closest - sharePctRaw) ? p : closest
    , 100 as 25 | 50 | 75 | 100);

    claimItemsRows.push({
      item_id: sel.item_id,
      units: Number(units.toFixed(2)),
      share_fraction: Number(fraction.toFixed(4)),
      share_percent: sharePct,
    });
  }

  // custom_amount_cents overrides everything: the claimer pays exactly that.
  // No tax/tip proration — the user typed the final number they want to pay.
  const total =
    custom_amount_cents && custom_amount_cents > 0
      ? custom_amount_cents
      : calculateClaimerTotal(
          claimerSubtotal,
          billRow.subtotal_cents,
          billRow.tax_cents,
          billRow.tip_cents
        );

  // Upsert the claim (one per session per bill)
  const existingSelf = existing.find(
    (c) => c.claimer_session_id === claimer_session_id
  );
  let claimId: string;
  if (existingSelf) {
    claimId = existingSelf.id;
    const { error: updErr } = await sb
      .from("claims")
      .update({
        claimer_name,
        total_cents: total,
        custom_amount_cents: custom_amount_cents ?? null,
      })
      .eq("id", claimId);
    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    await sb.from("claim_items").delete().eq("claim_id", claimId);
  } else {
    const { data: created, error: insErr } = await sb
      .from("claims")
      .insert({
        bill_id: billRow.id,
        claimer_session_id,
        claimer_name,
        total_cents: total,
        custom_amount_cents: custom_amount_cents ?? null,
      })
      .select("id")
      .single();
    if (insErr || !created) {
      return NextResponse.json(
        { error: insErr?.message ?? "Failed to claim" },
        { status: 500 }
      );
    }
    claimId = created.id;
  }

  if (claimItemsRows.length > 0) {
    const { error: ciErr } = await sb.from("claim_items").insert(
      claimItemsRows.map((r) => ({
        claim_id: claimId,
        item_id: r.item_id,
        units: r.units,
        share_fraction: r.share_fraction,
        share_percent: r.share_percent,
      }))
    );
    if (ciErr) {
      // The check_units_not_oversold trigger fires when two payees race for
      // the last units on a multi-quantity line. Surface a friendly retry
      // message instead of the raw "oversold" exception text.
      const oversold = /oversold/i.test(ciErr.message);
      return NextResponse.json(
        {
          error: oversold
            ? "Someone else just claimed those units. Refresh and pick again."
            : ciErr.message,
        },
        { status: oversold ? 409 : 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, claim_id: claimId, total_cents: total });
}

const PaidSchema = z.object({
  claim_id: z.string().uuid(),
  claimer_session_id: z.string().min(8).max(128),
  payment_method: z.enum(["venmo", "zelle", "cashapp", "other"]),
  paid: z.boolean(),
});

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parse = PaidSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const sb = createServiceClient();
  // Pull enough context to (a) authorize the update and (b) compose the
  // payer-nudge email if paid_at flips from null -> set.
  const { data: claimRaw } = await sb
    .from("claims")
    .select(
      `
      id, claimer_session_id, claimer_name, total_cents, paid_at, is_payer_self,
      bill:bills (
        short_id, restaurant_name, currency,
        payer:payers (display_name, email)
      )
      `
    )
    .eq("id", parse.data.claim_id)
    .maybeSingle();
  if (!claimRaw || claimRaw.claimer_session_id !== parse.data.claimer_session_id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const claim = claimRaw as unknown as {
    id: string;
    claimer_session_id: string;
    claimer_name: string | null;
    total_cents: number;
    paid_at: string | null;
    is_payer_self: boolean;
    bill: {
      short_id: string;
      restaurant_name: string | null;
      currency: Currency | null;
      payer: { display_name: string; email: string | null };
    };
  };

  const wasUnpaid = !claim.paid_at;
  const { error } = await sb
    .from("claims")
    .update({
      payment_method: parse.data.payment_method,
      paid_at: parse.data.paid ? new Date().toISOString() : null,
    })
    .eq("id", parse.data.claim_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: send a payer nudge only on the unpaid->paid transition,
  // and never for the payer's own self-claim. Failures are logged, not
  // surfaced to the payee — they shouldn't block the UI.
  if (
    parse.data.paid &&
    wasUnpaid &&
    !claim.is_payer_self &&
    claim.bill.payer.email
  ) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    void sendPayerNudge({
      to: claim.bill.payer.email,
      payerName: claim.bill.payer.display_name,
      claimerName: claim.claimer_name ?? "Someone",
      amountCents: claim.total_cents,
      currency: claim.bill.currency ?? "USD",
      method: parse.data.payment_method,
      restaurantName: claim.bill.restaurant_name,
      reviewUrl: `${appUrl}/me/b/${claim.bill.short_id}`,
    });
  }

  return NextResponse.json({ ok: true });
}
