import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Returns a short-lived signed URL for the bill's stored receipt.
// Anyone with the share link (short_id) is allowed to view — the URL is the
// access control. Receipt itself is private at the storage layer.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await ctx.params;
  const sb = createServiceClient();
  const { data: bill } = await sb
    .from("bills")
    .select("receipt_path")
    .eq("short_id", shortId)
    .eq("status", "active")
    .maybeSingle();

  if (!bill?.receipt_path) {
    return NextResponse.json({ error: "No receipt" }, { status: 404 });
  }

  const { data: signed, error } = await sb.storage
    .from("receipts")
    .createSignedUrl(bill.receipt_path, 60 * 10); // 10 minutes

  if (error || !signed) {
    return NextResponse.json(
      { error: error?.message ?? "Could not sign URL" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
