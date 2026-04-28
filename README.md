# Splity

Frictionless bill splitting. Snap a receipt → share one link → friends tap their items → Venmo/Cash App/Zelle opens with the amount pre-filled.

Full spec: [`Splitty.md`](./Splitty.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + Storage) · Claude Haiku 4.5 (receipt OCR via vision) · Vercel.

## Setup

```bash
cp .env.example .env.local   # then fill in your keys
npm install
npm run dev                  # http://localhost:3000
```

### Required env vars

See [`.env.example`](./.env.example). You need:
- A Supabase project (run [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) in the SQL Editor)
- Phone Auth enabled in Supabase (Auth → Providers → Phone) with a Twilio account configured
- An Anthropic API key (used for Haiku-based receipt parsing)

### Migration

In Supabase Dashboard → SQL Editor, paste & run [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql). It creates `payers`, `bills`, `bill_items`, `claims`, `claim_items`, the private `receipts` storage bucket, and RLS policies.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing |
| `/auth/phone` | Phone OTP |
| `/me` | Payer dashboard |
| `/me/payment-methods` | Set Venmo / Zelle / Cash App handles |
| `/new` | Upload receipt + OCR validation |
| `/b/[shortId]` | **Public share link** — friends pick items |
| `/b/[shortId]/pay` | Confirmation + payment redirects |
| `/api/ocr` | Receipt → structured items (Claude Haiku) |
| `/api/claims` | Anonymous claim create/update |

## Tests

```bash
npx tsx --test src/lib/money.test.ts
```

## Deploy

Pushes to `main` auto-deploy to Vercel. Set the same env vars in Vercel → Project Settings → Environment Variables.
