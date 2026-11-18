alter table private.enl_org_charts
  add column photo_revision integer,
  add column print_jpeg bytea check (octet_length(print_jpeg) between 4 and 350000),
  add foreign key (site_id,photo_revision) references private.enl_org_charts(site_id,revision);
update private.enl_platform_catalog c set modules=(
  select jsonb_agg(case when m->>'key'='organization' then jsonb_set(m,'{roles}',(m->'roles')||'["worker"]'::jsonb) else m end order by ord)
  from jsonb_array_elements(c.modules) with ordinality as items(m,ord)
), revision=revision+1,updated_at=now() where singleton and exists(
  select 1 from jsonb_array_elements(c.modules) m where m->>'key'='organization' and not (m->'roles' ? 'worker'));
