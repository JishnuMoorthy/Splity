-- v2 features: per-item share %, payer-assigned name, custom-amount claims, receipt storage path

alter table claims
  add column if not exists custom_amount_cents int;

alter table claim_items
  add column if not exists share_percent int not null default 100
    check (share_percent in (25, 50, 75, 100));

alter table bill_items
  add column if not exists assigned_to text;

alter table bills
  add column if not exists receipt_path text;
