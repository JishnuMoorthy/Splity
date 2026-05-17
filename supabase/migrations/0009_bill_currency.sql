-- Snapshot each bill's currency at creation time so a payer switching
-- country later doesn't retroactively reformat historical bills.
alter table bills
  add column if not exists currency text not null default 'USD'
    check (currency in ('USD', 'INR'));
