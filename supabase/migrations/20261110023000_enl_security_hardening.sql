-- Mail dispatch uses trusted server connections. Client roles need no direct queue privileges.
revoke all privileges on table public.enl_email_events from public, anon, authenticated;
-- This trigger schema-qualifies its application objects and uses PostgreSQL built-ins.
alter function public.enl_inquiry_push_trigger() set search_path = pg_catalog;
