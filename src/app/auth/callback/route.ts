import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link callback. Supabase appends ?code=… on email verification.
// If the code is missing, Supabase likely fell back to hash-fragment delivery —
// the landing page's AuthBootstrap will pick it up there.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorDesc =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const next = url.searchParams.get("next") ?? "/me";

  if (errorDesc) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(errorDesc)}`, url.origin)
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  // No code, no error — let the landing page handle hash-based session.
  return NextResponse.redirect(new URL("/", url.origin));
}
