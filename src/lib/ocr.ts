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

const PARSING_PROMPT = `You are a receipt parser. Look at the receipt image and extract line items, tax, tip, and total.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
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
- Do not invent items not present on the receipt.
- If a single line shows quantity > 1 with a unit price, set quantity accordingly and price_cents to the LINE total.`;

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
  return ParsedReceiptSchema.parse(parsed);
}
