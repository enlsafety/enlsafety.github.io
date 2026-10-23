with v as (select jsonb_build_object(
 'audit',(select coalesce(jsonb_agg(jsonb_build_object('id',audit_id::text,'sha256',encode(sha256(convert_to((
   (to_jsonb(a)-'before_hash'-'after_hash')||jsonb_build_object(
    'before_payload',coalesce(before_payload,private.enl_evidence_get(before_hash)),
    'after_payload',coalesce(after_payload,private.enl_evidence_get(after_hash))))::text,'UTF8')),'hex')) order by audit_id),'[]'::jsonb)
   from public.enl_incident_audit a),
 'revisions',(select coalesce(jsonb_agg(jsonb_build_object('id',incident_id||':'||revision,'sha256',encode(sha256(convert_to((
   (to_jsonb(r)-'before_hash'-'after_hash'-'changes_hash')||jsonb_build_object(
    'before_payload',coalesce(before_payload,private.enl_evidence_get(before_hash)),
    'after_payload',coalesce(after_payload,private.enl_evidence_get(after_hash)),
    'changes',coalesce(changes,private.enl_evidence_get(changes_hash))))::text,'UTF8')),'hex')) order by incident_id,revision),'[]'::jsonb)
   from public.enl_incident_revisions r),
 'backups',(select coalesce(jsonb_agg(jsonb_build_object('id',backup_id::text,'sha256',encode(sha256(convert_to((
   (to_jsonb(b)-'snapshot_hash')||jsonb_build_object('snapshot',coalesce(snapshot,private.enl_evidence_get(snapshot_hash))))::text,'UTF8')),'hex')) order by backup_id),'[]'::jsonb)
   from public.enl_incident_backups b),
 'dictionary',(select jsonb_build_object('rows',count(*),'hashes_valid',coalesce(bool_and(encode(sha256(convert_to(private.enl_evidence_get(hash)::text,'UTF8')),'hex')=hash),true),'logical_json_bytes',coalesce(sum(octet_length(value::text)),0),'physical_bytes',pg_total_relation_size('private.enl_evidence_objects')) from private.enl_evidence_objects),
 'immutable_triggers',(select jsonb_object_agg(tgname,tgenabled) from pg_trigger where tgrelid in ('public.enl_incident_audit'::regclass,'public.enl_incident_revisions'::regclass,'private.enl_evidence_objects'::regclass) and tgname like '%immutable')
)) select jsonb_build_object('audit',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(x->>'sha256',',' order by (x->>'id') collate "C"),''),'UTF8')),'hex')) from jsonb_array_elements(v.jsonb_build_object->'audit') x),'revisions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(x->>'sha256',',' order by (x->>'id') collate "C"),''),'UTF8')),'hex')) from jsonb_array_elements(v.jsonb_build_object->'revisions') x),'backups',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(x->>'sha256',',' order by (x->>'id') collate "C"),''),'UTF8')),'hex')) from jsonb_array_elements(v.jsonb_build_object->'backups') x)) as baseline from v;