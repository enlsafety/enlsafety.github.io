CREATE OR REPLACE FUNCTION public.enl_incident_optimistic_sync_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  expected_version bigint;
  current_version bigint;
  incoming_mutation text;
  current_mutation text;
  old_payload jsonb;
  existing_payload jsonb;
begin
  if new.payload is null then
    return new;
  end if;

  if jsonb_typeof(new.payload) = 'string' then
    begin
      new.payload := (new.payload #>> '{}')::jsonb;
    exception when others then
      raise exception 'invalid_incident_payload_json' using errcode = '22023';
    end;
  end if;

  if jsonb_typeof(new.payload) <> 'object' then
    raise exception 'invalid_incident_payload_type' using errcode = '22023';
  end if;

  incoming_mutation := nullif(new.payload->>'_syncMutationId','');

  if tg_op = 'INSERT' then
    -- INSERT ... ON CONFLICT DO UPDATE fires BEFORE INSERT first. If this
    -- incident already exists, leave the optimistic fields untouched so the
    -- subsequent BEFORE UPDATE path can compare against the real row version.
    if new.payload ? '_syncBaseVersion' then
      select s.payload
        into existing_payload
        from public.enl_incident_shared s
       where s.incident_id = new.incident_id
       limit 1;

      if found then
        return new;
      end if;

      expected_version := coalesce(nullif(new.payload->>'_syncBaseVersion','')::bigint, 0);
      if expected_version <> 0 then
        raise exception 'enl_sync_conflict: incident %, expected %, current 0', new.incident_id, expected_version
          using errcode = '40001';
      end if;
      new.payload := jsonb_set(new.payload - '_syncBaseVersion', '{_syncVersion}', to_jsonb(1::bigint), true);
    end if;
    return new;
  end if;

  old_payload := old.payload;
  if jsonb_typeof(old_payload) = 'string' then
    begin
      old_payload := (old_payload #>> '{}')::jsonb;
    exception when others then
      old_payload := '{}'::jsonb;
    end;
  end if;

  if not (new.payload ? '_syncBaseVersion') then
    return new;
  end if;

  expected_version := coalesce(nullif(new.payload->>'_syncBaseVersion','')::bigint, 0);
  current_version := coalesce(nullif(old_payload->>'_syncVersion','')::bigint, 0);
  current_mutation := nullif(old_payload->>'_syncMutationId','');

  if incoming_mutation is not null and incoming_mutation = current_mutation then
    return old;
  end if;

  if expected_version <> current_version then
    raise exception 'enl_sync_conflict: incident %, expected %, current %', new.incident_id, expected_version, current_version
      using errcode = '40001';
  end if;

  new.payload := jsonb_set(new.payload - '_syncBaseVersion', '{_syncVersion}', to_jsonb(current_version + 1), true);
  return new;
end;
$function$
