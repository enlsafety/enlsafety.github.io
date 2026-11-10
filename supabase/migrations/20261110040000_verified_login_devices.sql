create table private.enl_login_devices(
 account_key text not null, device_hash text not null, email text not null,
 verified_at timestamptz not null default now(), primary key(account_key,device_hash)
);
create table private.enl_device_challenge(
 account_key text primary key,device_hash text not null,email text not null,
 digest text not null,salt text not null,sent_at timestamptz not null,expires_at timestamptz not null,
 window_start timestamptz not null,sends int not null,failures int not null
);
create table private.enl_device_sessions(
 token_hash text primary key,account_key text not null,device_hash text not null,expires_at timestamptz not null,
 foreign key(account_key,device_hash) references private.enl_login_devices on delete cascade
);
create index enl_device_sessions_owner on private.enl_device_sessions(account_key);
create table private.enl_password_schedule(
 account_key text primary key,initial boolean not null,changed_at timestamptz,next_prompt timestamptz
);
alter table private.enl_login_devices enable row level security;
alter table private.enl_device_challenge enable row level security;
alter table private.enl_device_sessions enable row level security;
alter table private.enl_password_schedule enable row level security;
revoke all on private.enl_login_devices,private.enl_device_challenge,private.enl_device_sessions,private.enl_password_schedule from public,anon,authenticated;

-- Known HQ change events supply real dates; accounts without change evidence start with the initial reminder.
insert into private.enl_password_schedule(account_key,initial,changed_at,next_prompt)
select 'hq:'||u.user_id,h.at is null,h.at,h.at+interval '1 year' from public.enl_hq_users u left join lateral
 (select max(changed_at) at from private.enl_hq_account_changes where account_id=u.user_id and operation='UPDATE' and password_changed) h on true;
insert into private.enl_password_schedule(account_key,initial,changed_at,next_prompt)
select 'site:'||p.personnel_id,p.access_role='field' and (h.at is null or p.pin_hash=encode(sha256(convert_to(right(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),4),'UTF8')),'hex')),
 h.at,coalesce(h.at+interval '1 year',now()) from public.enl_site_personnel p left join lateral
 (select max(changed_at) at from public.enl_personnel_audit where personnel_id=p.personnel_id and
 nullif(before_payload->>'pin_hash','') is not null and before_payload->>'pin_hash' is distinct from after_payload->>'pin_hash' and after_payload->>'pin_hash'=p.pin_hash) h on true;

create function private.enl_login_account_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare
 oldrow jsonb; newrow jsonb; account text; proofcol text:=tg_argv[2]; id text; self_set boolean;
begin
 if tg_op<>'INSERT' then oldrow:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then newrow:=to_jsonb(new);end if;
 id:=coalesce(newrow->>tg_argv[1],oldrow->>tg_argv[1]); account:=tg_argv[0]||':'||id;
 if tg_op='DELETE' or (tg_op='UPDATE' and (oldrow->>'email' is distinct from newrow->>'email' or
 oldrow->>'active' is distinct from newrow->>'active' or oldrow->>'site_id' is distinct from newrow->>'site_id' or
 oldrow->>'role' is distinct from newrow->>'role' or oldrow->>'access_role' is distinct from newrow->>'access_role')) then
   delete from private.enl_login_devices where account_key=account;
   delete from private.enl_device_challenge where account_key=account;
 end if;
 if tg_op='DELETE' then delete from private.enl_password_schedule where account_key=account;return null;end if;
 if tg_op='INSERT' or oldrow->>proofcol is distinct from newrow->>proofcol then
   self_set:=tg_op='UPDATE' and coalesce(newrow->>'updated_by_id'=id,false);
   insert into private.enl_password_schedule values(account,not self_set,now(),now()+interval '1 year')
    on conflict(account_key) do update set initial=excluded.initial,changed_at=excluded.changed_at,next_prompt=excluded.next_prompt;
   delete from private.enl_device_sessions where account_key=account;
   delete from private.enl_device_challenge where account_key=account;
   if not self_set then delete from private.enl_login_devices where account_key=account;end if;
 end if;
 return null;
end $$;
revoke all on function private.enl_login_account_changed() from public,anon,authenticated;
create trigger enl_login_hq_state after insert or update or delete on public.enl_hq_users
 for each row execute function private.enl_login_account_changed('hq','user_id','password_hash');
create trigger enl_login_site_state after insert or update or delete on public.enl_site_personnel
 for each row execute function private.enl_login_account_changed('site','personnel_id','pin_hash');
