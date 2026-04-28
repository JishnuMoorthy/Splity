import Link from "next/link";

export function AppShell({
  children,
  back,
  title,
}: {
  children: React.ReactNode;
  back?: string;
  title?: string;
}) {
  return (
    <div className="flex-1 flex flex-col w-full max-w-xl mx-auto">
      <header className="px-6 pt-6 pb-3 flex items-center gap-3">
        {back ? (
          <Link
            href={back}
            className="tap inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--color-divider)] text-[var(--color-ink)]"
            aria-label="Back"
          >
            ←
          </Link>
        ) : null}
        {title ? (
          <h1 className="font-display text-xl text-[var(--color-ink)]">
            {title}
          </h1>
        ) : (
          <Link
            href="/"
            className="font-display text-xl tracking-tight text-[var(--color-ink)]"
          >
            Splity
          </Link>
        )}
      </header>
      <div className="flex-1 px-6 pb-10">{children}</div>
    </div>
  );
}
