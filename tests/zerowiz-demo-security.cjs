'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const toolbarStyle=fs.readFileSync('zerowiz-fidelity.css','utf8');
const parent=fs.readFileSync('zerowiz-demo.html','utf8'),
 child=fs.readFileSync('zerowiz-demo-app.html','utf8'),
 entry=fs.readFileSync('zerowiz-demo-entry.js','utf8'),
 boot=fs.readFileSync('zerowiz-fidelity-boot.js','utf8'),
 map=fs.readFileSync('zerowiz-fidelity-dashboard.js','utf8'),
 runtime=fs.readFileSync('zerowiz-fidelity-runtime.js','utf8'),
 stable=fs.readFileSync('stable412.html','utf8'),
 auth=fs.readFileSync('auth-v411.js','utf8'),
 sw=fs.readFileSync('sw-v418.js','utf8');
let passed=0;const ok=(x,m)=>{assert.ok(x,m);passed++};
ok(parent.includes('sandbox="allow-scripts allow-downloads"')&&!parent.includes('allow-same-origin'),'iframe must have opaque origin');
ok(parent.includes('id="zwFrame"')&&!parent.includes('src="zerowiz-demo-app'), 'demo iframe loads only after PIN and role choice');
ok(parent.includes('id="zwPin"')&&parent.includes('id="zwRolePanel"'),'PIN gate and five role selector appear before app loading');
ok(entry.includes('zerowiz-demo-app.html?v=2.0.2&role=')&&entry.includes('crypto.subtle.digest'), 'entry verifies supplied PIN and loads selected role');
ok(!entry.includes('6846'),'plain PIN must not be embedded in the demo entry script');
ok(child.includes('id="app" style="visibility:hidden"'),'legacy app login is concealed during bootstrap');
ok(child.includes("connect-src 'none'"),'all network fetch connections blocked by CSP');
ok(child.includes("form-action 'none'")&&child.includes("worker-src 'none'"),'no form posting or worker');
ok(!child.includes('navigator.serviceWorker?.register('),'no prod PWA registration');
ok(!child.includes('site-master-seed-v400.js')&&!child.includes('site-locations-v450.js'),'no real staff data or geolocation');
ok(!/<script src="site-directory-v410\.js/.test(child)&&!/<script src="site-dashboard-v450\.js/.test(child),'no hardcoded real business names or coordinates');
ok(!child.includes('zerowiz-demo.js'),'old simplified UI must not be loaded');
ok(child.includes('zerowiz-fidelity-dashboard.js?v=2.0.0'),'real site dashboard map rendering reused');
ok(!/소피아그린|백양우리|파주CC|010-\d{4}/.test(map),'map script contains no real business names or personnel');
ok(map.includes('전국 사업장 분포'),'uses operational Korea map component');
for(const path of ['core.js','app-shell-v411.js','report-v410.js','incidents-v410.js','incident-flow-v440.js','workflow-prevention-v429.js','closed-incident-reopen-v438.js']){
 ok(child.includes('<script src="'+path+'?'),'reuse exact operational component '+path);
}
for(const path of ['style.css','v3.css','report-v410.css','responsive-v432.css'])ok(child.includes('<link rel="stylesheet" href="'+path+'?'),'reuse exact production CSS '+path);
ok(child.includes('zerowiz-fidelity-boot.js')&&child.includes('zerowiz-fidelity-runtime.js'),'strict boot and five-role adapter');
ok(boot.indexOf('Object.defineProperty(window,"localStorage"')!==-1&&boot.includes('Object.defineProperty(window,"sessionStorage"'),'sandboxed memory-only storage');
ok(boot.includes('window.fetch=async')&&boot.includes('DEMO_NETWORK_BLOCKED'),'all in-app fetches simulated or rejected');
ok(!/https:\/\/wjelumpbjklfrdjxbesj/.test(boot),'no operational backend in synthetic data');
ok(!/010-\\d{4}|김상호|소피아그린|백양우리|파주CC/.test(boot),'no real accident site/employee seed');
for(const role of ['safety','field','worker','manager','executive'])ok(boot.includes('role:"'+role+'"'),'synthetic '+role+' account');
ok(boot.includes('incident("ZW-011"'),'eleven synthetic accidents');
ok(toolbarStyle.includes('bottom:10px')&&toolbarStyle.includes('display:none')&&toolbarStyle.includes('@media(max-width:620px)'),'desktop toolbar collapses without removing mobile bar');
ok(runtime.includes('id="zwRuntimeToggle"')&&runtime.includes('setToolbarOpen(false)'),'desktop control is accessible and dismissible');
ok(runtime.includes('window.enlRenderApp(u)'),'render actual app shell, not redesigned simulator');
ok(runtime.includes('data.users=sandbox.users'),'full staff data replaced with synthetic data');
ok(sw.includes("url.pathname.startsWith('/zerowiz-')"),'PWA will never cache any demo URL');
ok(auth.includes('href="zerowiz-demo.html?v=2.0.0"'),'operator login links to updated vendor demo');
ok(stable.includes('auth-v411.js?v=4.6.3-r2'),'login update cache busted');
new Function(boot);new Function(runtime);new Function(entry);
console.log(JSON.stringify({passed,failed:0,kind:'opaque iframe UI-clone and backend isolation source audit'}));
