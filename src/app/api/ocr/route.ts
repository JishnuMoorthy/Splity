import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseReceipt, ParsedReceiptSchema, type ReceiptMediaType } from "@/lib/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP, GIF, or PDF" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 12 MB)" },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");

  // Upload to Storage in parallel with OCR; both can succeed/fail independently.
  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";
  const path = `${user.id}/${randomUUID()}.${ext}`;
  const svc = createServiceClient();
  const upload = svc.storage
    .from("receipts")
    .upload(path, buf, { contentType: file.type, upsert: false });

  try {
    const [parsed, uploadRes] = await Promise.all([
      parseReceipt({
        fileBase64: base64,
        mediaType: file.type as ReceiptMediaType,
      }),
      upload,
    ]);
    return NextResponse.json({
      parsed: ParsedReceiptSchema.parse(parsed),
      receipt_path: uploadRes.error ? null : path,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OCR failed";
    return NextResponse.json(
      { error: `Couldn't read receipt: ${msg}` },
      { status: 422 }
    );
  }
}
