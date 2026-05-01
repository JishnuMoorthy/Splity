-- Add `units` to claim_items so payees can claim a specific count on
-- multi-quantity lines (e.g. "I had 3 of the 14 Guinness").
-- For qty=1 items, units stays in (0.25, 0.5, 0.75, 1.0) and is the same
-- semantic as the legacy share_percent column.
alter table claim_items
  add column if not exists units numeric(10,2) not null default 1.0;

-- Backfill existing rows from share_percent.
update claim_items
  set units = (share_percent::numeric / 100.0)
  where share_percent is not null
    and units = 1.0;

-- Constrain to non-negative (we never claim a negative count).
alter table claim_items
  drop constraint if exists claim_items_units_nonneg;
alter table claim_items
  add constraint claim_items_units_nonneg check (units > 0);
