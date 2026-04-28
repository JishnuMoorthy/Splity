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
