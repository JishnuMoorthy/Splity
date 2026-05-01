-- Two-step payment confirmation. claims.paid_at retains its meaning as
-- "the payee said they sent the money"; payer_confirmed_at is the
-- payer's separate acknowledgment that the money arrived.
alter table claims
  add column if not exists payer_confirmed_at timestamptz;

create index if not exists claims_bill_payer_confirmed_idx
  on claims (bill_id) where payer_confirmed_at is not null;
