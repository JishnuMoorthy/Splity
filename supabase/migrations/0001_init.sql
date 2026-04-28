-- Splity initial schema (CLAUDE.md §4)
-- Run in Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- Bill payers
create table if not exists payers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  phone text unique not null,
  display_name text not null,
  venmo_handle text,
  zelle_contact text,
  cashapp_handle text,
  created_at timestamptz not null default now()
);

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,
  payer_id uuid not null references payers(id) on delete cascade,
  receipt_image_path text,
  restaurant_name text,
  subtotal_cents integer not null,
  tax_cents integer not null default 0,
  tip_cents integer not null default 0,
  total_cents integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index if not exists bills_short_id_idx on bills(short_id);
create index if not exists bills_payer_id_idx on bills(payer_id);

create table if not exists bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  name text not null,
  price_cents integer not null,
  quantity integer not null default 1,
  is_shared boolean not null default false,
  position integer not null
);
create index if not exists bill_items_bill_id_idx on bill_items(bill_id);

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  claimer_name text,
  claimer_session_id text not null,
  total_cents integer not null,
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists claims_bill_id_idx on claims(bill_id);
create unique index if not exists claims_bill_session_idx on claims(bill_id, claimer_session_id);

create table if not exists claim_items (
  claim_id uuid not null references claims(id) on delete cascade,
  item_id uuid not null references bill_items(id) on delete cascade,
  share_fraction numeric(5,4) not null default 1.0,
  primary key (claim_id, item_id)
);

-- Receipts storage bucket (private)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- =====================================================================
-- Row Level Security
-- All public reads/writes go through SECURITY DEFINER server routes,
-- so we lock down direct anon access tightly.
-- =====================================================================

alter table payers      enable row level security;
alter table bills       enable row level security;
alter table bill_items  enable row level security;
alter table claims      enable row level security;
alter table claim_items enable row level security;

-- payers: only the owning auth user can see/update their row
drop policy if exists payers_self_read on payers;
create policy payers_self_read on payers
  for select using (auth.uid() = user_id);

drop policy if exists payers_self_insert on payers;
create policy payers_self_insert on payers
  for insert with check (auth.uid() = user_id);

drop policy if exists payers_self_update on payers;
create policy payers_self_update on payers
  for update using (auth.uid() = user_id);

-- bills: payer can read/write their own bills
drop policy if exists bills_owner_all on bills;
create policy bills_owner_all on bills
  for all using (
    payer_id in (select id from payers where user_id = auth.uid())
  )
  with check (
    payer_id in (select id from payers where user_id = auth.uid())
  );

-- bill_items: same as bills
drop policy if exists bill_items_owner_all on bill_items;
create policy bill_items_owner_all on bill_items
  for all using (
    bill_id in (
      select b.id from bills b
      join payers p on p.id = b.payer_id
      where p.user_id = auth.uid()
    )
  )
  with check (
    bill_id in (
      select b.id from bills b
      join payers p on p.id = b.payer_id
      where p.user_id = auth.uid()
    )
  );

-- claims: bill owner can read all claims on their bills
drop policy if exists claims_owner_read on claims;
create policy claims_owner_read on claims
  for select using (
    bill_id in (
      select b.id from bills b
      join payers p on p.id = b.payer_id
      where p.user_id = auth.uid()
    )
  );

-- claim_items: same
drop policy if exists claim_items_owner_read on claim_items;
create policy claim_items_owner_read on claim_items
  for select using (
    claim_id in (
      select c.id from claims c
      join bills b on b.id = c.bill_id
      join payers p on p.id = b.payer_id
      where p.user_id = auth.uid()
    )
  );

-- Public (anon) access to bills/items/claims is provided exclusively via
-- server routes using the service role key. No anon policies needed.
