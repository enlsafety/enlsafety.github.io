-- Existing evidence is never treated as approved without a safety review.
alter table private.enl_supervisor_certificates
  add column event text not null default 'save'
  check (event in ('save','approve'));
