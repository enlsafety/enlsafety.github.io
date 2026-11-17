-- Enable the independent Risk Assessment navigation once UI/API are deployed.
-- Actual assessment entry and approval actions remain unavailable.
update private.enl_platform_catalog c
set modules=(
  select jsonb_agg(
    case when item->>'key'='risk'
      then item || '{"enabled":true,"state":"live","preview":false,"roles":["field","safety","manager","executive"],"pilots":[]}'::jsonb
      else item end order by ord
  )
  from jsonb_array_elements(c.modules) with ordinality as items(item,ord)
),
revision=revision+1,updated_at=now()
where c.singleton
  and exists(select 1 from jsonb_array_elements(c.modules) m where m->>'key'='risk');
