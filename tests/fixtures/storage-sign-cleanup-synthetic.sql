set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.enl_hq_users,private.enl_historical_batches,private.enl_historical_files in share row exclusive mode;
do $guard$
declare r record; hit boolean;
begin
 if to_regclass('private.enl_storage_dedup_runs') is not null then raise exception 'dedup_fixture_cleanup_required_first';end if;
 if (select count(*) from public.enl_hq_users where user_id in ('qa-storage-sign-20261023-owner','qa-storage-sign-20261023-other'))<>2 then raise exception 'fixture_users_changed';end if;
 if not exists(select 1 from public.enl_hq_users t where user_id='qa-storage-sign-20261023-owner' and encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')='1111111111111111111111111111111111111111111111111111111111111111') or not exists(select 1 from public.enl_hq_users t where user_id='qa-storage-sign-20261023-other' and encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')='2222222222222222222222222222222222222222222222222222222222222222') then raise exception 'fixture_user_hash_changed';end if;
 if (select count(*) from private.enl_historical_batches where owner_id in ('qa-storage-sign-20261023-owner','qa-storage-sign-20261023-other'))<>1 or not exists(select 1 from private.enl_historical_batches t where id='da5ca9ec-4547-4cd2-9aeb-fd066f9eb472' and encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')='3333333333333333333333333333333333333333333333333333333333333333') then raise exception 'fixture_batch_changed';end if;
 if (select count(*) from private.enl_historical_files where batch_id='da5ca9ec-4547-4cd2-9aeb-fd066f9eb472')<>1 or not exists(select 1 from private.enl_historical_files t where batch_id='da5ca9ec-4547-4cd2-9aeb-fd066f9eb472' and file_id='a4bf0ef9e9b991b0c8647547c3bc290a697b7ff31f06da0ae2df73be18d79ec4' and encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')='4444444444444444444444444444444444444444444444444444444444444444') then raise exception 'fixture_alias_changed';end if;
 if exists(select 1 from pg_constraint where contype='f' and confrelid in ('public.enl_hq_users'::regclass,'private.enl_historical_batches'::regclass,'private.enl_historical_files'::regclass) and not(confrelid='private.enl_historical_batches'::regclass and conrelid in ('private.enl_historical_files'::regclass,'private.enl_historical_import_audit'::regclass) and confdeltype='r')) then raise exception 'fixture_foreign_key_changed';end if;
 for r in select schemaname,tablename from pg_tables where schemaname in ('public','private') and left(tablename,4)='enl_' and tablename not in ('enl_hq_users','enl_historical_batches','enl_historical_files') loop
 execute format('select exists(select 1 from %I.%I t where strpos(to_jsonb(t)::text,$1)>0 or strpos(to_jsonb(t)::text,$2)>0 or strpos(to_jsonb(t)::text,$3)>0)',r.schemaname,r.tablename) into hit using 'qa-storage-sign-20261023-owner','qa-storage-sign-20261023-other','da5ca9ec-4547-4cd2-9aeb-fd066f9eb472';
 if hit then raise exception 'fixture_external_reference';end if;
 end loop;
end;$guard$;
delete from private.enl_historical_files where batch_id='da5ca9ec-4547-4cd2-9aeb-fd066f9eb472' and file_id='a4bf0ef9e9b991b0c8647547c3bc290a697b7ff31f06da0ae2df73be18d79ec4';
delete from private.enl_historical_batches where id='da5ca9ec-4547-4cd2-9aeb-fd066f9eb472';
delete from public.enl_hq_users where user_id in ('qa-storage-sign-20261023-owner','qa-storage-sign-20261023-other');
-- No Storage calls or storage schema writes: borrowed object is retained.
