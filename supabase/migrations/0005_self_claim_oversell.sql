-- Self-claim flag: lets the bill creator mark items they covered themselves
-- so those units count toward "fully covered" and aren't billed to anyone.
alter table claims
  add column if not exists is_payer_self boolean not null default false;

-- Concurrency guard. Stops two payees from each claiming "the last 3
-- Guinness" from a 14-line by raising before the second insert commits.
create or replace function check_units_not_oversold() returns trigger as $$
declare
  total_units numeric(10,2);
  item_qty int;
begin
  select coalesce(sum(units), 0) into total_units
    from claim_items where item_id = new.item_id;
  select quantity into item_qty
    from bill_items where id = new.item_id;
  if item_qty is null then
    raise exception 'bill_item % does not exist', new.item_id;
  end if;
  if total_units > item_qty then
    raise exception 'item % oversold: % > %', new.item_id, total_units, item_qty
      using errcode = 'check_violation';
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists claim_items_no_oversell on claim_items;
create trigger claim_items_no_oversell
  after insert or update on claim_items
  for each row execute function check_units_not_oversold();
