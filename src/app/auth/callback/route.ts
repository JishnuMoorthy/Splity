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
  const next = url.searchParams.get("next");

  if (errorDesc) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(errorDesc)}`, url.origin)
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // PKCE failure (most common cause: link opened in a different browser
      // than where the email was sent). Bounce to /auth with a flag the
      // form picks up — pre-fills the email + jumps to the code step so the
      // user can paste the 6-digit code from the same email.
      const isPkce =
        /code verifier|pkce/i.test(error.message) || error.status === 400;
      const emailHint = url.searchParams.get("email") ?? "";
      const params = new URLSearchParams();
      if (isPkce) {
        params.set("link_other_browser", "1");
        if (emailHint) params.set("email", emailHint);
      } else {
        params.set("error", error.message);
      }
      return NextResponse.redirect(
        new URL(`/auth?${params.toString()}`, url.origin)
      );
    }

    if (next) {
      return NextResponse.redirect(new URL(next, url.origin));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/auth", url.origin));
    }

    const { data: payer } = await supabase
      .from("payers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.redirect(
      new URL(payer ? "/me" : "/me/payment-methods?first=1", url.origin)
    );
  }

  // No code, no error — let the landing page handle hash-based session.
  return NextResponse.redirect(new URL("/", url.origin));
}
