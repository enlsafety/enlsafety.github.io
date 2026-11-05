create table private.enl_email_challenges (
 account_key text primary key, address text not null, salt text not null, digest text not null,
 sent_at timestamptz not null default now(), expires_at timestamptz not null,
 window_start timestamptz not null default now(), sends integer not null, failures integer not null default 0
);
alter table private.enl_email_challenges enable row level security;
revoke all on private.enl_email_challenges from public,anon,authenticated;
alter table private.enl_platform_catalog add column sidebar_order jsonb not null default '[]';
create or replace view private.enl_master_accounts with(security_invoker=true) as
 select 'hq'::text as source,user_id::text as id,name,role,null::text as site_id,department,position,active,email from public.enl_hq_users
 union all select 'site',personnel_id::text,name,access_role,site_id,null,job_title,active,email from public.enl_site_personnel;
