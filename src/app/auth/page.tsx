"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { AppShell } from "@/components/AppShell";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <AppShell back="/" title="Sign in">
          <div />
        </AppShell>
      }
    >
      <AuthInner />
    </Suspense>
  );
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) {
    return digits.length >= 8 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

type Mode = "phone" | "email";

function AuthInner() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("phone");
  const [step, setStep] = useState<"input" | "code">("input");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);

  useEffect(() => {
    const e = searchParams.get("error");
    if (e) setError(decodeURIComponent(e));
    // If the callback redirected here after PKCE failure (link opened in a
    // different browser), pre-fill email + jump straight to the code step.
    const otherBrowser = searchParams.get("link_other_browser");
    const emailParam = searchParams.get("email");
    if (otherBrowser && emailParam) {
      setMode("email");
      setEmail(emailParam);
      setStep("code");
      setError(
        "That link was opened in a different browser. Enter the 6-digit code from the same email instead."
      );
    }
  }, [searchParams]);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("input");
    setError(null);
    setCode("");
  }

  async function sendPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const e164 = normalizePhone(phone);
    if (!e164) {
      setError("Enter a valid phone number, e.g. (555) 123-4567");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNormalizedPhone(e164);
    setStep("code");
  }

  async function verifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!normalizedPhone) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: code.trim(),
      type: "sms",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/me");
    router.refresh();
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    // Supabase emails BOTH the magic link AND a 6-digit token by default.
    // We prefer the token (browser-independent) but keep the link for users
    // who prefer to tap it on their phone.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${appUrl}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
  }

  async function verifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/me");
    router.refresh();
  }

  return (
    <AppShell back="/" title="Sign in">
      <div className="mt-6 max-w-sm">
        {/* Mode toggle */}
        {step === "input" ? (
          <div className="reveal flex gap-1 p-1 rounded-[var(--radius-pill)] bg-[var(--color-surface)] mb-6 text-sm">
            <button
              type="button"
              onClick={() => switchMode("phone")}
              className={`flex-1 px-4 py-2 rounded-[var(--radius-pill)] transition-colors ${
                mode === "phone"
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-muted)]"
              }`}
            >
              Phone
            </button>
            <button
              type="button"
              onClick={() => switchMode("email")}
              className={`flex-1 px-4 py-2 rounded-[var(--radius-pill)] transition-colors ${
                mode === "email"
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-muted)]"
              }`}
            >
              Email
            </button>
          </div>
        ) : null}

        {mode === "phone" && step === "input" ? (
          <form onSubmit={sendPhone} className="reveal space-y-5">
            <p className="text-[var(--color-muted)]">
              We&apos;ll text you a 6-digit code. No password.
            </p>
            <label className="block">
              <span className="text-sm text-[var(--color-ink)]">
                Mobile number
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
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
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : null}

        {mode === "phone" && step === "code" ? (
          <form onSubmit={verifyPhone} className="reveal space-y-5">
            <p className="text-[var(--color-muted)]">
              Enter the 6-digit code sent to{" "}
              <span className="font-mono">{normalizedPhone}</span>.
            </p>
            <label className="block">
              <span className="text-sm text-[var(--color-ink)]">Code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="mt-1 w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)] font-mono tracking-[0.3em] text-center text-lg"
              />
            </label>
            {error ? (
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="tap w-full px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify and continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("input");
                setCode("");
                setError(null);
              }}
              className="tap w-full px-6 py-3 rounded-[var(--radius-pill)] text-sm text-[var(--color-muted)] hover:bg-[var(--color-divider)]"
            >
              Use a different number
            </button>
          </form>
        ) : null}

        {mode === "email" && step === "input" ? (
          <form onSubmit={sendEmail} className="reveal space-y-5">
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
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : null}

        {mode === "email" && step === "code" ? (
          <form onSubmit={verifyEmail} className="reveal space-y-5">
            <p className="text-[var(--color-muted)]">
              Enter the 6-digit code we emailed to{" "}
              <span className="font-mono text-[var(--color-ink)]">{email}</span>
              .
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              The email also contains a one-tap link — use it only if you open
              it in this same browser.
            </p>
            <label className="block">
              <span className="text-sm text-[var(--color-ink)]">Code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="mt-1 w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus:outline-none focus:border-[var(--color-accent)] font-mono tracking-[0.3em] text-center text-lg"
              />
            </label>
            {error ? (
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="tap w-full px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify and continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("input");
                setCode("");
                setError(null);
              }}
              className="tap w-full px-6 py-3 rounded-[var(--radius-pill)] text-sm text-[var(--color-muted)] hover:bg-[var(--color-divider)]"
            >
              Use a different email
            </button>
          </form>
        ) : null}
      </div>
    </AppShell>
  );
}
