-- Additive dashboard storage. No incident/account data is modified.
create table if not exists private.enl_hub_content (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('notice','event')),
 title text not null check(length(title) between 1 and 150), body text not null default '',
 label text not null default 'info' check(label in ('important','info','general')),
 site_id text, starts_at timestamptz, ends_at timestamptz,
 revision integer not null default 1, created_by text not null, updated_by text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 check(kind='notice' or (starts_at is not null and ends_at is not null and ends_at>=starts_at))
);
create index if not exists enl_hub_content_active on private.enl_hub_content(kind,starts_at,created_at desc) where archived_at is null;
create table if not exists private.enl_hub_preferences (
 actor_key text primary key, favorites jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists private.enl_hub_content_audit (
 id bigint generated always as identity primary key, content_id uuid not null,
 action text not null, actor_id text not null, actor_name text not null,
 happened_at timestamptz not null default now(), before_record jsonb, after_record jsonb
);
alter table private.enl_hub_content enable row level security;
alter table private.enl_hub_preferences enable row level security;
alter table private.enl_hub_content_audit enable row level security;
revoke all on private.enl_hub_content,private.enl_hub_preferences,private.enl_hub_content_audit from public,anon,authenticated;
-- Existing role/state/preview settings stay intact. Reference order is the new initial layout.
update private.enl_platform_catalog set modules=(
 select jsonb_agg(item order by array_position(array['incident','risk','tbm','organization','training','msds'],item->>'key'))
 from jsonb_array_elements(modules || '[{"key":"msds","state":"building","enabled":false,"preview":false,"roles":["worker","field","manager","executive","safety"],"pilots":[]}]'::jsonb) item
), revision=revision+1,updated_at=now()
where singleton and not exists(select 1 from jsonb_array_elements(modules) m where m->>'key'='msds');
