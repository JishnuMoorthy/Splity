import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Payer confirms (or unconfirms) that money arrived for a given claim.
// Auth: must be signed in AND own the bill that the claim belongs to.
const Schema = z.object({
  claim_id: z.string().uuid(),
  confirmed: z.boolean(),
});

export async function PATCH(req: Request) {
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

  const ssr = await createClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const sb = createServiceClient();

  // Walk claim → bill → payer, reject if not the auth user's bill.
  const { data: claim } = await sb
    .from("claims")
    .select("id, bill:bills!inner(payer:payers!inner(user_id))")
    .eq("id", parse.data.claim_id)
    .maybeSingle();

  const claimRow = claim as unknown as {
    id: string;
    bill: { payer: { user_id: string } };
  } | null;

  if (!claimRow) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }
  if (claimRow.bill.payer.user_id !== user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { error } = await sb
    .from("claims")
    .update({
      payer_confirmed_at: parse.data.confirmed ? new Date().toISOString() : null,
    })
    .eq("id", parse.data.claim_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
