import { describe, expect, it } from "vitest";
import { buildPayerNudgeEmail } from "./email";

describe("buildPayerNudgeEmail", () => {
  it("subject names the claimer, amount, and method", () => {
    const { subject } = buildPayerNudgeEmail({
      payerName: "Jishnu",
      claimerName: "Maya",
      amountCents: 2350,
      currency: "USD",
      method: "venmo",
      restaurantName: "Joe's Pizza",
      reviewUrl: "https://splity-lyart.vercel.app/me/b/abc123",
    });
    expect(subject).toBe("Maya says they paid $23.50 on Venmo");
  });

  it("INR amount renders with Rs. prefix in subject + body", () => {
    const out = buildPayerNudgeEmail({
      payerName: "Rohan",
      claimerName: "Priya",
      amountCents: 50000,
      currency: "INR",
      method: "other",
      restaurantName: "Black Orchid",
      reviewUrl: "https://splity-lyart.vercel.app/me/b/abc123",
    });
    expect(out.subject).toBe("Priya says they paid Rs. 500.00 on UPI / PayTM");
    expect(out.text).toContain("Rs. 500.00");
    expect(out.text).toContain("Black Orchid");
    expect(out.html).toContain("Rs. 500.00");
    expect(out.html).toContain("Black Orchid");
  });

  it("includes the review URL in both text and html", () => {
    const url = "https://splity-lyart.vercel.app/me/b/abc123";
    const out = buildPayerNudgeEmail({
      payerName: "X",
      claimerName: "Y",
      amountCents: 100,
      currency: "USD",
      method: "cashapp",
      restaurantName: null,
      reviewUrl: url,
    });
    expect(out.text).toContain(url);
    expect(out.html).toContain(`href="${url}"`);
  });

  it("escapes HTML in user-controlled name fields", () => {
    const out = buildPayerNudgeEmail({
      payerName: "X",
      claimerName: "<script>alert(1)</script>",
      amountCents: 100,
      currency: "USD",
      method: "venmo",
      restaurantName: 'Joe "the boss" Pizza',
      reviewUrl: "https://x.test/",
    });
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).toContain("&quot;the boss&quot;");
  });

  it("omits restaurant clause when name is null", () => {
    const out = buildPayerNudgeEmail({
      payerName: "X",
      claimerName: "Y",
      amountCents: 100,
      currency: "USD",
      method: "zelle",
      restaurantName: null,
      reviewUrl: "https://x.test/",
    });
    // The body still contains "Made for Friends" in the footer; check the
    // body sentence specifically doesn't tack a restaurant clause on.
    expect(out.text).toContain("to send you $1.00.\n");
  });

  it("includes restaurant clause when name is set", () => {
    const out = buildPayerNudgeEmail({
      payerName: "X",
      claimerName: "Y",
      amountCents: 100,
      currency: "USD",
      method: "zelle",
      restaurantName: "Joe's",
      reviewUrl: "https://x.test/",
    });
    expect(out.text).toContain("to send you $1.00 for Joe's");
  });
});
