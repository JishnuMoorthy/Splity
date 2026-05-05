import { describe, expect, it } from "vitest";
import { venmoUrl, cashAppUrl, upiUrl, paytmUrl } from "./payment-links";

describe("venmoUrl", () => {
  it("strips leading @ and url-encodes the note", () => {
    const url = venmoUrl({
      handle: "@joe-payer",
      amountCents: 1234,
      note: "Joe's Pizza (via Splity)",
    });
    expect(url).toMatch(/^https:\/\/venmo\.com\/joe-payer\?txn=pay/);
    expect(url).toContain("amount=12.34");
    expect(url).toContain("note=Joe's%20Pizza%20(via%20Splity)");
  });
});

describe("cashAppUrl", () => {
  it("strips leading $ and formats amount", () => {
    const url = cashAppUrl({ handle: "$joecash", amountCents: 999 });
    expect(url).toBe("https://cash.app/$joecash/9.99");
  });
});

describe("upiUrl", () => {
  it("builds a valid UPI deep link with INR currency", () => {
    const url = upiUrl({
      vpa: "joe@oksbi",
      payeeName: "Joe Payer",
      amountCents: 25000,
      note: "Pizza",
    });
    expect(url.startsWith("upi://pay?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("pa")).toBe("joe@oksbi");
    expect(params.get("pn")).toBe("Joe Payer");
    expect(params.get("am")).toBe("250.00");
    expect(params.get("cu")).toBe("INR");
    expect(params.get("tn")).toBe("Pizza");
  });

  it("formats fractional amounts to two decimals", () => {
    const url = upiUrl({
      vpa: "x@y",
      payeeName: "X",
      amountCents: 50,
      note: "n",
    });
    expect(url).toContain("am=0.50");
  });
});

describe("paytmUrl", () => {
  it("builds a paytm-VPA UPI link from a phone", () => {
    const url = paytmUrl({
      phone: "+91 98765 43210",
      payeeName: "Joe",
      amountCents: 12345,
      note: "Lunch",
    });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("pa")).toBe("919876543210@paytm");
    expect(params.get("am")).toBe("123.45");
    expect(params.get("cu")).toBe("INR");
  });

  it("strips non-digits before constructing the VPA", () => {
    const url = paytmUrl({
      phone: "(555) 123-4567",
      payeeName: "x",
      amountCents: 100,
      note: "n",
    });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("pa")).toBe("5551234567@paytm");
  });
});
