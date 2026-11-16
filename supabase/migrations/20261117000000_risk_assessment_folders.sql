-- Risk-assessment navigation only. Do not create evaluation records or alter organization data.
create table private.enl_risk_folders (
  site_id text primary key references public.enl_site_master(site_id),
  display_name text check (length(btrim(display_name)) between 1 and 72),
  deleted boolean not null default false,
  revision integer not null default 1 check (revision > 0)
);

-- Preserve existing site names and folder naming on initial rollout only.
insert into private.enl_risk_folders(site_id,display_name)
select s.site_id,
       case when f.deleted is false then f.display_name else null end
from public.enl_site_master s
left join private.enl_org_folders f using(site_id)
where s.site_id <> 'site-hq'
  and (s.active is not false or (f.site_id is not null and not f.deleted));

alter table private.enl_risk_folders enable row level security;
revoke all on private.enl_risk_folders from public,anon,authenticated;
grant select,insert,update on private.enl_risk_folders to service_role;
