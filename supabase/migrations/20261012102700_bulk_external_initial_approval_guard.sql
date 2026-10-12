-- Externally approved historical records must not gain an invented new
-- in-app initial incident-report approval. Corrective-action acknowledgements
-- remain available under the existing workflow.
create or replace function public.enl_bulk_external_approval_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
 old_signatures jsonb;
 new_signatures jsonb;
begin
 if old.payload->'externalInitialApproval'->>'state' is distinct from 'verified' then
   return new;
 end if;
 select coalesce(jsonb_agg(x order by x->>'userId',x->>'ackAt'),'[]'::jsonb)
   into old_signatures
   from jsonb_array_elements(coalesce(old.payload->'acknowledgements','[]'::jsonb)) x
   where coalesce(x->>'documentType','incident_report')='incident_report';
 select coalesce(jsonb_agg(x order by x->>'userId',x->>'ackAt'),'[]'::jsonb)
   into new_signatures
   from jsonb_array_elements(coalesce(new.payload->'acknowledgements','[]'::jsonb)) x
   where coalesce(x->>'documentType','incident_report')='incident_report';
 if old_signatures is distinct from new_signatures then
   raise exception 'external_initial_approval_no_duplicate_signature'
     using errcode='23514';
 end if;
 return new;
end;
$body$;
drop trigger if exists trg_enl_bulk_external_approval_guard on public.enl_incident_shared;
create trigger trg_enl_bulk_external_approval_guard
before update of payload on public.enl_incident_shared
for each row execute function public.enl_bulk_external_approval_guard();
