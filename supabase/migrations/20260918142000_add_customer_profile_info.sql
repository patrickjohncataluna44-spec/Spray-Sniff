-- Migration: Add customer profile fields with validation
-- Fields: phone (contact number), birthdate, age, address, city, postal_code
-- Used for customer personal information, shipping autofill, and validation.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists birthdate date,
  add column if not exists age integer,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists postal_code text;

-- Add constraint to ensure age is non-negative and realistic if provided
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'check_customer_age_valid'
  ) then
    alter table public.profiles
      add constraint check_customer_age_valid
      check (age is null or (age >= 10 and age <= 125));
  end if;
end;
$$;
