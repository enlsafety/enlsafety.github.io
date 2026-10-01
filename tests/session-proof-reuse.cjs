const assert=require('node:assert/strict');

const store=new Map(),sessionStore=new Map();
global.window=global;
global.localStorage={
  getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k)
};
global.sessionStorage={
  getItem:k=>sessionStore.has(k)?sessionStore.get(k):null,
  setItem:(k,v)=>sessionStore.set(k,String(v)),
  removeItem:k=>sessionStore.delete(k)
};
let cookieValue='';
global.document={
  visibilityState:'visible',
  addEventListener(){},
  getElementById(id){return id==='enlRefreshSafeCss412'?{}:null},
  createElement(){return {style:{},textContent:'',id:''}},
  body:{appendChild(){}},
  get cookie(){return cookieValue},
  set cookie(v){cookieValue=String(v).split(';')[0]}
};
global.addEventListener=()=>{};
global.currentView='home';
global.currentUser=()=>global.session?.worker||global.session?.manager||null;
global.saveSession=()=>{};
global.session={
  loggedAt:new Date().toISOString(),
  manager:{id:'p-field-1',personnelId:'p-field-1',name:'테스트 현장소장',role:'field',siteId:'s01',pinHash:'pin-proof-hash'}
};

require('../session-refresh-v412.js');

const raw=JSON.parse(store.get('enl_safety_session_refresh_v412'));
assert.equal(raw.session.manager.pinHash,'pin-proof-hash','local durable session must retain verified PIN proof');

const encodedCookie=cookieValue.slice(cookieValue.indexOf('=')+1);
const cookieRow=JSON.parse(decodeURIComponent(encodedCookie));
assert.equal(cookieRow.session.manager.pinHash,undefined,'cookie backup must not contain PIN proof');
assert.equal(cookieRow.session.manager.passwordHash,undefined,'cookie backup must not contain password proof');

global.session=null;
window.enlRestoreForegroundSession();
assert.equal(global.session.manager.pinHash,'pin-proof-hash','restored local session must recover verified PIN proof');

console.log('PASS: local session retains login proof, cookie strips proof, restored field session reuses PIN silently');
