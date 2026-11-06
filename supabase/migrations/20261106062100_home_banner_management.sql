-- Server-only banner settings. Existing incident storage remains private.
create table private.enl_home_banner_config (
 singleton boolean primary key default true check(singleton),
 revision integer not null default 1 check(revision>0),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=12),
 updated_by text, updated_at timestamptz not null default now()
);
create table private.enl_home_banner_assets (
 id uuid primary key, path text not null unique check(path like 'home-banners/%'),
 name text not null, mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
 bytes integer not null check(bytes between 1 and 5242880),
 width integer not null, height integer not null,
 uploaded_by text not null, created_at timestamptz not null default now()
);
create table private.enl_home_banner_audit (
 id uuid primary key default gen_random_uuid(), revision integer not null,
 actor_id text not null, actor_name text not null,
 before_items jsonb not null, after_items jsonb not null, created_at timestamptz not null default now()
);
alter table private.enl_home_banner_config enable row level security;
alter table private.enl_home_banner_assets enable row level security;
alter table private.enl_home_banner_audit enable row level security;
revoke all on private.enl_home_banner_config,private.enl_home_banner_assets,private.enl_home_banner_audit from public,anon,authenticated;
grant all on private.enl_home_banner_config,private.enl_home_banner_assets,private.enl_home_banner_audit to service_role;
insert into private.enl_home_banner_config(items) values('[{"type":"builtin","key":"welcome"},{"type":"builtin","key":"fire"},{"type":"builtin","key":"health"},{"type":"builtin","key":"tbm"},{"type":"builtin","key":"ppe"},{"type":"builtin","key":"prevention"}]');
