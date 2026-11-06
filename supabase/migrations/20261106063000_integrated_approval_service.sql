-- Enable only the existing integrated approval service. Module gates and roles are preserved.
update private.enl_platform_catalog
set services=(select jsonb_agg(case when item->>'key'='approvals'
  then item||'{"state":"live","enabled":true,"preview":false}'::jsonb else item end order by ord)
  from jsonb_array_elements(services) with ordinality as entries(item,ord)),
  revision=revision+1,updated_at=now(),updated_by='system:hub-work-r81'
where singleton and exists(select 1 from jsonb_array_elements(services) item
  where item->>'key'='approvals' and (item->>'state'<>'live' or item->>'enabled'='false'));
