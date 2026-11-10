-- Account verification survives browser changes, session revocation and password resets.
alter table private.enl_password_schedule add column verified_email text;
-- Also capture verifications by the previous login function during the rollout.
create function private.enl_capture_verified_login_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update private.enl_password_schedule set verified_email=lower(btrim(new.email))
 where account_key=new.account_key and verified_email is null;
 return null;
end $$;
revoke all on function private.enl_capture_verified_login_email() from public,anon,authenticated;
create trigger enl_record_verified_login_email after insert or update of email on private.enl_login_devices
 for each row execute function private.enl_capture_verified_login_email();

create function private.enl_forget_replaced_login_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update private.enl_password_schedule set verified_email=null
 where account_key=tg_argv[0]||':'||(to_jsonb(new)->>tg_argv[1]);
 return null;
end $$;
revoke all on function private.enl_forget_replaced_login_email() from public,anon,authenticated;
create trigger enl_forget_hq_email after update of email on public.enl_hq_users
 for each row when (lower(btrim(old.email)) is distinct from lower(btrim(new.email)))
 execute function private.enl_forget_replaced_login_email('hq','user_id');
create trigger enl_forget_site_email after update of email on public.enl_site_personnel
 for each row when (lower(btrim(old.email)) is distinct from lower(btrim(new.email)))
 execute function private.enl_forget_replaced_login_email('site','personnel_id');

with accounts as (
 select 'hq:'||user_id as account_key,lower(btrim(email)) as email from public.enl_hq_users
 union all select 'site:'||personnel_id,lower(btrim(email)) from public.enl_site_personnel
)
update private.enl_password_schedule s set verified_email=a.email from accounts a
where s.account_key=a.account_key and exists (
 select 1 from private.enl_login_devices d where d.account_key=a.account_key and lower(btrim(d.email))=a.email
);
