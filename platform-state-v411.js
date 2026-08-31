/* E&L Accident Report App v4.1.1 - shared platform state only */
const ENL_PLATFORM_SECTION_KEY='enl_safety_platform_section';
let enlPlatformSection='hub';
try{enlPlatformSection=localStorage.getItem(ENL_PLATFORM_SECTION_KEY)||'hub'}catch(e){}
function enlSetPlatformSection(section,u){
  enlPlatformSection=section||'hub';
  try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,enlPlatformSection)}catch(e){}
  if(enlPlatformSection==='hub')currentView='home';
  if(enlPlatformSection==='incident'&&currentView==='home')currentView='home';
  if(typeof renderShell==='function')renderShell(u||currentUser?.());
}
window.ENL_PLATFORM_STATE_VERSION='4.1.1';