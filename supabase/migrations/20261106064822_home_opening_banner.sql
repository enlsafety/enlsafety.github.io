-- Add the requested launch card after the first card without replacing any existing slots.
do $$
declare old_config private.enl_home_banner_config%rowtype; next_items jsonb; new_revision integer;
begin
 select * into old_config from private.enl_home_banner_config where singleton for update;
 if old_config.items @> '[{"type":"builtin","key":"opening"}]'::jsonb then return; end if;
 if jsonb_array_length(old_config.items)>=12 then raise exception 'banner_limit_requires_review'; end if;
 select coalesce(jsonb_agg(item order by position),'[]'::jsonb) into next_items from (
  select item,ordinality::numeric position from jsonb_array_elements(old_config.items) with ordinality a(item,ordinality)
  union all select '{"type":"builtin","key":"opening"}'::jsonb,1.5
 ) ordered;
 update private.enl_home_banner_config set items=next_items,revision=revision+1,updated_by='release:r86',updated_at=now() where singleton returning revision into new_revision;
 insert into private.enl_home_banner_audit(revision,actor_id,actor_name,before_items,after_items)
 values(new_revision,'release:r86','시스템 배너 구성 업데이트',old_config.items,next_items);
end $$;
