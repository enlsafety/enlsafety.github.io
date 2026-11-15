-- Successful password logins only: a device session is issued after account proof and email gate.
-- Store no passwords, session tokens, device fingerprints, IP addresses or failed attempts.
create table if not exists private.enl_login_history (
  id bigint generated always as identity primary key,
  logged_at timestamptz not null default now(),
  account_key text not null,
  display_name text not null,
  role_label text not null,
  affiliation text not null
);
create index if not exists enl_login_history_recent on private.enl_login_history(id desc);
create index if not exists enl_login_history_time on private.enl_login_history(logged_at desc);
alter table private.enl_login_history enable row level security;
revoke all on private.enl_login_history from public, anon, authenticated;
revoke all on sequence private.enl_login_history_id_seq from public, anon, authenticated;

create or replace function private.enl_capture_successful_login() returns trigger
language plpgsql set search_path='' as $$
declare person record;
begin
  if left(new.account_key,3)='hq:' then
    select u.name as display_name,
      case u.role when 'safety' then '안전관리자'
        when 'executive' then '경영진'
        when 'manager' then '본사실무자'
        when 'final' then '본사실무자'
        else '본사' end as role_label,
      coalesce(nullif(btrim(u.department),''),'동탄사무실') as affiliation
      into person
    from public.enl_hq_users u where u.user_id=substr(new.account_key,4);
  elsif left(new.account_key,5)='site:' then
    select p.name as display_name,
      case p.access_role when 'field' then '현장' when 'worker' then '근로자' else '현장' end as role_label,
      coalesce(nullif(s.site_name,''),'소속 사업장 미확인') as affiliation
      into person
    from public.enl_site_personnel p
      left join public.enl_site_master s on s.site_id=p.site_id
    where p.personnel_id::text=substr(new.account_key,6);
  else
    return new;
  end if;

  insert into private.enl_login_history(account_key,display_name,role_label,affiliation)
    values(new.account_key,coalesce(nullif(person.display_name,''),'사용자 정보 없음'),
      coalesce(nullif(person.role_label,''),'역할 미확인'),
      coalesce(nullif(person.affiliation,''),'소속 미확인'));
  -- A rolling 90-day retention window, maintained opportunistically on successful logins.
  delete from private.enl_login_history where logged_at<now()-interval '90 days';
  return new;
exception when others then
  -- Logging problems must never disable ordinary user authentication.
  raise warning 'enl login history capture failed: %', SQLERRM;
  return new;
end $$;

drop trigger if exists enl_capture_successful_login on private.enl_device_sessions;
create trigger enl_capture_successful_login
  after insert on private.enl_device_sessions
  for each row execute function private.enl_capture_successful_login();
revoke all on function private.enl_capture_successful_login() from public, anon, authenticated;
