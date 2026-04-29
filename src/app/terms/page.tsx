import { AppShell } from "@/components/AppShell";

export const metadata = { title: "Terms — Splity" };

export default function TermsPage() {
  return (
    <AppShell back="/" title="Terms">
      <div className="prose prose-sm mt-4 text-[var(--color-ink)] space-y-4 leading-relaxed">
        <p className="text-[var(--color-muted)]">Last updated: April 2026</p>
        <p>
          Splity is a tool that helps friends split a bill. Splity does not
          process payments, hold money, or guarantee that anyone actually pays
          anyone back. The &ldquo;mark as paid&rdquo; toggle is self-reported
          and is not a payment confirmation.
        </p>
        <h2 className="font-display text-xl">Use it sensibly</h2>
        <p>
          Don&apos;t use Splity to scam your friends. Don&apos;t upload receipts that
          aren&apos;t yours. Don&apos;t share links broadly hoping random people pay you.
        </p>
        <h2 className="font-display text-xl">No warranty</h2>
        <p>
          Splity is provided &ldquo;as is.&rdquo; OCR may misread items —
          always validate the parsed receipt before sharing.
        </p>
        <h2 className="font-display text-xl">Changes</h2>
        <p>
          These terms may change as the product evolves. Continued use means
          you accept the latest version.
        </p>
      </div>
    </AppShell>
  );
}
