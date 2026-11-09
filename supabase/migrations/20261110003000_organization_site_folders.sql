create table private.enl_org_folders (
  site_id text primary key references public.enl_site_master(site_id),
  display_name text check (length(btrim(display_name)) between 1 and 72),
  deleted boolean not null default false,
  revision integer not null default 1 check (revision > 0)
);
-- Retain the folders and history that existed before folder management.
insert into private.enl_org_folders(site_id)
select s.site_id from public.enl_site_master s
where s.site_id <> 'site-hq' and (s.active is not false or exists (
  select 1 from private.enl_org_charts c where c.site_id=s.site_id
));
alter table private.enl_org_folders enable row level security;
revoke all on private.enl_org_folders from public,anon,authenticated;
grant select,insert,update on private.enl_org_folders to service_role;
