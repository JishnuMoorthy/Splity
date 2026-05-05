// Payment deep links (CLAUDE.md §9). All inputs URL-encoded server-side.

export function venmoUrl(opts: {
  handle: string;
  amountCents: number;
  note: string;
}): string {
  const handle = opts.handle.replace(/^@/, "");
  const amount = (opts.amountCents / 100).toFixed(2);
  const note = encodeURIComponent(opts.note);
  return `https://venmo.com/${encodeURIComponent(
    handle
  )}?txn=pay&amount=${amount}&note=${note}`;
}

export function cashAppUrl(opts: {
  handle: string;
  amountCents: number;
}): string {
  const handle = opts.handle.replace(/^\$/, "");
  const amount = (opts.amountCents / 100).toFixed(2);
  return `https://cash.app/$${encodeURIComponent(handle)}/${amount}`;
}

// Universal UPI deep link — opens any UPI app on Android (GPay, PhonePe,
// PayTM, BHIM, …). On iOS, browsers prompt with the installed UPI app.
export function upiUrl(opts: {
  vpa: string;
  payeeName: string;
  amountCents: number;
  note: string;
}): string {
  const amount = (opts.amountCents / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payeeName,
    am: amount,
    cu: "INR",
    tn: opts.note,
  });
  return `upi://pay?${params.toString()}`;
}

// PayTM uses phone-as-VPA (`<phone>@paytm`) under the hood. Same UPI rail.
export function paytmUrl(opts: {
  phone: string;
  payeeName: string;
  amountCents: number;
  note: string;
}): string {
  const phone = opts.phone.replace(/\D/g, "");
  return upiUrl({
    vpa: `${phone}@paytm`,
    payeeName: opts.payeeName,
    amountCents: opts.amountCents,
    note: opts.note,
  });
}
