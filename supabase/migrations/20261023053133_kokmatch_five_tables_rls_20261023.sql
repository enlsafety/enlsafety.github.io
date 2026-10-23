BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.kokmatch_v34_state_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kokmatch_v34_member_auth_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kokmatch_v34_auth_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kokmatch_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kokmatch_global_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kokmatch_v34_state_backup, public.kokmatch_v34_member_auth_backup, public.kokmatch_v34_auth_backup, public.kokmatch_groups, public.kokmatch_global_admins FROM anon, authenticated, PUBLIC;
-- Server-only tables. Existing service_role grants and postgres ownership are retained.
-- No browser policy is intentional: custom session auth is checked by the Edge APIs.
COMMIT;
