'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite'),Core=require('../historical-bulk-core-v454.js');
(async()=>{
 const db=new PGlite(),batch='11111111-1111-4111-8111-111111111111',actor={id:'qa-safety',role:'safety'};
 await db.exec("create schema private; create table public.enl_hq_users(user_id text primary key,role text,active boolean); create table private.enl_historical_batches(id uuid primary key,owner_id text,erp_confirmed_at timestamptz not null,candidates jsonb); create table public.enl_incident_shared(incident_id text primary key,site_id text,payload jsonb); insert into public.enl_hq_users values('qa-safety','safety',true);");
 await db.exec(fs.readFileSync('supabase/migrations/20261012163000_bulk_legacy_approval_exception.sql','utf8'));
 await db.exec('create trigger bulk_guard before insert or update or delete on public.enl_incident_shared for each row execute function private.enl_bulk_lifecycle_guard()');
 const header=['사업장명','사고일','사고구분','사고유형','사고정도','사고장소','당시작업','사고경위','당시조치','파손물품','파손내용'];
 const row=['QA골프장','2025-02-10','대물','충돌','경미','창고','장비운반','운반 중 장비 충돌','작업 중지','장비','장비 파손'];
 const sites=[{site_id:'s1',site_name:'QA골프장'}];
 const c=Core.analyze([{id:'source',method:'text',units:[{location:'QA 원본',rows:[header,row]}]}],sites)[0];
 Object.assign(c.values,{legacyApprovalMode:'pre_employment',legacyApprovalReason:'입사 이전 결재한 과거 사고에 대한 전자결재 자료 열람권한이 없어 번호를 확인할 수 없음',legacyApprovalConfirmed:'confirmed'});
 for(const field of ['legacyApprovalMode','legacyApprovalReason','legacyApprovalConfirmed'])c.corrections.push({field,actorId:'qa-safety',reason:'원본 대조'});
 assert.equal(Core.validate(c,sites).length,0);
 await db.query('insert into private.enl_historical_batches(id,owner_id,historical_material_confirmed_at,candidates) values($1,$2,now(),$3::jsonb)',[batch,actor.id,JSON.stringify([c])]);
 const record=Core.makeIncident(c,batch,actor,'2026-10-12T00:00:00Z','qa-incident');
 const transaction=fn=>db.transaction(async tx=>{await tx.query("select set_config('enl.actor',$1,true)",[JSON.stringify(actor)]);await tx.query("select set_config('enl.bulk_actor',$1,true)",[JSON.stringify(actor)]);return fn(tx)});
 await transaction(tx=>tx.query('insert into public.enl_incident_shared values($1,$2,$3::jsonb)',[record.id,record.siteId,JSON.stringify(record)]));
