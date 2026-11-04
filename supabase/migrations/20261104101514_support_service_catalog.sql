alter table private.enl_platform_catalog
  add column services jsonb not null default '[
    {"key":"history","state":"live","enabled":true,"preview":false,"roles":["safety","field","manager","executive"],"pilots":[]},
    {"key":"approvals","state":"building","enabled":false,"preview":false,"roles":["safety","field","manager","executive","worker"],"pilots":[]},
    {"key":"notices","state":"live","enabled":true,"preview":false,"roles":["safety","field","manager","executive","worker"],"pilots":[]},
    {"key":"documents","state":"building","enabled":false,"preview":false,"roles":["safety","field","manager","executive","worker"],"pilots":[]},
    {"key":"dashboard","state":"building","enabled":false,"preview":false,"roles":["safety","field","manager","executive","worker"],"pilots":[]},
    {"key":"system","state":"live","enabled":true,"preview":false,"roles":["safety"],"pilots":[]}
  ]'::jsonb;
