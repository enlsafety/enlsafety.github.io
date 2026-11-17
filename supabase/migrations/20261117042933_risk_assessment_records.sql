-- Evaluations are separate from folder metadata and organization documents.
create table private.enl_risk_records (
 site_id text not null references public.enl_site_master(site_id),
 kind text not null check(kind in ('initial','regular')),
 period text not null,
 template_id text not null check(template_id in ('course','landscape','sprinkler','pest','office')),
 revision integer not null check(revision>0),
 template_version text not null,
 content jsonb not null check(jsonb_typeof(content)='object'),
 state text not null check(state in ('draft','completed')),
 actor_id text not null,
 actor_name text not null,
 saved_at timestamptz not null default now(),
 primary key(site_id,kind,period,template_id,revision),
 check((kind='initial' and period='initial') or (kind='regular' and period ~ '^[12][0-9]{3}$'))
);
create table private.enl_risk_photos (
 site_id text not null references public.enl_site_master(site_id),
 id text not null check(id ~ '^[a-f0-9]{64}$'),
 mime text not null check(mime in ('image/jpeg','image/png')),
 bytes bytea not null check(octet_length(bytes) between 1 and 350000),
 actor_id text not null,
 created_at timestamptz not null default now(),
 primary key(site_id,id)
);
alter table private.enl_risk_records enable row level security;
alter table private.enl_risk_photos enable row level security;
revoke all on private.enl_risk_records,private.enl_risk_photos from public,anon,authenticated;
grant select,insert on private.enl_risk_records,private.enl_risk_photos to service_role;
