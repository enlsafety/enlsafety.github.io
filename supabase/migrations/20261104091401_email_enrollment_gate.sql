create table private.enl_email_enrollment_gate(
 singleton boolean primary key default true check(singleton),
 owner_id text not null, salt text, verifier text,
 updated_at timestamptz
);
insert into private.enl_email_enrollment_gate(owner_id)
values ((select user_id from public.enl_hq_users where name='박태영' and role='safety' and active));
create table private.enl_email_enrollment_attempts(
 account_key text primary key, failures int not null default 0, started_at timestamptz not null default now()
);
alter table private.enl_email_enrollment_gate enable row level security;
alter table private.enl_email_enrollment_attempts enable row level security;
revoke all on private.enl_email_enrollment_gate,private.enl_email_enrollment_attempts from public,anon,authenticated;
grant select,update on private.enl_email_enrollment_gate to service_role;
grant select,insert,update on private.enl_email_enrollment_attempts to service_role;
