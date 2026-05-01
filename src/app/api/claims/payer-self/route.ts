import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Payer-self claims: the bill creator marks items they're personally
// covering. These count toward "fully covered" but no payee owes anything.
// Auth: must be signed in AND be the bill's payer.
const Schema = z.object({
  short_id: z.string().min(3).max(20),
  item_ids: z.array(z.string().uuid()).max(200),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parse = Schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { short_id, item_ids } = parse.data;

  const ssr = await createClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const sb = createServiceClient();

  const { data: bill } = await sb
    .from("bills")
    .select(
      "id, payer:payers!inner(user_id), items:bill_items(id, price_cents, quantity)"
    )
    .eq("short_id", short_id)
    .eq("status", "active")
    .maybeSingle();

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const billRow = bill as unknown as {
    id: string;
    payer: { user_id: string };
    items: Array<{ id: string; price_cents: number; quantity: number }>;
  };

  if (billRow.payer.user_id !== user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const itemMap = new Map(billRow.items.map((it) => [it.id, it]));
  const sessionId = `payer-self:${user.id}`;

  // Find existing payer-self claim for this bill (one per payer per bill).
  const { data: existing } = await sb
    .from("claims")
    .select("id")
    .eq("bill_id", billRow.id)
    .eq("is_payer_self", true)
    .maybeSingle();

  let total = 0;
  const rows: Array<{
    item_id: string;
    units: number;
    share_fraction: number;
    share_percent: number;
  }> = [];
  for (const id of item_ids) {
    const it = itemMap.get(id);
    if (!it) continue;
    total += it.price_cents * it.quantity;
    rows.push({
      item_id: id,
      units: it.quantity,
      share_fraction: 1,
      share_percent: 100,
    });
  }

  let claimId: string;
  if (existing) {
    claimId = (existing as { id: string }).id;
    const { error: updErr } = await sb
      .from("claims")
      .update({ total_cents: total })
      .eq("id", claimId);
    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    await sb.from("claim_items").delete().eq("claim_id", claimId);
  } else {
    const { data: created, error: insErr } = await sb
      .from("claims")
      .insert({
        bill_id: billRow.id,
        claimer_session_id: sessionId,
        claimer_name: null,
        total_cents: total,
        is_payer_self: true,
      })
      .select("id")
      .single();
    if (insErr || !created) {
      return NextResponse.json(
        { error: insErr?.message ?? "Failed" },
        { status: 500 }
      );
    }
    claimId = created.id;
  }

  if (rows.length > 0) {
    const { error: ciErr } = await sb.from("claim_items").insert(
      rows.map((r) => ({
        claim_id: claimId,
        item_id: r.item_id,
        units: r.units,
        share_fraction: r.share_fraction,
        share_percent: r.share_percent,
      }))
    );
    if (ciErr) {
      const oversold = /oversold/i.test(ciErr.message);
      return NextResponse.json(
        {
          error: oversold
            ? "Some of those items are already claimed by payees. Refresh first."
            : ciErr.message,
        },
        { status: oversold ? 409 : 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, total_cents: total });
}
