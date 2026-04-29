import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthBootstrap } from "@/components/AuthBootstrap";

export const dynamic = "force-dynamic";

export default async function Home() {
  // If we already have a session cookie, skip the landing entirely.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/me");

  return (
    <main className="flex-1 flex flex-col">
      {/* Hash-fragment fallback for magic-link returns that bypass /auth/callback */}
      <AuthBootstrap />
      <header className="px-6 pt-8 pb-4 reveal">
        <div className="font-display text-2xl tracking-tight text-[var(--color-ink)]">
          Splity
        </div>
      </header>

      <section className="flex-1 px-6 flex flex-col justify-center max-w-xl mx-auto w-full">
        <h1 className="reveal reveal-1 font-display whitespace-nowrap leading-[1.05] tracking-tight text-[var(--color-ink)] text-[clamp(1.875rem,9vw,3.75rem)]">
          Split the bill in one tap.
        </h1>

        <p className="reveal reveal-2 mt-5 text-lg text-[var(--color-muted)] max-w-md">
          Snap a receipt. Share a link. Get paid back.
        </p>

        <div className="reveal reveal-3 mt-9 flex flex-col gap-3">
          <Link
            href="/new"
            className="tap inline-flex items-center justify-center px-6 py-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium text-base shadow-[var(--shadow-soft)] hover:bg-[var(--color-accent-hover)]"
          >
            I paid for a group — split it
          </Link>
          <Link
            href="/auth"
            className="tap inline-flex items-center justify-center px-6 py-4 rounded-[var(--radius-pill)] text-[var(--color-ink)] text-sm hover:bg-[var(--color-divider)]"
          >
            I&apos;ve used Splity before — sign in
          </Link>
        </div>

        <ol className="reveal reveal-4 mt-14 space-y-4">
          {[
            "Take a photo of the receipt.",
            "Confirm the items and tax.",
            "Share the link with friends.",
            "They pick their split and pay you instantly.",
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex-none inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-accent)] text-white font-mono text-xs"
              >
                {i + 1}
              </span>
              <span className="text-sm text-[var(--color-muted)]">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-[var(--color-muted)] space-x-3">
        <span>Splity · Built for friends who hate doing math at dinner.</span>
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="underline-offset-4 hover:underline">
          Terms
        </Link>
      </footer>
    </main>
  );
}
