-- Return to the original unconditional append-only triggers before commit.
do $$ declare r record;begin
 for r in select definition from enl_evidence_trigger_restore loop
  execute replace(r.definition,'CREATE TRIGGER ','CREATE OR REPLACE TRIGGER ');
 end loop;
end; $$;
drop trigger enl_backup_representation_guard on public.enl_incident_backups;
drop function private.enl_evidence_representation_guard();
