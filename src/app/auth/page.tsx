"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { AppShell } from "@/components/AppShell";

export default function AuthPage() {
  return (
    <Suspense fallback={<AppShell back="/" title="Sign in"><div /></AppShell>}>
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const e = searchParams.get("error");
    if (e) setError(e);
  }, [searchParams]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${appUrl}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AppShell back="/" title="Sign in">
      <div className="mt-8 max-w-sm">
        {sent ? (
          <div className="reveal space-y-4">
            <div className="font-display text-2xl text-[var(--color-ink)]">
              Check your email
            </div>
            <p className="text-[var(--color-muted)]">
              We sent a magic sign-in link to{" "}
              <span className="font-mono text-[var(--color-ink)]">{email}</span>
              . Tap the link from your phone to continue.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="tap text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="reveal space-y-5">
            <p className="text-[var(--color-muted)]">
              We&apos;ll email you a one-tap sign-in link. No password.
            </p>
            <label className="block">
              <span className="text-sm text-[var(--color-ink)]">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            {error ? (
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="tap w-full px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
