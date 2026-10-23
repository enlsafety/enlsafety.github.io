-- REFERENCE ONLY: cleanup completed by fixed scoped runner on 2026-10-23.
-- Independent read-only verification at 07:04 UTC found all eight names absent.
-- Do not rerun. See ../staging-cleanup-20261023.json. Test project only:
-- zgwxzfvvpqgdedyobwmg. This file records the original cleanup plan.
-- All eight tables were absent before this task (information_schema query returned []).
-- They were created by enl_kokmatch_security_qa_fixture_20261023 using synthetic rows only.
-- Four enl-security-qa-* Edge Functions are already retired (HTTP 410, no DB access).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kokmatch_groups WHERE group_id IS DISTINCT FROM 'enl_rls_qa_20261023')
     OR EXISTS (SELECT 1 FROM public.kokmatch_global_admins WHERE admin_id IS DISTINCT FROM 'qa_admin_20261023')
     OR EXISTS (SELECT 1 FROM public.kokmatch_state WHERE club_id IS DISTINCT FROM 'enl_rls_qa_20261023')
     OR EXISTS (SELECT 1 FROM public.kokmatch_member_auth WHERE club_id IS DISTINCT FROM 'enl_rls_qa_20261023')
     OR EXISTS (SELECT 1 FROM public.kokmatch_v34_state_backup WHERE club_id IS DISTINCT FROM 'enl_rls_qa_20261023')
     OR EXISTS (SELECT 1 FROM public.kokmatch_v34_member_auth_backup WHERE club_id IS DISTINCT FROM 'enl_rls_qa_20261023')
     OR EXISTS (SELECT 1 FROM public.kokmatch_v34_auth_backup WHERE club_id IS DISTINCT FROM 'enl_rls_qa_20261023')
     OR EXISTS (SELECT 1 FROM public.kokmatch_sessions WHERE club_id IS NULL OR club_id NOT IN ('enl_rls_qa_20261023','__global__') OR display_name IS NULL OR display_name NOT IN ('QA Member 20261023','QA Manager 20261023','QA Admin 20261023'))
  THEN RAISE EXCEPTION 'Unexpected non-fixture records: cleanup refused'; END IF;
END $guard$;
DROP TABLE public.kokmatch_sessions, public.kokmatch_member_auth,
  public.kokmatch_state, public.kokmatch_groups, public.kokmatch_global_admins,
  public.kokmatch_v34_state_backup, public.kokmatch_v34_member_auth_backup,
  public.kokmatch_v34_auth_backup;
COMMIT;
