// Lightweight transactional email via Resend's HTTP API.
// We talk to Resend directly (no SDK) so this stays a single file with
// zero new deps. Supabase already routes its auth emails through Resend
// via SMTP — same provider, separate channel.
//
// Env vars (set in Vercel):
//   RESEND_API_KEY     — required. If unset, every send is a no-op + warn.
//   SPLITY_FROM_EMAIL  — optional, e.g. "Splity <hello@splity.app>".
//                        Falls back to onboarding@resend.dev which works on
//                        Resend's sandbox domain (good for dev). Switch to a
//                        verified domain before production.

import { formatCents, type Currency } from "@/lib/money";

const FROM = process.env.SPLITY_FROM_EMAIL ?? "Splity <onboarding@resend.dev>";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

async function sendEmail(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping send to",
      args.to,
      "(",
      args.subject,
      ")"
    );
    return { ok: false, error: "RESEND_API_KEY unset" };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        "[email] Resend rejected send to",
        args.to,
        res.status,
        body.slice(0, 200)
      );
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[email] Network error sending to", args.to, e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Payer nudge: a payee just tapped Venmo / Zelle / Cash App / UPI / PayTM.
// The payer needs to know to check their app and confirm receipt in Splity.

type PaymentMethod = "venmo" | "zelle" | "cashapp" | "other";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  zelle: "Zelle",
  cashapp: "Cash App",
  // "other" includes UPI / PayTM / GPay for IN payers
  other: "UPI / PayTM",
};

export function buildPayerNudgeEmail(opts: {
  payerName: string;
  claimerName: string;
  amountCents: number;
  currency: Currency;
  method: PaymentMethod;
  restaurantName: string | null;
  reviewUrl: string;
}): { subject: string; html: string; text: string } {
  const amount = formatCents(opts.amountCents, opts.currency);
  const method = METHOD_LABELS[opts.method];
  const where = opts.restaurantName ? ` for ${opts.restaurantName}` : "";
  const subject = `${opts.claimerName} says they paid ${amount} on ${method}`;

  const text = [
    `Hi ${opts.payerName},`,
    "",
    `${opts.claimerName} just opened ${method} to send you ${amount}${where}.`,
    "",
    "Check your account, then confirm receipt in Splity so they get a tick:",
    opts.reviewUrl,
    "",
    "— Splity · Made for Friends",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html><body style="margin:0; padding:0; background:#F5F1E8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#0E1A33;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F1E8; padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px; background:#FFFFFF; border-radius:18px; padding:28px; box-shadow:0 1px 3px rgba(14,26,51,0.08);">
        <tr><td>
          <div style="font-family: Georgia, serif; font-size:24px; font-weight:600; letter-spacing:-0.02em;">Splity</div>
          <h1 style="font-family: Georgia, serif; font-size:22px; font-weight:500; margin:20px 0 8px 0;">
            ${escapeHtml(opts.claimerName)} says they paid you
          </h1>
          <p style="font-size:15px; line-height:1.5; color:#5B6478; margin:0 0 20px 0;">
            They just opened <strong>${escapeHtml(method)}</strong> to send
            <strong>${escapeHtml(amount)}</strong>${escapeHtml(where)}.
            Check your account, then confirm receipt so they get a tick.
          </p>
          <div style="background:#F5F1E8; border-radius:12px; padding:18px; margin-bottom:20px; text-align:center;">
            <div style="font-family: 'SF Mono', Menlo, Consolas, monospace; font-size:28px; font-weight:600;">${escapeHtml(amount)}</div>
            <div style="font-size:12px; color:#5B6478; margin-top:4px;">via ${escapeHtml(method)}</div>
          </div>
          <a href="${escapeAttr(opts.reviewUrl)}" style="display:inline-block; background:#1E3A8A; color:#FFFFFF; text-decoration:none; padding:12px 24px; border-radius:999px; font-size:15px; font-weight:500;">
            Confirm receipt
          </a>
          <p style="font-size:12px; color:#5B6478; line-height:1.5; margin:20px 0 0 0;">
            You'll only get these nudges when a friend marks a payment as sent.
          </p>
        </td></tr>
      </table>
      <div style="font-size:11px; color:#5B6478; margin-top:16px;">Splity · Made for Friends</div>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

export async function sendPayerNudge(args: {
  to: string;
  payerName: string;
  claimerName: string;
  amountCents: number;
  currency: Currency;
  method: PaymentMethod;
  restaurantName: string | null;
  reviewUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { subject, html, text } = buildPayerNudgeEmail(args);
  return sendEmail({ to: args.to, subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
