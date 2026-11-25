-- Keep immutable historical submissions. New certificate revisions share one photo bundle.
alter table private.enl_supervisor_certificates
  add column extra_photos jsonb not null default '[]'::jsonb
    check (jsonb_typeof(extra_photos)='array' and jsonb_array_length(extra_photos)<=19 and octet_length(extra_photos::text)<=8900000),
  add column timing_warning jsonb check (timing_warning is null or jsonb_typeof(timing_warning)='object');
-- NOT VALID preserves previously submitted PDFs without accepting new PDF bytes.
alter table private.enl_org_charts add constraint enl_org_new_photo_only check (print_jpeg is null or substring(print_jpeg from 1 for 3)=decode('ffd8ff','hex')) not valid;
alter table private.enl_supervisor_appointments add constraint enl_appt_new_photo_only check (print_jpeg is null or substring(print_jpeg from 1 for 3)=decode('ffd8ff','hex')) not valid;
alter table private.enl_supervisor_certificates add constraint enl_cert_new_photo_only check (photo_jpeg is null or substring(photo_jpeg from 1 for 3)=decode('ffd8ff','hex')) not valid;
