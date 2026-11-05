-- Coordinate HQ and site account writes, including administrative edits.
lock table public.enl_hq_users, public.enl_site_personnel in share row exclusive mode;
create table private.enl_account_email_owners (
 address text primary key,
 account_key text not null unique
);
alter table private.enl_account_email_owners enable row level security;
revoke all on private.enl_account_email_owners from public,anon,authenticated;
grant select,insert,update,delete on private.enl_account_email_owners to service_role;

insert into private.enl_account_email_owners(address,account_key)
select lower(btrim(email)),source||':'||id from private.enl_master_accounts
where nullif(btrim(email),'') is not null;

create function private.enl_sync_account_email_owner() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 old_key text;
 new_key text;
 new_address text;
begin
 if tg_op<>'INSERT' then
   old_key:=tg_argv[0]||':'||(to_jsonb(old)->>tg_argv[1]);
 end if;
 if tg_op<>'DELETE' then
   new_key:=tg_argv[0]||':'||(to_jsonb(new)->>tg_argv[1]);
   new_address:=nullif(lower(btrim(new.email)),'');
   if tg_op='UPDATE' and old_key=new_key and
      new_address is not distinct from nullif(lower(btrim(old.email)),'') then return null; end if;
 end if;
 if old_key is not null then
   delete from private.enl_account_email_owners where account_key=old_key;
 end if;
 if new_address is not null then
   perform pg_advisory_xact_lock(hashtextextended(new_address,6601));
   insert into private.enl_account_email_owners(address,account_key) values(new_address,new_key);
 end if;
 return null;
end $$;
revoke all on function private.enl_sync_account_email_owner() from public,anon,authenticated;
create trigger enl_hq_email_owner after insert or update of email,user_id or delete on public.enl_hq_users
for each row execute function private.enl_sync_account_email_owner('hq','user_id');
create trigger enl_site_email_owner after insert or update of email,personnel_id or delete on public.enl_site_personnel
for each row execute function private.enl_sync_account_email_owner('site','personnel_id');
