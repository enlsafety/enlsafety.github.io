-- Additive only. Do not apply to production without deployment approval.
alter table private.enl_hub_content add column document jsonb;
create table private.enl_board_assets (
 id uuid not null,
 content_id uuid not null references private.enl_hub_content(id),
 name text not null check(length(name) between 1 and 180),
 mime text not null check(mime in ('application/octet-stream','image/png','image/jpeg')),
 bytes bytea not null check(octet_length(bytes) between 1 and 5242880),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(content_id,id)
);
create index enl_board_assets_content on private.enl_board_assets(content_id);
alter table private.enl_board_assets enable row level security;
revoke all on private.enl_board_assets from public,anon,authenticated;
