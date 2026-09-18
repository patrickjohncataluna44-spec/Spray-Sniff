-- Migration: Create product_reviews table for verified buyer product feedback
-- Only customers who purchased and had their orders marked as 'Delivered' are eligible to review.

create table if not exists public.product_reviews (
  id text primary key,
  product_id text not null references public.catalog_products (id) on delete cascade,
  order_id text not null references public.store_orders (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  customer_name text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint unique_customer_product_order_review unique (customer_id, product_id, order_id)
);

-- Trigger for updated_at
drop trigger if exists set_product_reviews_updated_at on public.product_reviews;
create trigger set_product_reviews_updated_at
before update on public.product_reviews
for each row
execute function public.set_updated_at();

-- Enable Row Level Security
alter table public.product_reviews enable row level security;

-- RLS Policy: Anyone can view product reviews
drop policy if exists "product_reviews_select_public" on public.product_reviews;
create policy "product_reviews_select_public"
on public.product_reviews
for select
to anon, authenticated
using (true);

-- RLS Policy: Authenticated users can insert review for their delivered order
drop policy if exists "product_reviews_insert_own_delivered" on public.product_reviews;
create policy "product_reviews_insert_own_delivered"
on public.product_reviews
for insert
to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1
    from public.store_orders o
    join public.store_order_items i on i.order_id = o.id
    where o.id = order_id
      and o.customer_id = auth.uid()
      and o.status = 'Delivered'
      and i.product_id = product_id
  )
);

-- RLS Policy: Users can update their own reviews
drop policy if exists "product_reviews_update_own" on public.product_reviews;
create policy "product_reviews_update_own"
on public.product_reviews
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

-- RLS Policy: Admins can delete inappropriate reviews
drop policy if exists "product_reviews_delete_admin" on public.product_reviews;
create policy "product_reviews_delete_admin"
on public.product_reviews
for delete
to authenticated
using (
  customer_id = auth.uid() or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  )
);

-- Realtime support
alter table public.product_reviews replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'product_reviews'
  ) then
    alter publication supabase_realtime add table public.product_reviews;
  end if;
end;
$$;
