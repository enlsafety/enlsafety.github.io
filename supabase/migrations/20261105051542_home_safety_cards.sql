-- Home placement is independent of module access and stored records.
alter table private.enl_platform_catalog add column home_omitted jsonb not null default '[]'::jsonb;
update private.enl_platform_catalog c
set home_extras = coalesce(home_extras,jsonb_build_object('support',jsonb_array_length(modules),'system',jsonb_array_length(modules)+1)),
    modules = modules || (
      select jsonb_agg(jsonb_build_object('key',key,'displayName',label,'state','building','enabled',false,'preview',false,
        'roles',jsonb_build_array('safety','manager','executive','field','worker'),'pilots','[]'::jsonb) order by n)
      from (values (1,'policy','안전보건 경영방침 및 목표'),(2,'law','산업안전보건법령 요지'),
        (3,'voice','종사자 의견 청취'),(4,'emergency','비상사태 대비 및 대응'),(5,'ppe','보호구 지급 및 관리'),
        (6,'ergonomics','근골격계 유해위험요인조사'),(7,'rules','안전보건관리규정')) as additions(n,key,label)
    ),revision=revision+1,updated_at=now()
where singleton;
