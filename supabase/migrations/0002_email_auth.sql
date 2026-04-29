-- Switch payers.phone to optional and add email field, since email magic link
-- is the primary auth path for MVP (Twilio not available yet).

alter table payers alter column phone drop not null;
alter table payers add column if not exists email text;
create unique index if not exists payers_email_idx on payers(email)
  where email is not null;
