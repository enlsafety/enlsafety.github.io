// Replace the temporary activation runner after independent verification.
// No imports, credentials, SQL, or database connection remain.
Deno.serve(()=>new Response(JSON.stringify({ok:false,code:"maintenance_completed"}),{
  status:410,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
}));
