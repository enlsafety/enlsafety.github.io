create table if not exists private.enl_storage_dedup_runs (
 migration_id text primary key,
 manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 manifest jsonb not null,
 phase text not null default 'planned' check(phase in ('planned','verified','relinked','relinked_verified','completed')),
 backup_proof jsonb,
 removed_paths jsonb not null default '[]'::jsonb check(jsonb_typeof(removed_paths)='array'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 verified_before_at timestamptz,
 relinked_at timestamptz,
 verified_after_at timestamptz,
 completed_at timestamptz
);
create table if not exists private.enl_storage_dedup_events (
 id bigint generated always as identity primary key,
 migration_id text not null references private.enl_storage_dedup_runs(migration_id),
 actor_id text not null,
 action text not null,
 details jsonb not null,
 created_at timestamptz not null default now()
);
alter table private.enl_storage_dedup_runs enable row level security;
alter table private.enl_storage_dedup_events enable row level security;
revoke all on private.enl_storage_dedup_runs,private.enl_storage_dedup_events from public,anon,authenticated,service_role;
create or replace function private.enl_storage_dedup_events_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Storage deduplication audit is append only'; end;
$$;
revoke all on function private.enl_storage_dedup_events_immutable() from public,anon,authenticated,service_role;
drop trigger if exists enl_storage_dedup_events_immutable on private.enl_storage_dedup_events;
create trigger enl_storage_dedup_events_immutable before update or delete on private.enl_storage_dedup_events for each row execute function private.enl_storage_dedup_events_immutable();
