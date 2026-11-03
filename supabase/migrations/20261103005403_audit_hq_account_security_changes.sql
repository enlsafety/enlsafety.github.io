create table private.enl_hq_account_changes (
  change_id bigint generated always as identity primary key,
  changed_at timestamptz not null default clock_timestamp(),
  account_id text not null,
  operation text not null,
  recorded_editor_id text,
  old_role text,
  new_role text,
  old_active boolean,
  new_active boolean,
  password_changed boolean not null
);
revoke all on private.enl_hq_account_changes from public, anon, authenticated;
alter table private.enl_hq_account_changes enable row level security;

create function private.enl_log_hq_account_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.role is not distinct from new.role
    and old.active is not distinct from new.active and old.password_hash is not distinct from new.password_hash then
    return null;
  end if;
  insert into private.enl_hq_account_changes
    (account_id, operation, recorded_editor_id, old_role, new_role, old_active, new_active, password_changed)
  values (
    coalesce(new.user_id, old.user_id), tg_op,
    case when tg_op <> 'DELETE' then new.updated_by_id end,
    old.role, new.role, old.active, new.active,
    case when tg_op = 'UPDATE' then old.password_hash is distinct from new.password_hash else false end
  );
  return null;
end;
$$;
revoke all on function private.enl_log_hq_account_change() from public, anon, authenticated;
create trigger enl_hq_account_changes after insert or update or delete on public.enl_hq_users
for each row execute function private.enl_log_hq_account_change();
