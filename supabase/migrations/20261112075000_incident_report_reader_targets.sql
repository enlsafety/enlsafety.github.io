-- Display membership for the HQ readership row, independent of authentication and report access.
create table private.enl_incident_report_reader_targets (
  user_id text primary key
);
alter table private.enl_incident_report_reader_targets enable row level security;
revoke all on private.enl_incident_report_reader_targets from public, anon, authenticated;

-- Preserve the original live staff and earlier readership of departed staff.
-- New accounts do not inherit display membership from their role.
insert into private.enl_incident_report_reader_targets(user_id)
select user_id from public.enl_hq_users
where active and role in ('manager','final') and source is distinct from 'role-demonstration'
  and created_at < timestamptz '2026-11-11 23:38:04.383032+00'
union
select v.viewer_id from public.enl_document_views v
left join public.enl_hq_users u on u.user_id=v.viewer_id
where v.document_type='incident_report' and v.viewer_role in ('manager','final')
  and v.viewer_id is not null and u.source is distinct from 'role-demonstration'
  and v.first_viewed_at < timestamptz '2026-11-11 23:38:04.383032+00';
