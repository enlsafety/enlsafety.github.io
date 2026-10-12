-- Add missing workflow audit labels without narrowing any existing label set.
do $body$
declare existing_expression text;
begin
 select pg_get_expr(conbin,conrelid) into existing_expression from pg_constraint
 where conrelid='public.enl_incident_audit'::regclass and conname='enl_incident_audit_action_check';
 if existing_expression is not null and position('corrective_submit' in existing_expression)=0 then
  alter table public.enl_incident_audit drop constraint enl_incident_audit_action_check;
  execute format('alter table public.enl_incident_audit add constraint enl_incident_audit_action_check check ((%s) or action = any (array[%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L]))',
   existing_expression,'restore','approve','reject','final_approval','post_approval_revision',
   'supplement_request','supplement_submit','supplement_resubmit','corrective_submit','corrective_reject',
   'corrective_approve','acknowledge','attachment_add','attachment_delete','external_erp_initial_approval_verified');
 end if;
end;
$body$;
