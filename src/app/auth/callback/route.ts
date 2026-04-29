import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link callback. Supabase appends ?code=… on email verification.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/me";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/auth?error=callback", url.origin));
}
