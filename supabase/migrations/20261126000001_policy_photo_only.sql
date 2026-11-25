-- Review/reject existing evidence without rewriting it; block only new PDF bytes.
create function private.enl_policy_require_photo() returns trigger language plpgsql as $$
begin
  if (TG_OP='INSERT' or NEW.photo_jpeg is distinct from OLD.photo_jpeg)
     and substring(NEW.photo_jpeg from 1 for 3)<>decode('ffd8ff','hex') then
    raise exception 'printed_document_photo_required' using errcode='23514';
  end if;
  return NEW;
end $$;
revoke all on function private.enl_policy_require_photo() from public;
create trigger enl_policy_require_photo before insert or update of photo_jpeg on private.enl_policy_evidence
  for each row execute function private.enl_policy_require_photo();
