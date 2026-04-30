# CLAUDE.md — Splity Build Specification

> **Repo:** `git@github.com:JishnuMoorthy/Splity.git`
> **Owner:** Jishnu Moorthy
> **Last updated:** April 2026
> **Build target:** Mobile-first responsive web app (no native iOS/Android required for MVP)

---

## 1. Project Overview

**Splity** is a frictionless, web-based bill-splitting tool. The person who paid the restaurant bill takes a photo of the receipt, validates the parsed line items, then shares a single link with friends. Friends open the link in any browser (no signup, no app download), tap the items they ate, and get redirected to Venmo / Zelle / Cash App with the amount pre-filled to pay the bill payer back.

### Why this exists
Existing tools (Splitwise, Splitty, Tab, OneSplit) all have one of three problems: (1) they require everyone to download an app, (2) they require account creation, or (3) they don't itemize via OCR. Splity removes all three frictions for the *payers* (the friends), while keeping the receipt-uploader flow simple.

### Core differentiator
**Zero friction for payers.** A friend clicking the link should never see a signup wall, never download anything, never type. They tap items, see their total, tap "Pay [Name]," and Venmo opens with everything filled in.

### What we are NOT building (for MVP)
- Native iOS / Android apps (web only, optimized for iPhone Safari)
- Integrated payments where Splity holds funds (no Stripe Connect, no KYC)
- Restaurant partnerships, NFC tags, or Toast integrations
- Account systems with passwords (use phone OTP only for the payer)
- Multi-currency support beyond USD
- Group history / ledger features

---

## 2. Aesthetic & Brand Direction

**Vibe:** Quiet luxury meets Gen Z. Think: *Aesop website meets a great fintech onboarding flow.* Confident, calm, generous whitespace, but with personality. Not bro-y, not scrappy, not corporate.

### Design tokens

```css
:root {
  /* Royal blue + warm beige palette */
  --color-bg: #F5F1E8;             /* warm beige base */
  --color-surface: #FAF7F0;        /* lighter beige for cards */
  --color-ink: #0A1F44;            /* deep royal blue, primary text */
  --color-accent: #1E3A8A;         /* royal blue, buttons & CTAs */
  --color-accent-hover: #2C4FAE;
  --color-muted: #6B7280;          /* secondary text */
  --color-success: #047857;
  --color-error: #B91C1C;
  --color-divider: rgba(10, 31, 68, 0.08);

  /* Typography */
  --font-display: 'Fraunces', 'Times New Roman', serif;   /* characterful serif for headings */
  --font-body: 'Geist', 'SF Pro Text', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Spacing & radius */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 22px;
  --radius-pill: 999px;

  /* Shadows */
  --shadow-soft: 0 1px 2px rgba(10, 31, 68, 0.04), 0 4px 16px rgba(10, 31, 68, 0.06);
  --shadow-lifted: 0 4px 12px rgba(10, 31, 68, 0.08), 0 12px 36px rgba(10, 31, 68, 0.10);
}
```

### Typography rules
- **Headings:** Fraunces (variable serif, soft-but-confident). Weight 400–500, slight optical-size variation on hero text.
- **Body:** Geist (Vercel's open-source sans). Crisp on iPhone Retina.
- **Numbers / receipt amounts:** JetBrains Mono with tabular figures (`font-variant-numeric: tabular-nums;`). This is non-negotiable — money should never shift width.

### Motion principles
- One choreographed reveal on landing (stagger items in over ~600ms total).
- Tap feedback: scale 0.97 + 100ms ease-out on interactive elements.
- Item selection: smooth color fill, never a jarring flash.
- Avoid bounce/spring overuse. This is luxury, not TikTok.

### iPhone-specific polish
- Safe-area insets honored: `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);`
- Apple Pay button styling per Apple HIG when used.
- Use `-webkit-tap-highlight-color: transparent;` and design custom press states.
- Disable rubber-band scrolling on overlay sheets (use `overscroll-behavior: contain;`).
- Set `theme-color` meta tag to `#F5F1E8` so Safari chrome blends in.
- Add Apple touch icons + iOS web-app-capable meta tags so users can "Add to Home Screen" and get a cleaner experience.

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router) | SSR for fast share-link opens, easy Vercel deploy, file-based routing |
| Language | **TypeScript** | Catches bugs early, especially around money math |
| Styling | **Tailwind CSS** + CSS variables above | Speed without sacrificing custom aesthetic |
| UI primitives | **shadcn/ui** (selected components only) | Accessible base, restyle to match brand |
| Database | **Supabase** (Postgres + Storage) | Free tier, hosted, easy auth, image storage for receipts |
| Auth | **Supabase Auth** (phone OTP only, payer-side) | No passwords, no email |
| OCR | **Google Cloud Vision API** (`DOCUMENT_TEXT_DETECTION`) | Best accuracy for receipts; fallback to GPT-4o-mini for line-item parsing |
| Hosting | **Vercel** | Free, instant deploys from GitHub, edge functions |
| Analytics | **PostHog** (self-hosted optional) | Funnel tracking for the share-link conversion |
| Image upload | Supabase Storage with signed URLs | Receipts are sensitive; never make buckets public |

**Do not introduce new dependencies without checking with the user first.** Every new package is a maintenance cost.

---

## 4. Data Model (Supabase / Postgres)

```sql
-- Bill payers (the people who paid the restaurant bill)
create table payers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,            -- E.164 format
  display_name text not null,            -- shown to friends on the share page
  venmo_handle text,                     -- e.g. "Jishnu-Moorthy" (no @)
  zelle_contact text,                    -- phone or email tied to Zelle
  cashapp_handle text,                   -- e.g. "$jishnu"
  created_at timestamptz default now()
);

-- Bills (one per uploaded receipt)
create table bills (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,         -- 6-char URL slug, e.g. "k3p9xq"
  payer_id uuid references payers(id) on delete cascade,
  receipt_image_path text,               -- Supabase Storage path, NOT public URL
  restaurant_name text,
  subtotal_cents integer not null,
  tax_cents integer not null default 0,
  tip_cents integer not null default 0,
  total_cents integer not null,
  status text not null default 'active', -- active | closed
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days')
);

create index on bills(short_id);
create index on bills(payer_id);

-- Line items on a bill
create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete cascade,
  name text not null,
  price_cents integer not null,
  quantity integer not null default 1,
  is_shared boolean not null default false,  -- e.g. shared appetizer
  position integer not null                  -- preserves receipt order
);

create index on bill_items(bill_id);

-- Claims: a friend selecting items from a bill
create table claims (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete cascade,
  claimer_name text,                     -- they type their name; no auth
  claimer_session_id text not null,      -- cookie-based, prevents double-claim
  total_cents integer not null,          -- their share including tax + tip
  payment_method text,                   -- venmo | zelle | cashapp | other
  paid_at timestamptz,                   -- self-reported "I paid" tap
  created_at timestamptz default now()
);

create index on claims(bill_id);

-- Item-to-claim junction (which items did this claimer take?)
create table claim_items (
  claim_id uuid references claims(id) on delete cascade,
  item_id uuid references bill_items(id) on delete cascade,
  share_fraction numeric(5,4) not null default 1.0,  -- 1.0 = all of it; 0.5 = half
  primary key (claim_id, item_id)
);
```

### Row Level Security (RLS)
- `bills` and `bill_items`: readable by anyone with the `short_id` (public via API route, NOT direct Supabase access). Writable only by the owning `payer_id`.
- `claims`: insertable by anyone, readable by the bill owner.
- `payers`: only the row owner can read their own row (matched via auth.uid()).
- **Receipt images**: stored in a private bucket. Only served via signed URLs that the payer controls. Friends viewing the share link should NOT see the raw receipt unless the payer explicitly chose to attach it.

---

## 5. URL Structure

| Route | Purpose |
|---|---|
| `/` | Landing page — explain product, "Upload a receipt" CTA |
| `/new` | Receipt upload + OCR validation flow (payer only, requires phone OTP) |
| `/me` | Payer dashboard — list of their bills, payment status |
| `/me/payment-methods` | Set Venmo / Zelle / Cash App handles |
| `/b/[shortId]` | **The share link.** Public, no auth. Friends pick items here. |
| `/b/[shortId]/pay` | After picking items: confirmation screen with payment buttons |
| `/auth/phone` | Phone OTP login |

Short IDs are 6-character lowercase alphanumeric (e.g., `k3p9xq`), generated with [nanoid](https://github.com/ai/nanoid) using a custom alphabet to avoid ambiguous chars (`0`, `O`, `1`, `l`, `i`).

---

## 6. The Two Critical User Flows

### Flow A — Payer (uploads receipt)

1. Land on `/`, tap "I paid for a group — split it"
2. **Phone OTP** via Supabase Auth (one screen, no password)
3. First time only: enter display name + at least one payment method (Venmo handle minimum)
4. **Upload receipt:** camera capture or photo library. Show immediate preview.
5. Loading state: "Reading your receipt..." (target <4s)
6. **OCR validation screen** — this is the most important screen in the app:
   - Editable list of line items (name, price, quantity)
   - Tap any field to edit inline
   - Add/remove rows
   - Tax and tip fields auto-populated, editable
   - Live total at bottom that always equals receipt total — show a soft warning if mismatch >$0.50
   - Toggle each item as "shared" (split among everyone who claims any item from this bill)
7. Tap "Looks good — share with friends"
8. Generate `short_id`, persist bill + items, redirect to `/me` with a toast: "Link copied"
9. The share link gets copied to clipboard automatically AND a system share sheet (`navigator.share`) opens with: `"I paid for dinner at [Restaurant]. Tap your items: [link]"`

### Flow B — Friend (claims items, pays)

1. Tap link in iMessage / WhatsApp → opens `/b/[shortId]` in Safari
2. **No auth wall.** Page loads showing:
   - "Jishnu paid $147.20 at Sakura Sushi"
   - List of items with prices
   - Items already claimed by others are dimmed and labeled "Claimed by Maya"
3. Friend types their name (only required field, persisted in localStorage for repeat users)
4. Tap items they ate. Shared items show a "Split with X others" badge.
5. Live total updates at bottom showing their share including proportional tax + tip (see §7 for math)
6. Tap "Done — see what I owe"
7. Confirmation screen: clear breakdown of items + tax + tip + total
8. Three payment buttons (only shown if payer set them up): **Pay on Venmo** / **Pay on Zelle** / **Pay on Cash App**
9. Tap Venmo → opens `https://venmo.com/[handle]?txn=pay&amount=23.50&note=Sakura%20Sushi` (works on web AND deep-links into the iOS app if installed)
10. After returning to Splity: "Did you pay?" toggle. If yes, mark `claims.paid_at`. This is self-reported — no actual payment verification, just helps the payer track.

---

## 7. The Math (DO NOT GET THIS WRONG)

Splitting tax and tip **proportionally** is the entire point. Equal splits would make Splity worse than just typing into Venmo manually.

```typescript
// Given:
//   - claimerSubtotalCents: sum of items the claimer selected (with share fractions for shared items)
//   - billSubtotalCents: bill.subtotal_cents
//   - billTaxCents: bill.tax_cents
//   - billTipCents: bill.tip_cents
//
// Their share of tax + tip is proportional to their fraction of the subtotal.

function calculateClaimerTotal(
  claimerSubtotalCents: number,
  billSubtotalCents: number,
  billTaxCents: number,
  billTipCents: number
): number {
  if (billSubtotalCents === 0) return 0;
  const proportion = claimerSubtotalCents / billSubtotalCents;
  const claimerTax = Math.round(billTaxCents * proportion);
  const claimerTip = Math.round(billTipCents * proportion);
  return claimerSubtotalCents + claimerTax + claimerTip;
}
```

### Money rules
- **Always store cents as integers.** Never use floats for money.
- Display with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.
- Rounding: round each claimer's tax/tip share to the nearest cent. The sum may be off by a few cents from the bill total — that's acceptable for v1.
- Show a "verified" or "balances to $X.XX" indicator on the payer dashboard so they can sanity-check.

### Shared items
If an item is marked `is_shared = true` and N people claim it, each pays `price_cents / N`. The denominator updates live as more friends claim, which means earlier claimers' totals can change. Surface this with a small "Total may update as others claim" note.

---

## 8. OCR Pipeline

### Primary: Google Cloud Vision
1. Upload image → Supabase Storage (private bucket).
2. Generate signed URL valid for 60 seconds.
3. Server-side: call Vision API with `DOCUMENT_TEXT_DETECTION`.
4. Get back full text + bounding boxes.

### Secondary: LLM parsing pass
Vision returns raw text. To extract structured line items, send the text to GPT-4o-mini (or Claude Haiku 4.5, since the user is in the Anthropic ecosystem) with a strict JSON schema prompt:

```typescript
const PARSING_PROMPT = `
You are a receipt parser. Extract line items, tax, tip, and total.
Return ONLY valid JSON matching this exact schema:
{
  "restaurant_name": string | null,
  "items": [{ "name": string, "price_cents": integer, "quantity": integer }],
  "subtotal_cents": integer,
  "tax_cents": integer,
  "tip_cents": integer,
  "total_cents": integer
}

Rules:
- Convert all amounts to cents (e.g., $12.50 → 1250).
- Quantity defaults to 1 if not specified.
- If you cannot find a value, use 0 (never null) for cents fields.
- Do not include subtotals, totals, or tax lines as items.
- Do not invent items not present in the text.
`;
```

Always validate the LLM response with **Zod** before persisting:

```typescript
import { z } from 'zod';

export const ParsedReceiptSchema = z.object({
  restaurant_name: z.string().nullable(),
  items: z.array(z.object({
    name: z.string().min(1),
    price_cents: z.number().int().nonnegative(),
    quantity: z.number().int().positive(),
  })),
  subtotal_cents: z.number().int().nonnegative(),
  tax_cents: z.number().int().nonnegative(),
  tip_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().nonnegative(),
});
```

### Fallback
If OCR confidence is low or parsing fails, drop the user into a manual-entry mode with the raw text shown alongside an empty item table. Do not block the flow.

---

## 9. Payment Deep Links (REFERENCE)

These are the actual URL schemes that work. Verified patterns:

### Venmo (works on web AND mobile)
```
https://venmo.com/{username}?txn=pay&amount={amount}&note={url_encoded_note}
```
- `{username}` = handle without `@` (e.g., `Jishnu-Moorthy`)
- `{amount}` = decimal dollars (e.g., `23.50`)
- `{note}` = URL-encoded string

`txn=pay` means the friend is paying the payer. (`txn=charge` would request money — wrong direction here.)

On iOS, this URL automatically opens the Venmo app if installed; otherwise it falls back to the web flow. **No deep-link handling code needed on our side** — just generate the link.

### Cash App
```
https://cash.app/${cashtag}/{amount}
```
Example: `https://cash.app/$jishnu/23.50`

### Zelle
**Zelle has no public URL scheme.** Best UX: show the payer's Zelle-linked phone or email with a "Tap to copy" button and instructions: *"Open your bank app, send $23.50 to [phone/email] via Zelle."* Acceptable for v1; not the smoothest, but unavoidable.

### Apple Pay (future)
Apple Pay on web requires merchant verification and a payment processor (Stripe). Out of scope for MVP.

---

## 10. Security & Privacy Checklist

- [ ] All Supabase RLS policies tested with anonymous and authenticated roles
- [ ] Receipt images stored in private bucket, never publicly listed
- [ ] Phone numbers stored in E.164, never logged in plaintext
- [ ] No PII in URLs (short_id is opaque, not predictable)
- [ ] CSRF protection on all mutating routes (Next.js handles via Server Actions)
- [ ] Rate limit OCR endpoint (5 receipts per phone per hour) — use Upstash Redis
- [ ] Validate every Zod schema on the server, never trust client input
- [ ] Sanitize the `note` parameter before injecting into Venmo URL (URL-encode)
- [ ] Display payer's name and Venmo handle on the share page, but NOT their phone number
- [ ] Bills auto-expire after 30 days (cron job: `delete from bills where expires_at < now()`)
- [ ] Add a "Delete this bill" button on the payer dashboard
- [ ] Privacy policy page covering: receipt image retention, payment-handle storage, phone OTP

---

## 11. Build Order (Phased)

Follow this order. Do not skip ahead — each phase depends on the previous one being functional.

### Phase 1 — Skeleton (Day 1)
- [ ] Initialize Next.js 15 + TypeScript + Tailwind in the existing repo
- [ ] Set up Supabase project, create tables from §4, enable RLS
- [ ] Add design tokens (§2) to `globals.css`
- [ ] Build `/` landing page with hero + CTA (static, no functionality yet)
- [ ] Deploy to Vercel, verify it loads on iPhone Safari

### Phase 2 — Payer auth + payment methods (Day 2)
- [ ] `/auth/phone` — Supabase phone OTP flow
- [ ] `/me/payment-methods` — form for Venmo/Zelle/Cash App handles
- [ ] `/me` — empty dashboard for now
- [ ] Verify session persists, RLS blocks reads of other users' rows

### Phase 3 — Receipt upload + OCR (Days 3–4)
- [ ] `/new` upload screen with `<input type="file" accept="image/*" capture="environment">`
- [ ] Server action: upload to Supabase Storage, return signed URL
- [ ] API route `/api/ocr`: call Vision API, then LLM parser, validate with Zod
- [ ] OCR validation screen with editable line items
- [ ] Persist bill + items on confirm, redirect to `/me`

### Phase 4 — Share link (Day 5)
- [ ] `/b/[shortId]` public page (no auth)
- [ ] Item selection UI with live total calculation (§7)
- [ ] Claim persistence (anonymous, session-cookie based)
- [ ] Payer dashboard `/me` lists bills with claim status

### Phase 5 — Payment redirects (Day 6)
- [ ] `/b/[shortId]/pay` confirmation screen
- [ ] Generate Venmo / Cash App deep links
- [ ] Zelle copy-to-clipboard fallback
- [ ] "Mark as paid" self-report toggle

### Phase 6 — Polish (Day 7+)
- [ ] Animations (page transitions, item-tap feedback, total counter)
- [ ] Empty states and error states
- [ ] Loading skeletons (NOT spinners — use shimmering placeholder bars)
- [ ] PostHog funnel: landing → upload → validate → share → claim → pay
- [ ] Apple touch icon, manifest.json, theme-color meta
- [ ] Privacy policy + terms

---

## 12. Component Inventory

These are the components Claude Code should build. Keep each one focused; no kitchen-sink components.

**Layout**
- `<AppShell>` — handles safe-area insets, max-width container, dark blue header bar
- `<PageHeader title back?>` — back button + title

**Receipt flow**
- `<ReceiptUploader onUpload>` — camera/library picker with preview
- `<ReceiptItemRow item editable onEdit onDelete>` — single line in validation screen
- `<TotalsBar subtotal tax tip total mismatchWarning?>` — sticky bottom bar with running totals

**Share flow**
- `<ItemPickerRow item claimedByOthers onToggle>` — friend-side item selector
- `<ClaimerNameInput>` — single field, autofocus on mobile
- `<RunningTotal cents label>` — large monospace total, animates on change
- `<PaymentButton method handle amount note>` — Venmo / Cash App / Zelle

**Common**
- `<MoneyDisplay cents>` — formatted USD with tabular nums
- `<Toast>` — bottom sheet style, royal blue background
- `<Sheet>` — full-screen modal for editing item details, swipe-down to close

---

## 13. Testing Strategy

For an MVP, do not chase 100% coverage. Test the things that, if broken, would lose users' money or trust.

**Required tests:**
- `calculateClaimerTotal` with edge cases: zero subtotal, single shared item, fractional shares
- Zod schema validation on OCR output (malformed JSON, negative cents, missing fields)
- RLS: anonymous user cannot read another payer's bills directly via Supabase client
- Short ID generator never produces collisions in 10,000 iterations

**Manual QA checklist (run before every deploy):**
- [ ] iPhone Safari: receipt upload via camera works
- [ ] iPhone Safari: tapping Venmo button opens Venmo app with prefilled amount
- [ ] Share sheet opens on `/me` after creating a bill
- [ ] Share link works in private/incognito mode (no auth required)
- [ ] Total at top of bill page matches sum of all items
- [ ] OCR works on a clear receipt and degrades gracefully on a bad photo

---

## 14. Things to Defer (Do Not Build Yet)

These are tempting but should not block v1:
- Restaurant integrations / NFC / QR-on-table
- Apple Pay / Stripe (you don't need to hold money)
- Multi-currency
- Group history / "My friends" feature
- Splitting by percentage instead of items
- Receipt scanning from email (DoorDash, Uber Eats URLs)
- Native iOS app
- Notifications when someone pays

Write each of these down in a `BACKLOG.md` so you don't forget the ideas, but don't build them.

---

## 15. Working with Claude Code

When prompting Claude Code from the terminal:

**Good prompts:**
- "Implement the OCR validation screen per CLAUDE.md §6 Flow A step 6. Use the design tokens from §2."
- "Add the `calculateClaimerTotal` function from §7 with the listed unit tests."
- "Build `<PaymentButton>` per §12. Reference §9 for the Venmo URL format."

**Bad prompts:**
- "Build the whole app." (too vague, will produce slop)
- "Make it look nice." (define what "nice" means via tokens)

Always reference specific section numbers from this file. Treat this doc as the source of truth — if something here is wrong or unclear, update the doc *first*, then write the code.

### Pre-flight checks before each Claude Code session
1. Run `git status` — start from a clean tree.
2. Confirm Supabase env vars are loaded (`.env.local` not committed).
3. Run `npm run dev` and verify the app loads before changing anything.

### Commit hygiene
- One feature per commit. Commit message format: `feat: implement OCR validation screen (CLAUDE.md §6)`.
- Never commit `.env.local`, Supabase keys, or Vision API keys.
- Add a pre-commit hook that fails if any file contains the string `SUPABASE_SERVICE_ROLE_KEY=`.

---

## 16. Open Questions for Jishnu

These need decisions before or during the build:

1. **Domain name.** Splity.app? Splity.co? Splity.cc? (Splity.com is likely taken — verify and pick.)
2. **OTP cost.** Supabase phone auth uses Twilio; budget ~$0.05 per signup. Acceptable for early users; revisit if signups exceed 1k/month.
3. **LLM choice for receipt parsing.** Claude Haiku 4.5 vs GPT-4o-mini. Haiku is cheaper and faster as of April 2026; default to Haiku unless accuracy testing shows otherwise.
4. **Logo.** Hold off until product works. Don't sink time into branding before validation.
5. **Launch channel.** Where do the first 100 users come from? (Reply guy in r/personalfinance? Twitter? Friend group beta?)

---

## 17. Definition of Done for MVP

MVP is shippable when, on an iPhone:
1. A user can upload a receipt photo, validate the OCR, and get a share link in under 90 seconds.
2. A friend can open the link, claim items, and tap through to Venmo with the correct amount in under 30 seconds.
3. The math is correct on a bill with shared items, tax, and tip.
4. No JavaScript errors in Safari console on either flow.
5. The page looks good on iPhone 13 Pro and up (375px–430px viewport widths).

That's it. Everything else is iteration.

---

## 18. v2 Enhancements (post-MVP, 2026-04-30)

After the initial launch the following additions and refinements were made. They are now part of the live product on `splity-lyart.vercel.app` and should be considered baseline for any future iteration.

### Receipt capture
- **Camera + library upload buttons.** The `/new` page exposes two buttons — one with `capture="environment"` for the back camera, and one for the photo library / Files app. Receipts arriving as PDFs from email work via the library button.
- **PDF support in OCR.** `/api/ocr` accepts both images (`image` content block) and PDFs (`document` content block, `media_type: "application/pdf"`) when calling Claude Haiku 4.5.
- **Generic copy.** Marketing and onboarding copy was reworded so the app reads as "any receipt" (gas, tickets, groceries) rather than "restaurants only."

### Receipt storage
- **Private `receipts` Supabase Storage bucket.** Uploads run server-side via the service-role client at `/api/ocr`, keying files as `{user_id}/{uuid}.{ext}`.
- **Signed-URL endpoint.** `/api/receipt/[shortId]` issues a 10-minute signed URL when given a known share-link slug. Knowledge of the slug is the access gate; no anon Storage policies are required.
- **Receipt button on `/me` and on the share page.** Payers see a "Receipt" link on each bill card, payees see "View receipt" on the claim page when one exists. Both open in a new tab.

### Claim flow (payee side)
- **Mode toggle.** A pill switch on the share page lets the payee choose **Pick items** (default) or **Custom amount**.
- **Per-item percentage picker.** Tapping an item reveals a 100 / 75 / 50 / 25% selector inside the selected card. Default is 100%. The line is computed as `round(price * qty * pct / 100)`, divided evenly with other claimers when the item is shared.
- **Custom amount mode.** A single dollar input. When used, total bypasses tax/tip proration entirely — the payee's total equals the entered amount. Useful for partial payments ("here's $20 toward gas").
- **Schema.**
  - `claims.custom_amount_cents int null`
  - `claim_items.share_percent int not null default 100 check (share_percent in (25,50,75,100))`

### New-bill flow (payer side)
- **Per-item name assignment.** Each line on `/new` has an optional "Assign to (e.g. Mary)" field. The assignment surfaces on the share page as "For Mary" so the payee knows the line was already earmarked.
- **Schema.** `bill_items.assigned_to text null`.
- **Tax/tip input UX.** `<DollarField>` has `placeholder="0.00"`, `onFocus` selects the existing value, the wrapper is `w-full` and the input is `min-w-0` so the `$` glyph and value always sit inside the rounded box. Fixes a bug where typing `1` against an OCR-prefilled `$1.00` produced `$11.00`.
- **Explicit "link ready" success stage.** Submitting no longer redirects silently — `NewBillFlow` shows a success card with the share URL plus **Share** (native share sheet when available) and **Copy link** buttons. Secondary links go back to `/me` or to a preview of the share page. The previous flow could appear stuck on "Creating link…" if the post-action navigation stalled.

### Auth
- **Email magic links via Resend SMTP** as the primary auth method, configured under Supabase → Auth → SMTP Settings. Twilio phone OTP is gated by A2P 10DLC registration and is intentionally deferred.
- **Auth callback routes by payer existence.** `/auth/callback` and the hash-fragment fallback in `AuthBootstrap.tsx` both look up `payers` by `user_id` after the session is established. Returning users land on `/me`; new users land on `/me/payment-methods?first=1` (the payer-setup / sign-up step). The previous behaviour dropped first-time users on the marketing landing page.

### Schema migration
All v2 columns ship in a single migration: `supabase/migrations/0003_v2_features.sql`.

```sql
alter table claims     add column if not exists custom_amount_cents int;
alter table claim_items add column if not exists share_percent int not null default 100
  check (share_percent in (25, 50, 75, 100));
alter table bill_items add column if not exists assigned_to text;
alter table bills      add column if not exists receipt_path text;
```
