(function activate() {
"use strict";
const sandbox=window.ENL_ZEROWIZ_SANDBOX;
if(!sandbox)throw Error("DEMO_SAFETY_BOOT_MISSING");
if(window.ENL_DEMO_ISOLATED!==true||window.localStorage?.length<0)throw Error("DEMO_ISOLATION_UNVERIFIED");
const appRoot=document.getElementById("app");
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ROLE_LABEL={safety:"안전관리자",field:"현장관리자",worker:"현장근무자",manager:"본사관리자",executive:"경영진"};
let activeRole="";
let toolbarExpanded=false;
function setToolbarOpen(open){
 toolbarExpanded=!!open;
 const toolbar=document.getElementById("zwRuntimeToolbar");if(!toolbar)return;
 toolbar.dataset.expanded=String(toolbarExpanded);
 const toggle=toolbar.querySelector("#zwRuntimeToggle");
 if(toggle){
  toggle.setAttribute("aria-expanded",String(!!open));
  toggle.setAttribute("aria-label",open?"데모 관리 도구 닫기":"데모 관리 도구 열기");
 }
}
function decorateToolbar(){
 let host=document.getElementById("zwRuntimeToolbar");
 if(!host){
  host=document.createElement("aside");host.id="zwRuntimeToolbar";
  document.body.appendChild(host);
 }
 host.innerHTML=`<button id="zwRuntimeToggle" class="zw-runtime-toggle" type="button" aria-controls="zwRuntimeControls" aria-expanded="false" aria-label="데모 관리 도구 열기">데모 관리 <span aria-hidden="true">⋯</span></button><div id="zwRuntimeControls" class="zw-runtime-controls"><strong class="zw-runtime-label">ZERO-WIZ DEMO <small>운영본과 분리된 가상 화면</small></strong><label class="zw-runtime-rolelabel" for="zwRuntimeRoleSelect">테스트 계정</label><select id="zwRuntimeRoleSelect" aria-label="데모 역할 전환"><option value="">테스트 계정 변경</option>${sandbox.users.map(u=>`<option value="${u.id}" ${u.id===activeRole?'selected':''}>${ROLE_LABEL[u.role]}</option>`).join("")}</select><button id="zwRuntimeReset" type="button">가상 자료 초기화</button></div>`;
 setToolbarOpen(toolbarExpanded);
 host.querySelector("#zwRuntimeToggle").addEventListener("click",()=>setToolbarOpen(host.dataset.expanded!=="true"));
 host.querySelector("#zwRuntimeRoleSelect").addEventListener("change",ev=>{if(ev.target.value)chooseRole(ev.target.value)});
 host.querySelector("#zwRuntimeReset").addEventListener("click",()=>{
  if(!window.confirm("제로위즈 데모에 입력한 가상 자료를 모두 초기화할까요? 운영 자료에는 영향이 없습니다."))return;
  sandbox.reset();
  const who=sandbox.users.find(x=>x.id===activeRole);
  if(who)chooseRole(who.id);
  else showSelector();
 });
}
document.addEventListener("pointerdown",event=>{
 const toolbar=document.getElementById("zwRuntimeToolbar");
 if(toolbar?.dataset.expanded==="true"&&!toolbar.contains(event.target))setToolbarOpen(false);
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&document.getElementById("zwRuntimeToolbar")?.dataset.expanded==="true"){
  setToolbarOpen(false);
  document.getElementById("zwRuntimeToggle")?.focus();
 }
});
function showSelector(){
 session=null;try{saveSession()}catch(e){}
 activeRole="";
 appRoot.innerHTML=`<div class="login-page login-v411"><div class="login-card"><div class="login-brand"><div class="logo">E&L</div><div><h1>이앤엘 사고보고앱</h1><p>제로위즈 ERP 기술검토 · 운영화면 동일 구성</p></div></div><div class="zw-runtime-welcome"><strong>체험할 역할을 선택해 주세요.</strong><span>선택하면 실제 운영 앱의 메뉴와 입력·결재 화면이 열립니다. 모든 사업장·직원·사고는 가상입니다.</span></div><div class="zw-runtime-rolecards">${sandbox.users.map(u=>`<button type="button" data-zw-role="${u.id}" class="zw-runtime-role"><b>${ROLE_LABEL[u.role]}</b><span>${escape(u.name)} · ${escape(u.department||u.position||"가상 현장")}</span><em>이 계정으로 화면 열기 →</em></button>`).join("")}</div><div class="zw-runtime-explanation">운영 Supabase API·메일·푸시·첨부 서버와 연결하지 않습니다. 탭을 닫으면 테스트 작업내역이 초기화될 수 있습니다. 실제 사고·인적정보를 입력하지 마세요.</div></div></div>`;
 appRoot.querySelectorAll("[data-zw-role]").forEach(b=>b.addEventListener("click",()=>chooseRole(b.dataset.zwRole)));
 decorateToolbar();
}
function chooseRole(id){
 const u=sandbox.users.find(x=>x.id===id);if(!u)return;
 activeRole=id;
 setToolbarOpen(false);
 data.users=sandbox.users.map(x=>structuredClone(x));
 data.sites=sandbox.sites.map(x=>({id:x.id,name:x.name,region:x.region,active:true}));
 const display=u.role==="safety"||u.role==="manager"||u.role==="executive"
  ?sandbox.db.incidents
  :sandbox.db.incidents.filter(i=>i.siteId===u.siteId&&(u.role!=="worker"||i.reporterId===u.id));
 data.incidents=structuredClone(display);
 try{saveData()}catch(e){}
 session=u.role==="worker"?{loggedAt:nowISO(),worker:{...u}}:{loggedAt:nowISO(),manager:{...u}};
 try{saveSession()}catch(e){}
 currentView="home";
 try{
  if(typeof window.enlRenderApp==="function")window.enlRenderApp(u);
  else if(typeof window.renderShell==="function")window.renderShell(u);
 }catch(e){
  console.error("demo actual shell error",e);
  appRoot.innerHTML='<div class="panel" style="margin:24px"><h2>데모 화면 구동 오류</h2><p>'+escape(e.message)+'</p><button id="zwRuntimeRetry">다시 시도</button></div>';
  document.getElementById("zwRuntimeRetry")?.addEventListener("click",()=>chooseRole(id));
 }
 decorateToolbar();
 try{window.enlIncidentPullNow?.().catch?.(e=>console.warn("demo isolated incident pull",e))}catch(e){}
}
window.enlRenderLogin=showSelector;
window.renderLogin=showSelector;
window.ENL_ZEROWIZ_FIDELITY={
 version:"2.0.2",
 selectRole:chooseRole,
 showLogin:showSelector,
 getRole:()=>activeRole,
 getRecords:()=>structuredClone(sandbox.db.incidents),
 getRequests:sandbox.getRequests,
 getNetworkBlocks:sandbox.getNetworkBlocks
};
const requestedRole=new URLSearchParams(location.search).get("role");
if(requestedRole&&sandbox.users.some(u=>u.id===requestedRole))chooseRole(requestedRole);
else showSelector();
// Keep all shared-app login rendering hidden until the demo runtime is fully ready.
appRoot.style.visibility="visible";
try{
 if(window.parent!==window)window.parent.postMessage({type:"ENL_ZW_DEMO_READY",role:activeRole,version:"2.0.2"},"*");
}catch(e){}
})();
