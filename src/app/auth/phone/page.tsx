"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { AppShell } from "@/components/AppShell";

function normalizePhone(input: string): string | null {
  // Naive E.164: assume US if 10 digits, else require leading +
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) {
    return digits.length >= 8 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export default function PhoneAuthPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalized, setNormalized] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
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
    setNormalized(e164);
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!normalized) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalized,
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

  return (
    <AppShell back="/" title="Sign in">
      <div className="mt-8 max-w-sm">
        {step === "phone" ? (
          <form onSubmit={sendCode} className="reveal space-y-5">
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
        ) : (
          <form onSubmit={verifyCode} className="reveal space-y-5">
            <p className="text-[var(--color-muted)]">
              Enter the 6-digit code sent to{" "}
              <span className="font-mono">{normalized}</span>.
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
                onChange={(e) => setCode(e.target.value)}
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
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="tap w-full px-6 py-3 rounded-[var(--radius-pill)] text-sm text-[var(--color-muted)] hover:bg-[var(--color-divider)]"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
