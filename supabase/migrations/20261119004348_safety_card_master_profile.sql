-- Source-of-truth fields absent from the existing site master form.
alter table public.enl_site_master add column safety_card_profile jsonb not null default '{}'::jsonb
 check(jsonb_typeof(safety_card_profile)='object');
-- Preserve the actual imported card values while moving ownership to site settings.
update public.enl_site_master s set safety_card_profile=jsonb_build_object(
 'corporation',coalesce(c.content->'values'->>'N6',''),
 'business_number',coalesce(c.content->'values'->>'D8',''),
 'insurance_number',coalesce(c.content->'values'->>'J8',''),
 'confirmed_on',coalesce(c.content->'values'->>'D10',''),
 'original_check',coalesce(c.content->'values'->>'H10',''))
from (select distinct on(site_id) site_id,content from private.enl_safety_cards order by site_id,revision desc) c
where c.site_id=s.site_id;
