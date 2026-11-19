'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
class Server{
 constructor(){this.rows=new Map();this.offline=false;this.lose=false;}
 async call(b){if(this.offline)throw Error('offline');const k=b.actor.role+':'+b.actor.id+':'+b.id;const fail=(m,s=409)=>{throw Object.assign(Error(m),{status:s})};const old=this.rows.get(k);
  if(b.action==='draft_list')return {drafts:[...this.rows.entries()].filter(([k,d])=>k.startsWith(b.actor.role+':'+b.actor.id+':')&&d.state==='active').map(([,d])=>clone(d))};
  if(b.action==='draft_get'){if(!old)fail('draft_not_found',404);return {draft:clone(old)}}
  if(old?.state&&old.state!=='active')fail('draft_finished');
  if(old?.mutationId===b.mutationId)return {draft:clone(old)};
  if((old?.revision||0)!==b.revision)fail('draft_conflict');
  const row={...clone(b),revision:(old?.revision||0)+1,state:b.action==='draft_delete'?'deleted':'active',updatedAt:new Date().toISOString()};this.rows.set(k,row);
  if(this.lose){this.lose=false;throw Error('lost response')}
  return {draft:clone(row)};
 }
}
module.exports={Server};
