-- Read-only, aggregate-only production verification after the fixed maintenance run.
with run as (
 select * from private.enl_storage_dedup_runs where migration_id='enl-storage-dedup-20261023-v472'
), entries as (
 select e.value as e from run cross join lateral jsonb_array_elements(run.manifest->'entries') e(value)
), aliases as (
 select e.e,f.path,encode(sha256(convert_to((to_jsonb(f)||jsonb_build_object('path',e.e->>'oldPath'))::text,'UTF8')),'hex') as original_sha
 from entries e left join private.enl_historical_files f on f.batch_id::text=e.e->>'batchId' and f.file_id=e.e->>'fileId'
), canonical as (
 select distinct e->>'canonicalPath' as path,(e->>'bytes')::bigint as bytes from entries
), duplicates as (
 select e->>'oldPath' as path from entries where e->>'oldPath'<>e->>'canonicalPath'
), ledgers as (
 select c.oid,c.relrowsecurity,c.relacl,c.relowner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('enl_storage_dedup_runs','enl_storage_dedup_events')
)
select jsonb_build_object(
 'phase',(select phase from run),
 'manifestPinned',(select manifest_sha256='b2c5fee07b3ec3eab83ecf65362dd24c5d5537eb320f4bf73c9d310cfbc56522' from run),
 'metadataRows',(select count(*) from private.enl_historical_files),
 'manifestEntries',(select count(*) from entries),
 'originalMetadataHashesMatch',(select count(*) from aliases where original_sha=e->>'rowSha256'),
 'canonicalAliasesMatch',(select count(*) from aliases where path=e->>'canonicalPath'),
 'duplicateObjectsRemaining',(select count(*) from storage.objects o join duplicates d on o.bucket_id='enl-import-originals' and o.name=d.path),
 'canonicalObjectsPresent',(select count(*) from storage.objects o join canonical c on o.bucket_id='enl-import-originals' and o.name=c.path),
 'canonicalObjectSizesMatch',(select count(*) from storage.objects o join canonical c on o.bucket_id='enl-import-originals' and o.name=c.path and (o.metadata->>'size')::bigint=c.bytes),
 'importObjects',(select count(*) from storage.objects where bucket_id='enl-import-originals'),
 'importBytes',(select sum((metadata->>'size')::bigint) from storage.objects where bucket_id='enl-import-originals'),
 'totalIncidentObjects',(select count(*) from storage.objects where bucket_id in ('enl-import-originals','enl-incident-files')),
 'totalIncidentBytes',(select sum((metadata->>'size')::bigint) from storage.objects where bucket_id in ('enl-import-originals','enl-incident-files')),
 'removedPathsRecorded',(select jsonb_array_length(removed_paths) from run),
 'removedPathsOutsideManifest',(select count(*) from run cross join lateral jsonb_array_elements_text(run.removed_paths) p(path) where not exists(select 1 from duplicates d where d.path=p.path)),
 'events',(select count(*) from private.enl_storage_dedup_events where migration_id='enl-storage-dedup-20261023-v472'),
 'removalEvents',(select count(*) from private.enl_storage_dedup_events where migration_id='enl-storage-dedup-20261023-v472' and action in ('duplicate_removed','duplicate_already_absent_after_verified')),
 'verifiedBeforeEvents',(select count(*) from private.enl_storage_dedup_events where migration_id='enl-storage-dedup-20261023-v472' and action='verified_before'),
 'verifiedAfterEvents',(select count(*) from private.enl_storage_dedup_events where migration_id='enl-storage-dedup-20261023-v472' and action='verified_after'),
 'ledgerRlsTables',(select count(*) from ledgers where relrowsecurity),
 'ledgerClientGrants',(select count(*) from ledgers l cross join lateral aclexplode(coalesce(l.relacl,acldefault('r',l.relowner))) a where a.grantee=0 or a.grantee in(select oid from pg_roles where rolname in ('anon','authenticated','service_role'))),
 'immutableAuditTrigger',(select count(*) from pg_trigger where tgrelid='private.enl_storage_dedup_events'::regclass and tgname='enl_storage_dedup_events_immutable' and tgenabled='O' and not tgisinternal)
) as verification;
