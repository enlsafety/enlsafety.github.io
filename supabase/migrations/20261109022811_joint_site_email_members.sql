create table private.enl_joint_site_email_members(
 account_key text primary key check(account_key like 'site:%'),
 address text not null references private.enl_account_email_owners(address) on delete restrict
);
alter table private.enl_joint_site_email_members enable row level security;
revoke all on private.enl_joint_site_email_members from public,anon,authenticated;
create or replace function private.enl_sync_account_email_owner() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 old_key text;
 new_key text;
 new_address text;
 joint_address text;
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
 -- Explicitly linked site accounts share one reserved address. Every other
 -- account still has its own email owner and the original uniqueness check.
 if tg_argv[0]='site' then
   if tg_op='DELETE' then
     delete from private.enl_joint_site_email_members where account_key=old_key returning address into joint_address;
     if joint_address is not null then
       perform pg_advisory_xact_lock(hashtextextended(joint_address,6601));
       delete from private.enl_account_email_owners where account_key='joint:'||joint_address
         and not exists(select 1 from private.enl_joint_site_email_members where address=joint_address);
     end if;
   elsif new_address is not null and exists(
     select 1 from private.enl_joint_site_email_members m join private.enl_account_email_owners o using(address)
     where m.account_key=new_key and m.address=new_address and o.account_key='joint:'||new_address
   ) then return null;
   end if;
 end if;
 if new_address is not null then
   perform pg_advisory_xact_lock(hashtextextended(new_address,6601));
   insert into private.enl_account_email_owners(address,account_key) values(new_address,new_key);
 end if;
 return null;
end $$;
revoke all on function private.enl_sync_account_email_owner() from public,anon,authenticated;

-- Legacy personnel editors submit an empty PIN when only a worker profile is edited.
create function private.enl_preserve_worker_password() returns trigger language plpgsql set search_path='' as $$
begin
 new.pin_hash:=old.pin_hash;
 return new;
end $$;
revoke all on function private.enl_preserve_worker_password() from public,anon,authenticated;
create trigger enl_keep_worker_password before update of pin_hash on public.enl_site_personnel
for each row when (old.access_role='worker' and new.access_role='worker' and nullif(old.pin_hash,'') is not null and nullif(new.pin_hash,'') is null)
execute function private.enl_preserve_worker_password();
