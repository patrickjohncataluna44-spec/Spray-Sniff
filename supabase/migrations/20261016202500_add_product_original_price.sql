-- Migration: Add original_price column to catalog_products for sale / discount pricing
-- Enables compare-at price (e.g. was ₱1300, now ₱500) with sale badges

alter table public.catalog_products
  add column if not exists original_price numeric null;

comment on column public.catalog_products.original_price is 'Original / compare-at price before discount. If original_price > price, item is on sale.';
