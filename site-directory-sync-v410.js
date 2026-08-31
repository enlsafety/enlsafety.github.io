/* E&L Accident Report App v4.1.0 - shared site directory sync */
(function(){
  'use strict';
  let syncing=false;
  function localSite(id){return (data.sites||[]).find(s=>String(s.id)===String(id))}
  async function call(body,timeout=9000){if(typeof window.enlIncidentApi==='function')return window.enlIncidentApi(body,timeout);throw new Error('site_api_not_ready')}
  function mergeSites(rows){if(!Array.isArray(rows))return false;if(!Array.isArray(data.sites))data.sites=[];let changed=false;for(const r of rows){const id=String(r.site_id||'').trim();if(!id)continue;const name=String(r.site_name||id).trim();let s=localSite(id);if(!s){s={id,name,workerCount:Number(r.total_count||0),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};data.sites.push(s);changed=true}else{if(s.name!==name){s.name=name;changed=true}if(r.total_count!=null&&Number(s.workerCount||0)!==Number(r.total_count||0)){s.workerCount=Number(r.total_count||0);changed=true}}s.region=String(r.region||s.region||'');s.siteMasterUpdatedAt=r.updated_at||s.siteMasterUpdatedAt||''}window.ENL_SITE_DIRECTORY=(rows||[]).map(r=>({id:r.site_id,name:r.site_name,region:r.region||''}));if(changed){try{saveData()}catch(e){console.warn('site directory local save skipped',e)}}try{window.dispatchEvent(new Event('enl-site-directory-synced'))}catch(e){}return changed}
  async function sync(){if(syncing)return false;syncing=true;try{const res=await call({action:'site_directory'});return mergeSites(res?.sites||[])}catch(e){console.warn('shared site directory sync skipped',e);return false}finally{syncing=false}}
  window.enlSiteDirectorySync=sync;setTimeout(sync,1000);window.addEventListener('online',()=>setTimeout(sync,600));window.ENL_SITE_DIRECTORY_SYNC_VERSION='4.1.0';
})();