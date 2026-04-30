"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

// Mounted on the landing page. Handles the case where Supabase put the
// session into the URL hash (#access_token=…) instead of routing through
// /auth/callback — typically when the magic-link redirect URL wasn't in
// the Supabase allowlist. The browser client auto-parses the hash via
// detectSessionInUrl=true; once a session exists we route based on whether
// a payer row already exists: returning users go to /me, new users go to
// payer setup so the sign-up step isn't skipped.
export function AuthBootstrap() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function routeFor(userId: string) {
      const { data: payer } = await supabase
        .from("payers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname);
      }
      router.replace(payer ? "/me" : "/me/payment-methods?first=1");
    }

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.user) {
        routeFor(data.session.user.id);
      }
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        routeFor(session.user.id);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
