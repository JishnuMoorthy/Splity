-- Country-aware payment methods. US payers keep using Venmo/Zelle/Cash App.
-- Indian payers use UPI (any UPI app: GPay, PhonePe, BHIM…) and/or PayTM phone.
alter table payers
  add column if not exists country text not null default 'US'
    check (country in ('US', 'IN')),
  add column if not exists upi_id text,
  add column if not exists paytm_phone text;
