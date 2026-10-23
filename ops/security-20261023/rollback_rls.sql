-- Emergency recovery only. Restores the exact former anonymous/authenticated exposure.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.kokmatch_v34_state_backup DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kokmatch_v34_member_auth_backup DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kokmatch_v34_auth_backup DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kokmatch_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kokmatch_global_admins DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.kokmatch_v34_state_backup, public.kokmatch_v34_member_auth_backup, public.kokmatch_v34_auth_backup, public.kokmatch_groups, public.kokmatch_global_admins TO anon, authenticated;
COMMIT;
