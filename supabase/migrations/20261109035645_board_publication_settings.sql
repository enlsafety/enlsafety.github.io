-- NULL preserves the pin rule used by clients that predate explicit publication settings.
alter table private.enl_hub_content
 add column pinned boolean,
 add column expires_at timestamptz,
 add column shared_sites jsonb check(shared_sites is null or jsonb_typeof(shared_sites)='array');
