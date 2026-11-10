alter table private.enl_org_charts
  add column deleted_at timestamptz,
  add column deleted_by text;
grant update (deleted_at,deleted_by) on private.enl_org_charts to service_role;

-- Change display names in place. Preserve each module's access settings and identity.
update private.enl_platform_catalog c
set modules=(
  select jsonb_agg(case when titles.label is null then m else
    jsonb_set(m,'{displayName}',to_jsonb(titles.label)) end order by pos)
  from jsonb_array_elements(c.modules) with ordinality a(m,pos)
  left join (values
    ('organization','01. 안전보건 조직'),('policy','02. 경영방침 및 목표'),
    ('training','03. 교육관리'),('msds','05. 물질안전보건자료'),
    ('law','06. 법령요지'),('voice','07. 종사자 의견청취'),
    ('risk','08. 위험성평가'),('emergency','09. 비상사태 대비 및 대응'),
    ('ppe','10. 보호구관리'),('ergonomics','11. 근골격계 위험요인')
  ) titles(key,label) on titles.key=m->>'key'
), revision=revision+1, updated_at=now()
where singleton;
