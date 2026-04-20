do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('ADMIN', 'STAFF', 'USER');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  role public.user_role not null default 'USER',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_store_snapshots (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.public_store_snapshots (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.catalog_products (
  id text primary key,
  name text not null,
  brand text not null,
  description text not null default '',
  price numeric not null default 0,
  category text not null default '',
  scent_family text[] not null default '{}',
  gender text not null default 'unisex',
  top_notes text[] not null default '{}',
  middle_notes text[] not null default '{}',
  base_notes text[] not null default '{}',
  longevity integer not null default 0,
  intensity integer not null default 0,
  sizes jsonb not null default '[]'::jsonb,
  images text[] not null default '{}',
  rating numeric not null default 0,
  review_count integer not null default 0,
  in_stock boolean not null default false,
  featured boolean not null default false,
  is_new_arrival boolean not null default false,
  occasions text[] not null default '{}',
  seasons text[] not null default '{}',
  related_products text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_items (
  product_id text primary key references public.catalog_products (id) on delete cascade,
  sku text not null,
  stock integer not null default 0,
  reorder_point integer not null default 0,
  location text not null default '',
  last_updated timestamptz not null default timezone('utc', now()),
  last_updated_by text null,
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_orders (
  id text primary key,
  source text not null check (source in ('ONLINE', 'POS')),
  customer_id uuid null references public.profiles (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  status text not null,
  payment_method text not null,
  payment_status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  shipping numeric not null default 0,
  total numeric not null default 0,
  shipping_address text null,
  notes text null
);

create table if not exists public.store_order_items (
  id text primary key,
  order_id text not null references public.store_orders (id) on delete cascade,
  product_id text not null,
  product_name text not null,
  size_ml integer not null,
  quantity integer not null,
  unit_price numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_timeline_entries (
  id text primary key,
  order_id text not null references public.store_orders (id) on delete cascade,
  status text not null,
  created_at timestamptz not null,
  note text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pos_transactions (
  id text primary key,
  order_id text not null references public.store_orders (id) on delete cascade,
  cashier_name text not null,
  payment_method text not null,
  created_at timestamptz not null,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  items_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_records (
  id text primary key,
  order_id text not null unique references public.store_orders (id) on delete cascade,
  source text not null check (source in ('ONLINE', 'POS')),
  customer_id uuid null references public.profiles (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  amount numeric not null default 0,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  shipping numeric not null default 0,
  payment_method text not null,
  payment_gateway text null,
  payment_channel text null,
  checkout_session_id text null,
  reference text null,
  status text not null default 'succeeded' check (status in ('succeeded')),
  paid_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_movements (
  id text primary key,
  product_id text not null,
  product_name text not null,
  change_quantity integer not null,
  reason text not null,
  actor text not null,
  created_at timestamptz not null,
  resulting_stock integer not null default 0,
  note text null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_carts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_wishlists (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  product_ids text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.promotions (
  id text primary key,
  code text not null unique,
  type text not null check (type in ('Percentage', 'Fixed')),
  discount numeric not null,
  used_count integer not null default 0,
  usage_limit integer null,
  status text not null check (status in ('Draft', 'Scheduled', 'Active', 'Paused', 'Expired')),
  starts_at date not null,
  expires_at date not null,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'Customer'),
    'USER'
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.profiles.name, excluded.name);

  return new;
end;
$$;

create or replace function public.is_backoffice_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('ADMIN', 'STAFF')
  );
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_store_snapshots_updated_at on public.app_store_snapshots;
create trigger set_store_snapshots_updated_at
before update on public.app_store_snapshots
for each row
execute function public.set_updated_at();

drop trigger if exists set_public_store_snapshots_updated_at on public.public_store_snapshots;
create trigger set_public_store_snapshots_updated_at
before update on public.public_store_snapshots
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_products_updated_at on public.catalog_products;
create trigger set_catalog_products_updated_at
before update on public.catalog_products
for each row
execute function public.set_updated_at();

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_store_orders_updated_at on public.store_orders;
create trigger set_store_orders_updated_at
before update on public.store_orders
for each row
execute function public.set_updated_at();

drop trigger if exists set_store_order_items_updated_at on public.store_order_items;
create trigger set_store_order_items_updated_at
before update on public.store_order_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_order_timeline_entries_updated_at on public.order_timeline_entries;
create trigger set_order_timeline_entries_updated_at
before update on public.order_timeline_entries
for each row
execute function public.set_updated_at();

drop trigger if exists set_pos_transactions_updated_at on public.pos_transactions;
create trigger set_pos_transactions_updated_at
before update on public.pos_transactions
for each row
execute function public.set_updated_at();

drop trigger if exists set_payment_records_updated_at on public.payment_records;
create trigger set_payment_records_updated_at
before update on public.payment_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_stock_movements_updated_at on public.stock_movements;
create trigger set_stock_movements_updated_at
before update on public.stock_movements
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_carts_updated_at on public.user_carts;
create trigger set_user_carts_updated_at
before update on public.user_carts
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_wishlists_updated_at on public.user_wishlists;
create trigger set_user_wishlists_updated_at
before update on public.user_wishlists
for each row
execute function public.set_updated_at();

drop trigger if exists set_promotions_updated_at on public.promotions;
create trigger set_promotions_updated_at
before update on public.promotions
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_profile();

alter table public.profiles enable row level security;
alter table public.app_store_snapshots enable row level security;
alter table public.public_store_snapshots enable row level security;
alter table public.catalog_products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.order_timeline_entries enable row level security;
alter table public.pos_transactions enable row level security;
alter table public.payment_records enable row level security;
alter table public.stock_movements enable row level security;
alter table public.user_carts enable row level security;
alter table public.user_wishlists enable row level security;
alter table public.promotions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_select_backoffice" on public.profiles;
create policy "profiles_select_backoffice"
on public.profiles
for select
to authenticated
using (public.is_backoffice_user());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "store_snapshots_select_backoffice" on public.app_store_snapshots;
create policy "store_snapshots_select_backoffice"
on public.app_store_snapshots
for select
to authenticated
using (public.is_backoffice_user());

drop policy if exists "public_store_snapshots_select_public" on public.public_store_snapshots;
create policy "public_store_snapshots_select_public"
on public.public_store_snapshots
for select
to anon, authenticated
using (true);

drop policy if exists "catalog_products_select_public" on public.catalog_products;
create policy "catalog_products_select_public"
on public.catalog_products
for select
to anon, authenticated
using (true);

drop policy if exists "inventory_items_select_public" on public.inventory_items;
create policy "inventory_items_select_public"
on public.inventory_items
for select
to anon, authenticated
using (true);

drop policy if exists "store_orders_select_backoffice" on public.store_orders;
create policy "store_orders_select_backoffice"
on public.store_orders
for select
to authenticated
using (public.is_backoffice_user());

drop policy if exists "store_orders_select_own" on public.store_orders;
create policy "store_orders_select_own"
on public.store_orders
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "store_order_items_select_backoffice" on public.store_order_items;
create policy "store_order_items_select_backoffice"
on public.store_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where public.store_orders.id = order_id
      and public.is_backoffice_user()
  )
);

drop policy if exists "store_order_items_select_own" on public.store_order_items;
create policy "store_order_items_select_own"
on public.store_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where public.store_orders.id = order_id
      and public.store_orders.customer_id = auth.uid()
  )
);

drop policy if exists "order_timeline_entries_select_backoffice" on public.order_timeline_entries;
create policy "order_timeline_entries_select_backoffice"
on public.order_timeline_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where public.store_orders.id = order_id
      and public.is_backoffice_user()
  )
);

drop policy if exists "order_timeline_entries_select_own" on public.order_timeline_entries;
create policy "order_timeline_entries_select_own"
on public.order_timeline_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where public.store_orders.id = order_id
      and public.store_orders.customer_id = auth.uid()
  )
);

drop policy if exists "pos_transactions_select_backoffice" on public.pos_transactions;
create policy "pos_transactions_select_backoffice"
on public.pos_transactions
for select
to authenticated
using (public.is_backoffice_user());

drop policy if exists "payment_records_select_backoffice" on public.payment_records;
create policy "payment_records_select_backoffice"
on public.payment_records
for select
to authenticated
using (public.is_backoffice_user());

drop policy if exists "payment_records_select_own" on public.payment_records;
create policy "payment_records_select_own"
on public.payment_records
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "stock_movements_select_backoffice" on public.stock_movements;
create policy "stock_movements_select_backoffice"
on public.stock_movements
for select
to authenticated
using (public.is_backoffice_user());

drop policy if exists "user_carts_select_own" on public.user_carts;
create policy "user_carts_select_own"
on public.user_carts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_carts_insert_own" on public.user_carts;
create policy "user_carts_insert_own"
on public.user_carts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_carts_update_own" on public.user_carts;
create policy "user_carts_update_own"
on public.user_carts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_wishlists_select_own" on public.user_wishlists;
create policy "user_wishlists_select_own"
on public.user_wishlists
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_wishlists_insert_own" on public.user_wishlists;
create policy "user_wishlists_insert_own"
on public.user_wishlists
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_wishlists_update_own" on public.user_wishlists;
create policy "user_wishlists_update_own"
on public.user_wishlists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "promotions_select_backoffice" on public.promotions;
create policy "promotions_select_backoffice"
on public.promotions
for select
to authenticated
using (public.is_backoffice_user());

alter table public.profiles replica identity full;
alter table public.app_store_snapshots replica identity full;
alter table public.public_store_snapshots replica identity full;
alter table public.catalog_products replica identity full;
alter table public.inventory_items replica identity full;
alter table public.store_orders replica identity full;
alter table public.store_order_items replica identity full;
alter table public.order_timeline_entries replica identity full;
alter table public.pos_transactions replica identity full;
alter table public.payment_records replica identity full;
alter table public.stock_movements replica identity full;
alter table public.user_carts replica identity full;
alter table public.user_wishlists replica identity full;
alter table public.promotions replica identity full;

do $$
declare
  current_table text;
  realtime_tables text[] := array[
    'profiles',
    'app_store_snapshots',
    'public_store_snapshots',
    'catalog_products',
    'inventory_items',
    'store_orders',
    'store_order_items',
    'order_timeline_entries',
    'pos_transactions',
    'payment_records',
    'stock_movements',
    'user_carts',
    'user_wishlists',
    'promotions'
  ];
begin
  foreach current_table in array realtime_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = current_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        current_table
      );
    end if;
  end loop;
end;
$$;
