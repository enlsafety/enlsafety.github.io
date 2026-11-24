-- Append-only certificate versions linked to an exact appointment snapshot.
create table private.enl_supervisor_certificates (
  site_id text not null references public.enl_site_master(site_id),
  certificate_id uuid not null,
  revision integer not null check (revision > 0),
  appointment_id uuid not null,
  appointment_revision integer not null,
  appointment jsonb not null check (jsonb_typeof(appointment) = 'object'),
  completed_on date not null,
  photo_revision integer not null,
  photo_jpeg bytea check (octet_length(photo_jpeg) between 4 and 350000),
  actor_id text not null,
  actor_name text not null,
  saved_at timestamptz not null default now(),
  primary key (site_id,certificate_id,revision),
  foreign key (site_id,appointment_id,appointment_revision)
    references private.enl_supervisor_appointments(site_id,document_id,revision),
  foreign key (site_id,certificate_id,photo_revision)
    references private.enl_supervisor_certificates(site_id,certificate_id,revision),
  check ((photo_revision=revision and photo_jpeg is not null) or (photo_revision<revision and photo_jpeg is null))
);
create index enl_supervisor_certificates_appointment_idx on private.enl_supervisor_certificates(site_id,appointment_id,appointment_revision);
alter table private.enl_supervisor_certificates enable row level security;
revoke all on private.enl_supervisor_certificates from public,anon,authenticated;
grant select,insert on private.enl_supervisor_certificates to service_role;
