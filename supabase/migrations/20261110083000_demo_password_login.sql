-- Only explicitly provisioned account IDs opt into password-only demonstration login.
alter table private.enl_password_schedule add column demo_password_only boolean not null default false;

create or replace function private.enl_capture_verified_login_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update private.enl_password_schedule set verified_email=lower(btrim(new.email))
 where account_key=new.account_key and verified_email is null and nullif(btrim(new.email),'') is not null;
 return null;
end $$;
