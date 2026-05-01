import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const ParsedReceiptSchema = z.object({
  restaurant_name: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string().min(1),
      price_cents: z.number().int().nonnegative(),
      quantity: z.number().int().positive(),
    })
  ),
  subtotal_cents: z.number().int().nonnegative(),
  tax_cents: z.number().int().nonnegative(),
  tip_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().nonnegative(),
});

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;

const PARSING_PROMPT = `You are a receipt parser. Look at the receipt and extract line items, tax, tip, and total.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
{
  "restaurant_name": string | null,
  "items": [{ "name": string, "price_cents": integer, "quantity": integer }],
  "subtotal_cents": integer,
  "tax_cents": integer,
  "tip_cents": integer,
  "total_cents": integer
}

CRITICAL — what price_cents means:
- "price_cents" is the UNIT price (price for one unit), NOT the line total.
- "quantity" is how many of that item.
- Line total for a row is implicitly (price_cents * quantity).

Rules:
- Convert all amounts to cents (e.g., $12.50 → 1250).
- Quantity defaults to 1 if not specified.
- If you cannot find a value, use 0 (never null) for cents fields.
- Do not include subtotals, totals, or tax lines as items.
- Do not invent items not present on the receipt.

Disambiguating quantity vs price (very important):
- Receipts often print one row that combines a quantity with the LINE total, e.g. "14 GUINNESS  $140.00". The $140 is the line total, not the unit price. The unit price is $10 (140 / 14).
- An "@" sign or "ea" usually flags this: "3 @ 4.50" → quantity 3, price_cents 450.
- Multi-quantity lines where the printed amount is a clean multiple of the quantity are almost always line totals, not unit prices. Recover the unit price as (printed amount / quantity).
- A single bottle of beer is rarely $140; a single coffee is rarely $36. If a unit price seems implausible AND it divides evenly by the printed quantity, you have a line-total-vs-unit-price confusion. Fix it.

Sanity check before returning:
- Sum (price_cents * quantity) across all items.
- That sum should equal subtotal_cents (within a few cents for rounding).
- If it doesn't, your line items are wrong — most often because you stored a line total in price_cents instead of dividing by quantity. Re-read the receipt and correct.`;

export type ReceiptMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "application/pdf";

export async function parseReceipt(opts: {
  fileBase64: string;
  mediaType: ReceiptMediaType;
}): Promise<ParsedReceipt> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const fileBlock =
    opts.mediaType === "application/pdf"
      ? ({
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: opts.fileBase64,
          },
        })
      : ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: opts.mediaType,
            data: opts.fileBase64,
          },
        });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [fileBlock, { type: "text", text: PARSING_PROMPT }],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("OCR returned no text content");
  }

  // Defensive: strip ```json fences if model added them
  const raw = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OCR returned invalid JSON");
  }
  const validated = ParsedReceiptSchema.parse(parsed);
  return reconcileReceipt(validated);
}

// Cross-check the parsed line items against the printed subtotal. The most
// common OCR mistake is storing a line total (e.g. "14 GUINNESS $140") in
// price_cents instead of the unit price. We catch that by trying both
// interpretations and seeing which one matches subtotal_cents.
const SUBTOTAL_TOLERANCE_CENTS = 5; // forgive rounding noise in unit-price math

export function reconcileReceipt(r: ParsedReceipt): ParsedReceipt {
  if (r.subtotal_cents <= 0 || r.items.length === 0) return r;

  const sumAsUnit = r.items.reduce(
    (s, it) => s + it.price_cents * it.quantity,
    0
  );
  if (Math.abs(sumAsUnit - r.subtotal_cents) <= SUBTOTAL_TOLERANCE_CENTS) {
    return r; // already consistent — trust the parse
  }

  const sumAsLineTotal = r.items.reduce((s, it) => s + it.price_cents, 0);
  if (
    Math.abs(sumAsLineTotal - r.subtotal_cents) <= SUBTOTAL_TOLERANCE_CENTS
  ) {
    // The parser stored line totals. Divide each by quantity to recover the
    // unit price; round to the nearest cent. Skip lines where qty doesn't
    // divide evenly — those are likely already correct unit prices that just
    // happen to live alongside misparsed siblings.
    const fixed = r.items.map((it) => {
      if (it.quantity <= 1) return it;
      if (it.price_cents % it.quantity !== 0) return it;
      return { ...it, price_cents: Math.round(it.price_cents / it.quantity) };
    });
    return { ...r, items: fixed };
  }

  // Neither interpretation matches the subtotal. Don't guess — return as-is
  // so the user can correct on the validate step.
  return r;
}
