-- Migration: Update delivery fulfillment stages and comments
-- Standardized Ecommerce Delivery Stages:
-- 1. Pending           -> Order Placed
-- 2. Processing        -> Preparing to Ship (Packaging/Inventory Allocated)
-- 3. Shipped           -> Picked Up by Courier (Handed to LBC/courier)
-- 4. In Transit        -> In Transit (Hub/Sorting Center)
-- 5. Out for Delivery  -> Out for Delivery (Rider assigned for delivery)
-- 6. Delivered         -> Delivered (Completed)

alter table public.store_orders
  add column if not exists courier text null,
  add column if not exists tracking_number text null,
  add column if not exists delivery_notes text null;

comment on column public.store_orders.courier is 'Courier partner name (e.g., LBC, J&T Express, Ninja Van)';
comment on column public.store_orders.tracking_number is 'Waybill / tracking number issued by the courier partner';
comment on column public.store_orders.delivery_notes is 'Special delivery instructions or logistics updates';

create index if not exists store_orders_tracking_number_idx
  on public.store_orders (lower(tracking_number))
  where tracking_number is not null;

alter table public.order_timeline_entries
  add column if not exists actor_name text null,
  add column if not exists previous_status text null;

comment on column public.order_timeline_entries.actor_name is 'Name of the admin or staff who logged the status update';
comment on column public.order_timeline_entries.previous_status is 'The previous order status prior to this update';
