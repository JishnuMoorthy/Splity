-- 0001 declared `phone text unique not null`. 0002 dropped not null but kept the
-- unique constraint, which blocks every email-only signup whose `phone` happens
-- to collide with another row's empty/duplicate phone value. Drop it.
alter table payers drop constraint if exists payers_phone_key;
