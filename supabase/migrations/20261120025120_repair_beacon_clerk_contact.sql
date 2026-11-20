-- Repair the reported missing contact from the existing active account only.
-- Do not reconstruct lost historical audit snapshots or create new accounts.
do $$
declare person_row public.enl_site_personnel%rowtype;
  previous jsonb; latest jsonb;
begin
  for person_row in select p.* from public.enl_site_personnel p
    join public.enl_site_master s on s.site_id=p.site_id
    where s.site_name='비콘힐스' and p.name='홍전희' and p.job_title='서무'
      and p.access_role='field' and p.active
      and coalesce(s.clerk_name,'') in ('','홍전희')
      and (select count(*) from public.enl_site_personnel q where q.site_id=p.site_id
        and q.job_title='서무' and q.access_role='field' and q.active)=1
  loop
    select content into previous from private.enl_safety_cards where site_id=person_row.site_id order by revision desc limit 1;
    perform private.enl_apply_personnel_contacts(person_row.site_id,jsonb_build_object('D16',person_row.name,'F16',coalesce(person_row.phone,'')),
      'system:personnel-contact-sync','근무자 연락망 연동 복구','system');
    select content into latest from private.enl_safety_cards where site_id=person_row.site_id order by revision desc limit 1;
    if previous is not null and (
      (previous-array['masterValues','overrides']) is distinct from (latest-array['masterValues','overrides']) or
      ((previous->'masterValues')-array['D16','F16']) is distinct from ((latest->'masterValues')-array['D16','F16']) or
      (coalesce(previous->'overrides','{}')-array['D16','F16']) is distinct from (coalesce(latest->'overrides','{}')-array['D16','F16'])
    ) then raise exception 'Unrelated safety card content changed'; end if;
  end loop;
end
$$;
