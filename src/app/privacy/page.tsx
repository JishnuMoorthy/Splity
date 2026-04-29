import { AppShell } from "@/components/AppShell";

export const metadata = { title: "Privacy — Splity" };

export default function PrivacyPage() {
  return (
    <AppShell back="/" title="Privacy">
      <div className="prose prose-sm mt-4 text-[var(--color-ink)] space-y-4 leading-relaxed">
        <p className="text-[var(--color-muted)]">
          Last updated: April 2026
        </p>
        <h2 className="font-display text-xl">What we collect</h2>
        <p>
          When you sign in, Splity stores your email address (or phone number,
          if you sign in by phone). When you set up payment methods, we store
          your Venmo handle, Cash App $cashtag, and/or Zelle phone or email so
          we can show them to friends paying you back.
        </p>
        <p>
          When you upload a receipt, the photo is sent to our OCR provider to
          extract line items. We do <strong>not</strong> store the receipt
          image itself. Only the parsed data (item names, prices, tax, tip)
          is saved.
        </p>
        <h2 className="font-display text-xl">What friends see</h2>
        <p>
          People with the share link see your display name, the line items, and
          whichever payment handles you set up. They do <strong>not</strong>{" "}
          see your email address or phone number.
        </p>
        <h2 className="font-display text-xl">Retention</h2>
        <p>
          Bills auto-expire after 30 days. You can also delete a bill manually
          from the dashboard.
        </p>
        <h2 className="font-display text-xl">Third parties</h2>
        <p>
          We use Supabase for storage, Vercel for hosting, and Anthropic for
          receipt OCR. Payment redirects open Venmo, Cash App, or your bank&apos;s
          Zelle in a separate context — Splity never sees the actual payment.
        </p>
        <h2 className="font-display text-xl">Contact</h2>
        <p>Questions? Email the address you used to sign up to reach the team.</p>
      </div>
    </AppShell>
  );
}
