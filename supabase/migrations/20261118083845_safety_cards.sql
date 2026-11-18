-- Workbook values stay behind the authenticated service and site scope.
create table private.enl_safety_cards (
  site_id text not null references public.enl_site_master(site_id),
  revision integer not null check(revision>0),
  template_version text not null,
  content jsonb not null check(jsonb_typeof(content)='object'),
  source text not null check(source in ('import','edit')),
  actor_id text not null,
  actor_name text not null,
  saved_at timestamptz not null default now(),
  primary key(site_id,revision)
);
alter table private.enl_safety_cards enable row level security;
revoke all on private.enl_safety_cards from public,anon,authenticated;
grant select,insert on private.enl_safety_cards to service_role;
