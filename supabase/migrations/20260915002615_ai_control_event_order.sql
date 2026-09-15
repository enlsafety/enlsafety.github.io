-- Monotonic tie-breaker for events written in the same transaction.
alter table public.ai_agent_events add column event_seq bigint generated always as identity;
create unique index ai_events_sequence on public.ai_agent_events(event_seq);
revoke all on sequence public.ai_agent_events_event_seq_seq from anon,authenticated;
grant usage,select on sequence public.ai_agent_events_event_seq_seq to service_role;
create index if not exists ai_findings_run on public.ai_findings(agent_run_id);
