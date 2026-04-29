"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

// Mounted on the landing page. Handles the case where Supabase put the
// session into the URL hash (#access_token=…) instead of routing through
// /auth/callback — typically when the magic-link redirect URL wasn't in
// the Supabase allowlist. The browser client auto-parses the hash via
// detectSessionInUrl=true; once a session exists we ship the user to /me.
export function AuthBootstrap() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        // Strip any hash so the URL is clean before navigating
        if (window.location.hash) {
          history.replaceState(null, "", window.location.pathname);
        }
        router.replace("/me");
      }
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        if (window.location.hash) {
          history.replaceState(null, "", window.location.pathname);
        }
        router.replace("/me");
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
