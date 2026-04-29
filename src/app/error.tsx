"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-3xl text-[var(--color-ink)]">
        Something broke.
      </div>
      <p className="mt-3 text-[var(--color-muted)] max-w-sm">
        Sorry — try again. If it keeps happening, the link or bill may be
        invalid.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="tap px-5 py-3 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium"
        >
          Try again
        </button>
        <Link
          href="/"
          className="tap px-5 py-3 rounded-[var(--radius-pill)] text-[var(--color-ink)] hover:bg-[var(--color-divider)]"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
