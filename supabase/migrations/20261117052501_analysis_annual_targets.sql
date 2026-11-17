create table private.enl_analysis_targets (
 target_year integer not null check(target_year between 2001 and 2101),
 site_scope text not null default '',
 revision integer not null check(revision>0),
 content jsonb not null check(jsonb_typeof(content)='object'),
 actor_id text not null, actor_name text not null,
 saved_at timestamptz not null default now(),
 primary key(target_year,site_scope,revision)
);
alter table private.enl_analysis_targets enable row level security;
revoke all on private.enl_analysis_targets from public,anon,authenticated;
grant select,insert on private.enl_analysis_targets to service_role;
