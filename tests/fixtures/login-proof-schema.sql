-- Synthetic authentication regression data only; no operational accounts.
create table public.enl_hq_users(user_id text primary key,name text,normalized_name text,password_hash text,role text,department text,position text,email text,push_enabled bool default true,email_enabled bool default true,active bool,source text,created_at timestamptz default now(),updated_at timestamptz default now(),updated_by_id text,updated_by_name text,updated_by_role text);
create table public.enl_site_master(site_id text primary key,site_name text,active bool,manager_name text,manager_phone text,part_name text,part_phone text,clerk_name text,clerk_phone text,updated_at timestamptz default now());
create table public.enl_site_personnel(personnel_id text primary key default gen_random_uuid()::text,site_id text,name text,job_title text,access_role text,phone text,email text,push_enabled bool default true,email_enabled bool default true,active bool,pin_hash text,source text,created_at timestamptz default now(),updated_at timestamptz default now(),updated_by_id text,updated_by_name text,updated_by_role text,updated_by_position text);
create table public.enl_personnel_audit(id bigint generated always as identity primary key,personnel_id text,site_id text,action text,editor_id text,editor_name text,editor_role text,editor_position text,changed_at timestamptz,before_payload jsonb,after_payload jsonb);
create table public.enl_push_subscriptions(id text primary key,user_id text);
insert into public.enl_hq_users(user_id,name,normalized_name,password_hash,role,department,position,active) values
 ('qa-auth-safety-472','QA 안전','qa안전','qa-auth-safety-proof-472','safety','QA','가상 안전담당',true),
 ('qa-auth-manager-472','QA 관리자','qa관리자','qa-auth-manager-proof-472','manager','QA','가상 관리자',true);
insert into public.enl_site_master(site_id,site_name,active) values('qa-auth-site-472','QA 가상 사업장',true);
insert into public.enl_site_personnel(personnel_id,site_id,name,job_title,access_role,active,pin_hash) values
 ('qa-auth-field-472','qa-auth-site-472','QA 현장','현장소장','field',true,'qa-auth-field-proof-472'),
 ('qa-auth-worker-472','qa-auth-site-472','QA 근로자','일반근로자','worker',true,null);
