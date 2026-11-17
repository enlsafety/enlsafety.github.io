// Aggregate sizes only. Authorization precedes cache access on every request.
let storageCache:any=null,storageFlight:Promise<any>|null=null;
const storageTtl=300000;
export async function storageUsageRequest(sql:any,actor:any,reply:any){
 if(actor?.role!=='safety')return reply({ok:false,message:'safety_required'},403);
 if(storageCache&&Date.now()-storageCache.cachedAt<storageTtl)return reply({ok:true,...storageCache.data});
 try{
  if(!storageFlight)storageFlight=(async()=>{
   const [row]=await sql`select
    coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::numeric else 0 end),0)::text as file_bytes,
    count(*)::text as file_count,
    count(*) filter(where metadata->>'size' is null or metadata->>'size' !~ '^[0-9]+$')::text as unknown_files,
    (select coalesce(sum(pg_total_relation_size(c.oid)),0)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','m') and left(c.relname,4)='enl_') as database_bytes
    from storage.objects where left(bucket_id,4)='enl-'`;
   const values=[row?.file_bytes,row?.database_bytes,row?.file_count,row?.unknown_files].map(v=>v==null?NaN:Number(v));
   if(values.some(v=>!Number.isSafeInteger(v)||v<0))throw Error('invalid_size');
   const [fileBytes,databaseBytes,fileCount,unknownFiles]=values;
   const data={fileBytes,databaseBytes,fileCount,unknownFiles,checkedAt:new Date().toISOString(),scope:'app_files_and_tables'};
   storageCache={cachedAt:Date.now(),data};return data;
  })().finally(()=>{storageFlight=null});
  return reply({ok:true,...await storageFlight});
 }catch{return reply({ok:false,message:'storage_usage_unavailable'},503)}
}
