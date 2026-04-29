import { AppShell } from "@/components/AppShell";

export default function Loading() {
  return (
    <AppShell>
      <div className="mt-2 animate-pulse">
        <div className="h-8 w-3/4 rounded bg-[var(--color-divider)]" />
        <div className="mt-2 h-4 w-1/2 rounded bg-[var(--color-divider)]" />
        <div className="mt-6 h-12 rounded-[var(--radius-md)] bg-[var(--color-divider)]" />
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded-[var(--radius-md)] bg-[var(--color-divider)]"
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
