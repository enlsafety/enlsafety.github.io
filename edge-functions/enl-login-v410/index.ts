Deno.serve(() => Response.json({ok:false,message:"legacy_api_retired_update_required"}, {status:410,headers:{"Cache-Control":"no-store"}}));
