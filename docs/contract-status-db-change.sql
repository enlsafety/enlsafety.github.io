-- Apply once after checking information_schema. Existing active/start_date reused.
-- contract_period is the safety-agency contract and MUST remain unchanged.
alter table public.enl_site_master add column contract_end_date text;
comment on column public.enl_site_master.contract_end_date is 'E&L site contract end: YYYY-MM or YYYY-MM-DD; month precision retained when exact day is unknown';
-- PajuCC is updated separately with a compare-and-set after a fresh SELECT.
-- No incident payload backfill; snapshots are captured by authenticated registration only.
