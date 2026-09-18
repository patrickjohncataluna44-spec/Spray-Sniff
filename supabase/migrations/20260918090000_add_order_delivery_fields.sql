-- Delivery management is admin-only. These columns hold the courier details an
-- admin enters on Admin -> Orders, plus enough audit context on each timeline
-- entry to show who recorded a delivery update and what it moved from.

alter table public.store_orders
  add column if not exists courier text null,
  add column if not exists tracking_number text null,
  add column if not exists delivery_notes text null;

alter table public.order_timeline_entries
  add column if not exists actor_name text null,
  add column if not exists previous_status text null;

create index if not exists store_orders_tracking_number_idx
  on public.store_orders (lower(tracking_number))
  where tracking_number is not null;
