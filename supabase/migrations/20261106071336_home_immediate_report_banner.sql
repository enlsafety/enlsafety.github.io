-- Remove the three retired built-in cards and place immediate reporting after the first card.
-- Preserve all other slots, including uploaded images, and record the configuration change.
do $$
declare old_config private.enl_home_banner_config%rowtype; remaining jsonb; next_items jsonb; new_revision integer;
begin
 select * into old_config from private.enl_home_banner_config where singleton for update;
 select coalesce(jsonb_agg(item order by ordinality),'[]'::jsonb) into remaining
 from jsonb_array_elements(old_config.items) with ordinality a(item,ordinality)
 where not (item->>'type'='builtin' and item->>'key' in ('tbm','ppe','prevention','report'));
 if jsonb_array_length(remaining)>=12 then raise exception 'banner_limit_requires_review'; end if;
 select jsonb_agg(item order by position) into next_items from (
  select item,ordinality::numeric position from jsonb_array_elements(remaining) with ordinality a(item,ordinality)
  union all select '{"type":"builtin","key":"report"}'::jsonb,1.5
 ) ordered;
 if next_items=old_config.items then return; end if;
 update private.enl_home_banner_config set items=next_items,revision=revision+1,updated_by='release:r87',updated_at=now() where singleton returning revision into new_revision;
 insert into private.enl_home_banner_audit(revision,actor_id,actor_name,before_items,after_items)
 values(new_revision,'release:r87','시스템 배너 구성 업데이트',old_config.items,next_items);
end $$;
