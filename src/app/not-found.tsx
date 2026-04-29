import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-3xl text-[var(--color-ink)]">
        Bill not found.
      </div>
      <p className="mt-3 text-[var(--color-muted)] max-w-sm">
        This link may have expired or been deleted by the person who shared it.
      </p>
      <Link
        href="/"
        className="tap mt-8 px-5 py-3 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium"
      >
        Go home
      </Link>
    </main>
  );
}
