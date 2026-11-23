-- Independent appointment records with immutable edit and review snapshots.
create table private.enl_supervisor_appointments (
  site_id text not null references public.enl_site_master(site_id),
  document_id uuid not null,
  revision integer not null check (revision > 0),
  site_name text not null,
  appointment jsonb not null check (jsonb_typeof(appointment) = 'object'),
  event text not null check (event in ('save','submit','approve','reopen')),
  photo_revision integer,
  print_jpeg bytea check (octet_length(print_jpeg) between 4 and 350000),
  actor_id text not null,
  actor_name text not null,
  saved_at timestamptz not null default now(),
  primary key (site_id,document_id,revision),
  foreign key (site_id,document_id,photo_revision)
    references private.enl_supervisor_appointments(site_id,document_id,revision)
);
alter table private.enl_supervisor_appointments enable row level security;
revoke all on private.enl_supervisor_appointments from public,anon,authenticated;
grant select,insert on private.enl_supervisor_appointments to service_role;
-- Provision the uploaded artwork privately in enl_org_templates under
-- supervisor-appointment-v1. The original includes an existing corporate seal.
