import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="px-6 pt-8 pb-4 reveal">
        <div className="font-display text-2xl tracking-tight text-[var(--color-ink)]">
          Splity
        </div>
      </header>

      <section className="flex-1 px-6 flex flex-col justify-center max-w-xl mx-auto w-full">
        <h1 className="reveal reveal-1 font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight text-[var(--color-ink)]">
          Split the bill
          <br />
          in one tap.
        </h1>

        <p className="reveal reveal-2 mt-6 text-lg text-[var(--color-muted)] max-w-md">
          Snap a receipt, share one link. Friends tap their items and pay you
          back on Venmo, Zelle, or Cash App. No app. No signup. Nothing to
          download.
        </p>

        <div className="reveal reveal-3 mt-10 flex flex-col gap-3">
          <Link
            href="/new"
            className="tap inline-flex items-center justify-center px-6 py-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium text-base shadow-[var(--shadow-soft)] hover:bg-[var(--color-accent-hover)]"
          >
            I paid for a group — split it
          </Link>
          <Link
            href="/auth/phone"
            className="tap inline-flex items-center justify-center px-6 py-4 rounded-[var(--radius-pill)] text-[var(--color-ink)] text-sm hover:bg-[var(--color-divider)]"
          >
            I&apos;ve used Splity before — sign in
          </Link>
        </div>

        <ol className="reveal reveal-4 mt-14 space-y-4 text-sm text-[var(--color-muted)]">
          {[
            "Take a photo of the receipt.",
            "Confirm the items and tax.",
            "Share the link. Friends pick what they ate.",
            "They tap once and Venmo opens, pre-filled.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-xs text-[var(--color-ink)] mt-0.5 w-5">
                0{i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-[var(--color-muted)]">
        Splity · Built for friends who hate doing math at dinner.
      </footer>
    </main>
  );
}
