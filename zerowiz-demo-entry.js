(function zeroWizDemoEntry(){
"use strict";
// This PIN gate only prevents accidental entry; public GitHub Pages content is not private.
const expected="fd727a465e4d1e4c21740da9d82048a416a159ae88ce20ce40318b0f4ef5d604";
const form=document.getElementById("zwPinForm");
const pin=document.getElementById("zwPin");
const status=document.getElementById("zwPinStatus");
const rolePanel=document.getElementById("zwRolePanel");
const entry=document.getElementById("zwEntry");
const loading=document.getElementById("zwLoading");
const frame=document.getElementById("zwFrame");
const retry=document.getElementById("zwRetry");
const roles=new Set(["zw-safety","zw-field","zw-worker","zw-manager","zw-executive"]);
let selectedRole="",timeoutId=0;
async function verify(value){
 const input=new TextEncoder().encode("ENL-ZW-DEMO-"+value+"-ACCESS-v1");
 const digest=await crypto.subtle.digest("SHA-256",input);
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("")===expected;
}
form.addEventListener("submit",async event=>{
 event.preventDefault();
 const value=pin.value.trim();
 status.textContent="";
 if(!/^[0-9]{4}$/.test(value)){status.textContent="숫자 4자리를 입력해 주세요.";pin.focus();return;}
 const button=form.querySelector("button[type=submit]");
 button.disabled=true;
 try{
  if(!(await verify(value))){status.textContent="비밀번호가 일치하지 않아.";pin.value="";pin.focus();return;}
  pin.value="";
  form.hidden=true;
  rolePanel.hidden=false;
  rolePanel.querySelector("button")?.focus();
 }catch(error){status.textContent="비밀번호 확인에 실패했어. HTTPS 연결을 확인해 주세요.";}
 finally{button.disabled=false;}
});
function returnToRoles(){
 clearTimeout(timeoutId);
 selectedRole="";
 frame.hidden=true;
 frame.removeAttribute("src");
 loading.hidden=true;
 entry.hidden=false;
 rolePanel.querySelector("button")?.focus();
}
retry.addEventListener("click",returnToRoles);
document.querySelectorAll("[data-zw-entry-role]").forEach(button=>{
 button.addEventListener("click",()=>{
  const id=button.getAttribute("data-zw-entry-role");
  if(!roles.has(id))return;
  selectedRole=id;
  entry.hidden=true;
  frame.hidden=true;
  loading.hidden=false;
  retry.hidden=true;
  frame.src="zerowiz-demo-app.html?v=2.0.2&role="+encodeURIComponent(id);
  clearTimeout(timeoutId);
  timeoutId=setTimeout(()=>{
   if(!selectedRole)return;
   loading.querySelector("strong").textContent="데모 화면을 불러오지 못했어.";
   loading.querySelector("small").textContent="연결을 확인한 후 다시 시도해 주세요.";
   retry.hidden=false;
  },25000);
 });
});
window.addEventListener("message",event=>{
 if(event.source!==frame.contentWindow)return;
 const payload=event.data;
 if(!payload||payload.type!=="ENL_ZW_DEMO_READY"||payload.version!=="2.0.2"||payload.role!==selectedRole)return;
 clearTimeout(timeoutId);
 loading.hidden=true;
 frame.hidden=false;
});
})();
