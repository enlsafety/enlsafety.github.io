-- Keep existing immutable records and photo revision references intact.
-- Legacy bytea column names remain compatible with existing clients.
alter table private.enl_org_charts drop constraint enl_org_charts_print_jpeg_check,
  add constraint enl_org_charts_print_jpeg_check check (
    (substring(print_jpeg from 1 for 3)=decode('ffd8ff','hex') and octet_length(print_jpeg) between 4 and 350000)
    or (substring(print_jpeg from 1 for 5)=decode('255044462d','hex') and octet_length(print_jpeg) between 16 and 10485760));
alter table private.enl_supervisor_appointments drop constraint enl_supervisor_appointments_print_jpeg_check,
  add constraint enl_supervisor_appointments_print_jpeg_check check (
    (substring(print_jpeg from 1 for 3)=decode('ffd8ff','hex') and octet_length(print_jpeg) between 4 and 350000)
    or (substring(print_jpeg from 1 for 5)=decode('255044462d','hex') and octet_length(print_jpeg) between 16 and 10485760));
alter table private.enl_supervisor_certificates drop constraint enl_supervisor_certificates_photo_jpeg_check,
  add constraint enl_supervisor_certificates_photo_jpeg_check check (
    (substring(photo_jpeg from 1 for 3)=decode('ffd8ff','hex') and octet_length(photo_jpeg) between 4 and 350000)
    or (substring(photo_jpeg from 1 for 5)=decode('255044462d','hex') and octet_length(photo_jpeg) between 16 and 10485760));
alter table private.enl_policy_evidence drop constraint enl_policy_evidence_photo_jpeg_check,
  add constraint enl_policy_evidence_photo_jpeg_check check (
    (substring(photo_jpeg from 1 for 3)=decode('ffd8ff','hex') and octet_length(photo_jpeg) between 4 and 350000)
    or (substring(photo_jpeg from 1 for 5)=decode('255044462d','hex') and octet_length(photo_jpeg) between 16 and 10485760));
