-- Multiple personnel writers share this audit table. Do not retain authentication
-- proofs in either copy of the personnel record when creating a new audit entry.
create function private.enl_redact_personnel_audit_credentials() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  new.before_payload := new.before_payload - 'pin_hash' - 'password_hash';
  new.after_payload := new.after_payload - 'pin_hash' - 'password_hash';
  return new;
end;
$$;
revoke all on function private.enl_redact_personnel_audit_credentials() from public,anon,authenticated;
create trigger enl_redact_personnel_audit_credentials
before insert or update of before_payload, after_payload on public.enl_personnel_audit
for each row execute function private.enl_redact_personnel_audit_credentials();
