-- The posted template includes HQ personnel names. Only authenticated module reads
-- may return the fixed artwork. Provision its original bytes outside the public repo.
create table private.enl_org_templates (
  template_key text primary key,
  image_webp bytea not null check(octet_length(image_webp) between 1 and 2097152)
);
alter table private.enl_org_templates enable row level security;
revoke all on private.enl_org_templates from public,anon,authenticated;
grant select on private.enl_org_templates to service_role;
