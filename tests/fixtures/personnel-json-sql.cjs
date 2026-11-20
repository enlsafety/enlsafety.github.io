// Match postgres.js 3.4.5: server-inferred JSONB parameters and sql.json use JSON.stringify.
// Passing JSON.stringify(record) to ::jsonb produces a JSON string, not an object.
exports.tag=conn=>async(parts,...args)=>{
 const params=args.map((value,i)=>value?.__jsonParameter?JSON.stringify(value.value):
   value!=null&&/^\s*::jsonb/.test(parts[i+1])?JSON.stringify(value):value);
 return (await conn.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),params)).rows;
};
