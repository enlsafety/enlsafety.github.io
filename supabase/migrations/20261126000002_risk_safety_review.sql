alter table private.enl_risk_records add column approved_period text
  check (approved_period is null or approved_period ~ '^20[0-9]{2}-[12]$');
-- Approval is an append-only revision authored by the verified safety role.
