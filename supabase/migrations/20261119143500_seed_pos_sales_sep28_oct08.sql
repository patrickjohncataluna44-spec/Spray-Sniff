-- Migration / Seed: Staggered POS Deployment Sales (Sep 28 – Oct 8, 2026)
-- Active days: 3 | POS orders: 3 | Total units sold: 5
-- Idempotent: safe to re-run; preserves all non-seed orders and leaves inventory_items untouched.

begin;

insert into public.store_orders (
  id, source, customer_id, customer_name, customer_email, status,
  payment_method, payment_status, created_at, subtotal, tax, shipping,
  total, shipping_address, notes, courier, courier_slug, tracking_number,
  delivery_notes, parcels_last_synced_at
) values
  ('POS-31678000-50W9', 'POS', null, 'Walk-in Customer', 'walk-in@sprayandsniff.local', 'Completed', 'Cash', 'Paid', '2026-10-01T05:14:38.000Z'::timestamptz, 2605, 312.6, 0, 2917.6, null, '[POS-CASH:3000.00:82.40] [POS-REF:pos_1790831678000_h30knyz]', null, null, null, null, null),
  ('POS-98843000-EXAZ', 'POS', null, 'Mikaela', 'walk-in@sprayandsniff.local', 'Completed', 'QR Pay', 'Paid', '2026-10-04T07:27:23.000Z'::timestamptz, 1368, 164.16, 0, 1532.16, null, 'PayMongo channel: qrph | [POS-REF:pos_1791098843000_02l9y8z]', null, null, null, null, null),
  ('POS-29751000-M64U', 'POS', null, 'Denise', 'walk-in@sprayandsniff.local', 'Completed', 'Cash', 'Paid', '2026-10-08T03:22:31.000Z'::timestamptz, 2474, 296.88, 0, 2770.88, null, '[POS-CASH:3000.00:229.12] [POS-REF:pos_1791429751000_0ba5k7w]', null, null, null, null, null)
on conflict (id) do update set
  source = excluded.source,
  customer_name = excluded.customer_name,
  customer_email = excluded.customer_email,
  status = excluded.status,
  payment_method = excluded.payment_method,
  payment_status = excluded.payment_status,
  created_at = excluded.created_at,
  subtotal = excluded.subtotal,
  tax = excluded.tax,
  shipping = excluded.shipping,
  total = excluded.total,
  notes = excluded.notes;

insert into public.store_order_items (
  id, order_id, product_id, product_name, size_ml, quantity, unit_price
) values
  ('POS-31678000-50W9::item::0', 'POS-31678000-50W9', 'apple-honey-1792070640464', 'APPLE & HONEY', 236, 1, 1368),
  ('POS-31678000-50W9::item::1', 'POS-31678000-50W9', 'velvet-petals-1792071304174', 'VELVET PETALS', 250, 1, 1237),
  ('POS-98843000-EXAZ::item::0', 'POS-98843000-EXAZ', 'butterfly-1792053274356', 'Butterfly', 236, 1, 1368),
  ('POS-29751000-M64U::item::0', 'POS-29751000-M64U', 'rush-1792070953621', 'RUSH', 250, 1, 1237),
  ('POS-29751000-M64U::item::1', 'POS-29751000-M64U', 'velvet-petals-1792071304174', 'VELVET PETALS', 250, 1, 1237)
on conflict (id) do update set
  order_id = excluded.order_id,
  product_id = excluded.product_id,
  product_name = excluded.product_name,
  size_ml = excluded.size_ml,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price;

insert into public.order_timeline_entries (
  id, order_id, status, created_at, note, actor_name, previous_status
) values
  ('POS-31678000-50W9::timeline::0', 'POS-31678000-50W9', 'Completed', '2026-10-01T05:14:38.000Z'::timestamptz, 'POS transaction completed.', 'Cel', null),
  ('POS-98843000-EXAZ::timeline::0', 'POS-98843000-EXAZ', 'Completed', '2026-10-04T07:27:23.000Z'::timestamptz, 'POS transaction completed.', 'Spray & Sniff Admin', null),
  ('POS-29751000-M64U::timeline::0', 'POS-29751000-M64U', 'Completed', '2026-10-08T03:22:31.000Z'::timestamptz, 'POS transaction completed.', 'Brader', null)
on conflict (id) do update set
  order_id = excluded.order_id,
  status = excluded.status,
  created_at = excluded.created_at,
  note = excluded.note,
  actor_name = excluded.actor_name,
  previous_status = excluded.previous_status;

insert into public.pos_transactions (
  id, order_id, cashier_name, payment_method, created_at, subtotal, tax, total, items_count
) values
  ('TX-31678000-K9M6', 'POS-31678000-50W9', 'Cel', 'Cash', '2026-10-01T05:14:38.000Z'::timestamptz, 2605, 312.6, 2917.6, 2),
  ('TX-98843000-VNR8', 'POS-98843000-EXAZ', 'Spray & Sniff Admin', 'QR Pay', '2026-10-04T07:27:23.000Z'::timestamptz, 1368, 164.16, 1532.16, 1),
  ('TX-29751000-WC0A', 'POS-29751000-M64U', 'Brader', 'Cash', '2026-10-08T03:22:31.000Z'::timestamptz, 2474, 296.88, 2770.88, 2)
on conflict (id) do update set
  order_id = excluded.order_id,
  cashier_name = excluded.cashier_name,
  payment_method = excluded.payment_method,
  created_at = excluded.created_at,
  subtotal = excluded.subtotal,
  tax = excluded.tax,
  total = excluded.total,
  items_count = excluded.items_count;

insert into public.payment_records (
  id, order_id, source, customer_id, customer_name, customer_email,
  amount, subtotal, tax, shipping, payment_method, payment_gateway,
  payment_channel, checkout_session_id, reference, status, paid_at
) values
  ('POS-31678000-50W9::payment', 'POS-31678000-50W9', 'POS', null, 'Walk-in Customer', 'walk-in@sprayandsniff.local', 2917.6, 2605, 312.6, 0, 'Cash', null, null, null, 'pos_1790831678000_h30knyz', 'succeeded', '2026-10-01T05:14:38.000Z'::timestamptz),
  ('POS-98843000-EXAZ::payment', 'POS-98843000-EXAZ', 'POS', null, 'Mikaela', 'walk-in@sprayandsniff.local', 1532.16, 1368, 164.16, 0, 'QR Pay', 'PayMongo', 'qrph', null, 'pos_1791098843000_02l9y8z', 'succeeded', '2026-10-04T07:27:23.000Z'::timestamptz),
  ('POS-29751000-M64U::payment', 'POS-29751000-M64U', 'POS', null, 'Denise', 'walk-in@sprayandsniff.local', 2770.88, 2474, 296.88, 0, 'Cash', null, null, null, 'pos_1791429751000_0ba5k7w', 'succeeded', '2026-10-08T03:22:31.000Z'::timestamptz)
on conflict (id) do update set
  order_id = excluded.order_id,
  source = excluded.source,
  customer_name = excluded.customer_name,
  customer_email = excluded.customer_email,
  amount = excluded.amount,
  subtotal = excluded.subtotal,
  tax = excluded.tax,
  shipping = excluded.shipping,
  payment_method = excluded.payment_method,
  payment_gateway = excluded.payment_gateway,
  payment_channel = excluded.payment_channel,
  reference = excluded.reference,
  status = excluded.status,
  paid_at = excluded.paid_at;

do $$
declare
  v_seed_orders jsonb := '[{"id":"POS-31678000-50W9","source":"POS","customerName":"Walk-in Customer","customerEmail":"walk-in@sprayandsniff.local","status":"Completed","paymentMethod":"Cash","paymentStatus":"Paid","createdAt":"2026-10-01T05:14:38.000Z","subtotal":2605,"shipping":0,"tax":312.6,"total":2917.6,"notes":"[POS-CASH:3000.00:82.40] [POS-REF:pos_1790831678000_h30knyz]","items":[{"productId":"apple-honey-1792070640464","productName":"APPLE & HONEY","size":236,"quantity":1,"unitPrice":1368},{"productId":"velvet-petals-1792071304174","productName":"VELVET PETALS","size":250,"quantity":1,"unitPrice":1237}],"timeline":[{"status":"Completed","createdAt":"2026-10-01T05:14:38.000Z","note":"POS transaction completed.","actorName":"Cel"}]},{"id":"POS-98843000-EXAZ","source":"POS","customerName":"Mikaela","customerEmail":"walk-in@sprayandsniff.local","status":"Completed","paymentMethod":"QR Pay","paymentStatus":"Paid","createdAt":"2026-10-04T07:27:23.000Z","subtotal":1368,"shipping":0,"tax":164.16,"total":1532.16,"notes":"PayMongo channel: qrph | [POS-REF:pos_1791098843000_02l9y8z]","items":[{"productId":"butterfly-1792053274356","productName":"Butterfly","size":236,"quantity":1,"unitPrice":1368}],"timeline":[{"status":"Completed","createdAt":"2026-10-04T07:27:23.000Z","note":"POS transaction completed.","actorName":"Spray & Sniff Admin"}]},{"id":"POS-29751000-M64U","source":"POS","customerName":"Denise","customerEmail":"walk-in@sprayandsniff.local","status":"Completed","paymentMethod":"Cash","paymentStatus":"Paid","createdAt":"2026-10-08T03:22:31.000Z","subtotal":2474,"shipping":0,"tax":296.88,"total":2770.88,"notes":"[POS-CASH:3000.00:229.12] [POS-REF:pos_1791429751000_0ba5k7w]","items":[{"productId":"rush-1792070953621","productName":"RUSH","size":250,"quantity":1,"unitPrice":1237},{"productId":"velvet-petals-1792071304174","productName":"VELVET PETALS","size":250,"quantity":1,"unitPrice":1237}],"timeline":[{"status":"Completed","createdAt":"2026-10-08T03:22:31.000Z","note":"POS transaction completed.","actorName":"Brader"}]}]'::jsonb;
  v_seed_pos_tx jsonb := '[{"id":"TX-31678000-K9M6","orderId":"POS-31678000-50W9","cashierName":"Cel","paymentMethod":"Cash","createdAt":"2026-10-01T05:14:38.000Z","subtotal":2605,"tax":312.6,"total":2917.6,"itemsCount":2},{"id":"TX-98843000-VNR8","orderId":"POS-98843000-EXAZ","cashierName":"Spray & Sniff Admin","paymentMethod":"QR Pay","createdAt":"2026-10-04T07:27:23.000Z","subtotal":1368,"tax":164.16,"total":1532.16,"itemsCount":1},{"id":"TX-29751000-WC0A","orderId":"POS-29751000-M64U","cashierName":"Brader","paymentMethod":"Cash","createdAt":"2026-10-08T03:22:31.000Z","subtotal":2474,"tax":296.88,"total":2770.88,"itemsCount":2}]'::jsonb;
  v_existing_state jsonb;
  v_preserved_orders jsonb;
  v_preserved_pos_tx jsonb;
  v_merged_orders jsonb;
  v_merged_pos_tx jsonb;
begin
  select state into v_existing_state
  from public.app_store_snapshots
  where id = 'default';

  if v_existing_state is null then
    v_existing_state := '{}'::jsonb;
  end if;

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_preserved_orders
  from jsonb_array_elements(coalesce(v_existing_state->'orders', '[]'::jsonb)) as elem
  where coalesce(elem->>'id', '') not like 'POS-SEED-%'
    and coalesce(elem->>'id', '') not in (
      select s_elem->>'id' from jsonb_array_elements(v_seed_orders) as s_elem
    );

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_preserved_pos_tx
  from jsonb_array_elements(coalesce(v_existing_state->'posTransactions', '[]'::jsonb)) as elem
  where coalesce(elem->>'id', '') not like 'TX-SEED-%'
    and coalesce(elem->>'id', '') not in (
      select t_elem->>'id' from jsonb_array_elements(v_seed_pos_tx) as t_elem
    );

  select coalesce(jsonb_agg(elem order by (elem->>'createdAt')::timestamptz desc), '[]'::jsonb)
  into v_merged_orders
  from jsonb_array_elements(v_preserved_orders || v_seed_orders) as elem;

  select coalesce(jsonb_agg(elem order by (elem->>'createdAt')::timestamptz desc), '[]'::jsonb)
  into v_merged_pos_tx
  from jsonb_array_elements(v_preserved_pos_tx || v_seed_pos_tx) as elem;

  insert into public.app_store_snapshots (id, state)
  values (
    'default',
    jsonb_set(
      jsonb_set(v_existing_state, '{orders}', v_merged_orders, true),
      '{posTransactions}',
      v_merged_pos_tx,
      true
    )
  )
  on conflict (id) do update set
    state = excluded.state,
    updated_at = timezone('utc', now());

  insert into public.store_sync_meta (
    id, backoffice_state_version, public_state_version,
    backoffice_snapshot_version, public_snapshot_version, updated_at
  ) values (
    'default', 1, 1, 1, 1, timezone('utc', now())
  )
  on conflict (id) do update set
    backoffice_state_version = public.store_sync_meta.backoffice_state_version + 1,
    public_state_version = public.store_sync_meta.public_state_version + 1,
    backoffice_snapshot_version = public.store_sync_meta.backoffice_snapshot_version + 1,
    public_snapshot_version = public.store_sync_meta.public_snapshot_version + 1,
    updated_at = timezone('utc', now());
end $$;

commit;
