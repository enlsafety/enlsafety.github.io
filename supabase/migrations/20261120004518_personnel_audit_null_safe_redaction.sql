-- A missing before/after record can arrive as SQL NULL or JSON null.
-- JSONB key deletion accepts objects, but raises 22023 for JSON scalars,
-- rolling back new personnel registrations. Keep only object snapshots and
-- continue stripping credentials from every writer using this audit table.
create or replace function private.enl_redact_personnel_audit_credentials() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  new.before_payload := case when jsonb_typeof(new.before_payload) = 'object'
    then new.before_payload - 'pin_hash' - 'password_hash' else null end;
  new.after_payload := case when jsonb_typeof(new.after_payload) = 'object'
    then new.after_payload - 'pin_hash' - 'password_hash' else null end;
  return new;
end;
$$;
