create table if not exists public.store_sync_meta (
  id text primary key,
  backoffice_state_version bigint not null default 0,
  public_state_version bigint not null default 0,
  backoffice_snapshot_version bigint not null default 0,
  public_snapshot_version bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_store_sync_meta_updated_at on public.store_sync_meta;
create trigger set_store_sync_meta_updated_at
before update on public.store_sync_meta
for each row
execute function public.set_updated_at();

alter table public.store_sync_meta enable row level security;

insert into public.store_sync_meta (
  id,
  backoffice_state_version,
  public_state_version,
  backoffice_snapshot_version,
  public_snapshot_version
)
values ('default', 0, 0, 0, 0)
on conflict (id) do nothing;
