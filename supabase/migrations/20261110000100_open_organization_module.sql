update private.enl_platform_catalog c
set modules = (
  select jsonb_agg(case when m->>'key' = 'organization'
    then m || '{"enabled":true,"state":"live","roles":["field","safety","manager","executive"]}'::jsonb
    else m end order by ord)
  from jsonb_array_elements(c.modules) with ordinality as items(m,ord)
), revision = revision + 1, updated_at = now()
where singleton and exists (
  select 1 from jsonb_array_elements(c.modules) m where m->>'key' = 'organization'
);
