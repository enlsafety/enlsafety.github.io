-- The verified field account writes a new snapshot on each save or half-year check.
create table private.enl_org_charts (
  site_id text not null references public.enl_site_master(site_id),
  revision integer not null check (revision > 0),
  site_name text not null,
  chart jsonb not null check (jsonb_typeof(chart) = 'object'),
  period text not null check (period ~ '^[0-9]{4}-[12]$'),
  confirmed boolean not null,
  actor_id text not null,
  actor_name text not null,
  saved_at timestamptz not null default now(),
  primary key (site_id, revision)
);
alter table private.enl_org_charts enable row level security;
revoke all on private.enl_org_charts from public, anon, authenticated;
grant select, insert on private.enl_org_charts to service_role;
