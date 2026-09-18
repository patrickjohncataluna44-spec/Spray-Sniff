-- Migration: Create product_categories table for central category management across Client, Staff, and Admin
-- Creates table, seeds default and catalog categories, enables RLS, and adds to realtime publication

create table if not exists public.product_categories (
  id text primary key,
  name text not null unique,
  slug text not null unique,
  description text null,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Trigger for updated_at
drop trigger if exists set_product_categories_updated_at on public.product_categories;
create trigger set_product_categories_updated_at
before update on public.product_categories
for each row
execute function public.set_updated_at();

-- Enable Row Level Security
alter table public.product_categories enable row level security;

-- RLS Policy: Anyone (anon customers, staff, admins) can view categories
drop policy if exists "product_categories_select_public" on public.product_categories;
create policy "product_categories_select_public"
on public.product_categories
for select
to anon, authenticated
using (true);

-- RLS Policy: Staff and Admins can insert new categories
drop policy if exists "product_categories_insert_backoffice" on public.product_categories;
create policy "product_categories_insert_backoffice"
on public.product_categories
for insert
to authenticated
with check (public.is_backoffice_user());

-- RLS Policy: Staff and Admins can update categories
drop policy if exists "product_categories_update_backoffice" on public.product_categories;
create policy "product_categories_update_backoffice"
on public.product_categories
for update
to authenticated
using (public.is_backoffice_user())
with check (public.is_backoffice_user());

-- RLS Policy: Only Admins can delete categories
drop policy if exists "product_categories_delete_admin" on public.product_categories;
create policy "product_categories_delete_admin"
on public.product_categories
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  )
);

-- Seed default product categories
insert into public.product_categories (id, name, slug, is_system)
values
  ('cat_bath_and_body_works', 'Bath & Body Works', 'bath-and-body-works', true),
  ('cat_victorias_secret', 'Victoria''s Secret', 'victorias-secret', true),
  ('cat_katy_perry', 'Katy Perry', 'katy-perry', true),
  ('cat_nicki_minaj', 'Nicki Minaj', 'nicki-minaj', true),
  ('cat_britney_spears', 'Britney Spears', 'britney-spears', true),
  ('cat_sarah_jessica_parker', 'Sarah Jessica Parker', 'sarah-jessica-parker', true),
  ('cat_kim_kardashian', 'Kim Kardashian', 'kim-kardashian', true),
  ('cat_mardussia', 'Mardussia', 'mardussia', true),
  ('cat_charlie', 'Charlie', 'charlie', true)
on conflict (name) do nothing;

-- Also seed any distinct categories currently found in catalog_products
insert into public.product_categories (id, name, slug, is_system)
select
  'cat_' || md5(lower(trim(category))) as id,
  trim(category) as name,
  lower(regexp_replace(regexp_replace(trim(category), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')) as slug,
  false as is_system
from public.catalog_products
where trim(category) <> ''
group by trim(category)
on conflict (name) do nothing;

-- Ensure replica identity full for realtime updates
alter table public.product_categories replica identity full;

-- Add product_categories to supabase_realtime publication if not already added
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'product_categories'
  ) then
    alter publication supabase_realtime add table public.product_categories;
  end if;
end;
$$;
