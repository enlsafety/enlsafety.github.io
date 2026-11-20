const fs=require('node:fs'),assert=require('node:assert/strict');const meta=JSON.parse(fs.readFileSync('version.json')),html=fs.readFileSync('stable412.html','utf8'),sw=fs.readFileSync('sw-v418.js','utf8'),index=fs.readFileSync('index.html','utf8');assert.equal(meta.build,'stable-4813-r179');assert.equal(meta.version,'4.8.13');assert.ok(html.includes('content="4.8.13-r179"'));assert.ok(sw.includes("ENL_SW_VERSION='4.8.13-r179'"));assert.ok(index.includes("BUILD='4813-r179'"));assert.ok(html.includes('site-dashboard-v450.js?v=4.6.0-r3'),'map cache version');assert.ok(html.includes('auth-v411.js?v=4.8.2-r1'));assert.ok(fs.existsSync('zerowiz-demo.html')&&fs.existsSync('zerowiz-demo.js')&&fs.existsSync('zerowiz-demo.css'),'vendor demo files must exist');assert.ok(sw.includes("url.pathname.startsWith('/zerowiz-')"),'all demo pages and assets bypass PWA cache');for(const f of ['zerowiz-demo-app.html','zerowiz-fidelity-boot.js','zerowiz-fidelity-runtime.js','zerowiz-fidelity.css','zerowiz-fidelity-dashboard.js'])assert.ok(fs.existsSync(f),'actual operational UI demo asset '+f);for(const f of ['closed-incident-reopen-v438.js', 'historical-correction-v461.js', 'incident-excel-v421.js', 'incident-flow-v440.js', 'incidents-v410.js', 'official-records-v439.js', 'report-v410.css', 'report-v410.js', 'required-fields-v453.js', 'workflow-enhancements-v432.js', 'workflow-lifecycle-v413.js', 'workflow-prevention-v429.js', 'zerowiz-fidelity-boot.js', 'zerowiz-fidelity-runtime.js'])assert.ok((f.startsWith('zerowiz-')?fs.readFileSync('docs/disabled-demo/zerowiz-demo-app.html.txt','utf8'):html).includes(f+'?v='+(['report-v410.js','workflow-prevention-v429.js','workflow-lifecycle-v413.js','incident-flow-v440.js'].includes(f)?'4.8.2-r1':['closed-incident-reopen-v438.js','report-v410.js','incident-flow-v440.js','workflow-prevention-v429.js'].includes(f)?'4.7.3-r1':['incidents-v410.js','report-v410.css'].includes(f)?'4.7.2-r3':['incident-flow-v440.js','zerowiz-fidelity-boot.js'].includes(f)?'4.7.2-r2':['incident-excel-v421.js','official-records-v439.js'].includes(f)?'4.7.1-r1':'4.7.0-r1')),f+' must refresh');for(const f of ['reader-ack-ux-v423.js','historical-bulk-ui-v454.js']){assert.ok(!html.includes(f));assert.ok(!sw.includes('/'+f))}for(const x of html.matchAll(/(?:src|href)="([^"?]+)(?:\?[^" ]*)?"/g)){if(!/^(https?:|data:|#)/.test(x[1]))assert.ok(fs.existsSync(x[1]),x[1])}console.log('PASS release/cache/local runtime assets and retired script exclusion');

assert.ok(index.includes('/sw-v418.js?v=4.8.13-r179') && html.includes('/sw-v418.js?v=4.8.13-r179'), 'PWA registration must re-install to refresh precache');
assert.ok(html.includes('report-calendar-v465.js?v=4.6.5-r1') && html.includes('report-calendar-v465.css?v=4.6.5-r1'), 'cross-device incident date picker must be loaded');

assert.ok(html.includes("incident-one-page-excel-v471.js?v=4.7.1-r1") && sw.includes("/incident-one-page-excel-v471.js"), "one-page exporter must be loaded and cached");

for(const page of [html,fs.readFileSync('docs/disabled-demo/zerowiz-demo-app.html.txt','utf8')]){assert.ok(page.includes('attachment-image-v472.js?v=4.7.2-r2'),'image optimizer loaded');assert.ok(page.indexOf('attachment-image-v472.js')<page.indexOf('core.js?v='),'optimizer loads before upload pipeline');}
assert.ok(sw.includes('/attachment-image-v472.js'),'optimizer precached for PWA');

for(const file of ["core.js","admin.js","incident-sync-v411.js", "sync-conflict-v428.js", "closed-incident-reopen-v438.js", "report-v410.js", "incident-flow-v440.js", "workflow-prevention-v429.js"]){for(const page of [html,fs.readFileSync("docs/disabled-demo/zerowiz-demo-app.html.txt","utf8")])assert.ok(page.includes(file+"?v="+(page===html&&file==="core.js"?"4.8.4-r1":page===html&&["report-v410.js","workflow-prevention-v429.js","incident-sync-v411.js","sync-conflict-v428.js","incident-flow-v440.js"].includes(file)?"4.8.2-r1":"4.7.3-r1")),file+" stability release cache key");}

for(const file of ['legal-review-v435.js','ui-stability-v422.js'])assert.ok(html.includes(file+'?v=4.8.2-r1'),file+' HQ settings fix cache key');

const policy=fs.readFileSync('executive-approval-v482.js','utf8');
for(const name of ['enl-incident-sync-v411','enl-push-v418','enl-email-v441'])assert.equal(fs.readFileSync('edge-functions/'+name+'/executive-approval-v482.js','utf8'),policy,'shared executive policy '+name);
assert.ok(html.indexOf('executive-approval-v482.js')<html.indexOf('management-approval-v448.js')&&sw.includes('/executive-approval-v482.js'),'approval policy loaded and cached');

assert.ok(html.includes('push-session-v425.js?v=4.8.5-r1'),'approval mail deep-link cache key');

assert.ok(html.includes('incident-review-v431.js?v=4.8.4-r1'),'single preview repair cache key');

assert.ok(html.includes('incident-view-v485.js?v=4.8.5-r1')&&sw.includes('/incident-view-v485.js'),'first view tracking loaded and cached');

assert.ok(html.indexOf('approval-sheet-v486.js')<html.indexOf('management-approval-v448.js')&&sw.includes('/approval-sheet-v486.js'),'shared approval sheet loaded before approval UI');

for(const file of ['responsive-v432.css','incident-stats-v426.js','workflow-enhancements-v432.js','site-dashboard-v450.js']){
 const asset=html.split('"').find(url=>url.startsWith(file+'?'));
 assert.ok(asset && asset.includes('dashboard=486-r2'),file+' dashboard cache key');
}

assert.ok(html.includes('approval-sheet-v486.js?v=4.8.6-r3') && html.includes('management-approval-v448.js?v=4.8.2-r1&amp;view=485-r1&amp;layout=486-r3'), 'approval sheet and print preview cache keys');

assert.ok(html.includes('layout=486-r3&amp;badges=486-r4&amp;ui=487-r1'), 'executive approval badge assets refreshed');

for(const url of ['admin.js?v=4.7.3-r1&amp;fix=modal-drag1&amp;session=489-r1','session-refresh-v412.js?v=4.8.9-r1','app-control-v410.js?v=4.8.9-r1','incident-sync-v411.js?v=4.8.2-r1&amp;ui=487-r1&amp;session=489-r1'])assert.ok(html.includes(url),url);
assert.ok(html.indexOf('session-refresh-v412.js')<html.indexOf('auth-v411.js'),'restore login before starting the app');

assert.match(html,/management-approval-v448\.js\?[^"]*&amp;recent=4811-r1/, 'recent report layout cache key');

for(const asset of ["incidents-v410.js", "report-v410.js", "report-v410.css", "incident-flow-v440.js", "workflow-prevention-v429.js", "incident-excel-v421.js", "incident-one-page-excel-v471.js", "official-records-v439.js"]){const url=html.split('"').find(v=>v.startsWith(asset+'?'));assert.ok(url?.includes('review=4812-r1'),asset+' summary release');}

for(const asset of ["approval-sheet-v486.js", "incident-view-v485.js", "management-approval-v448.js", "pwa-push-v418.js", "report-v410.js", "report-v410.css", "workflow-prevention-v429.js"]){const url=html.split('"').find(v=>v.startsWith(asset+'?'));assert.ok(url?.includes('reads=4813-r1'),asset+' read history release');}

assert.ok(html.includes('safety-ui.css?v=4813-r128') && sw.includes('/safety-ui.css'), 'screen theme is available offline');

for(const file of ["field-ui-v411.js","field-incidents-v411.js","workflow-prevention-v429.js","safety-ui.css"]){const url=html.split('"').find(v=>v.startsWith(file+'?'));assert.ok(url?.includes('fieldmenu=4813-r10'),file+' field menu cache key');}

for(const f of ["official-records-v439.js","incident-sync-v411.js","incidents-v410.js","incident-flow-v440.js"]){const url=html.split('"').find(v=>v.startsWith(f+'?'));assert.ok(url?.includes('deletion=4813-r11'),f+' password deletion release');}

for(const f of ["management-approval-v448.js","report-v410.js","report-v410.css","official-records-v439.js","incident-one-page-excel-v471.js"]){const url=html.split('"').find(v=>v.startsWith(f+'?'));assert.ok(url?.includes("queuepdf=4813-r12"),f+" queue and field PDF release");}

const hubStyle=fs.readFileSync("platform-dashboard.css","utf8");
assert.ok(hubStyle.includes("assets/hub-icons-r43.png") && sw.includes("/assets/hub-icons-r43.png") && fs.existsSync("assets/hub-icons-r43.png"), "original transparent home artwork must be deployed and available offline");

assert.equal(require("node:crypto").createHash("sha256").update(fs.readFileSync("assets/hub-icons-r43.png")).digest("hex"), "ae07551a7809af0a2015c98260dc6ab8d6c6bd3b78c62720425782d5625659a4", "approved 3D artwork must remain unchanged during rendering-only repair");

assert.ok(html.includes('login-scene.css?v=4813-r50') && sw.includes('/login-scene.css') && sw.includes('/assets/login-golf-r46.png'), 'golf login scene must load online and offline');
assert.ok(html.includes('auth-v411.js?v=4.8.2-r1&amp;login=4813-r46') && html.includes('login-layout-v412.js?login=4813-r46'), 'login template and keyboard helper cache keys');
assert.ok(fs.existsSync('assets/login-golf-r46.png') && !html.includes('login-scene-fixture'), 'production scenery exists and isolated login fixture is excluded');

const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest'));
assert.equal(manifest.id,'/stable412.html','installed application identity stays stable');
const launcherDir='/assets/app-icons/sky-r53/';
function checkLauncher(path){
 assert.ok(path.startsWith(launcherDir));
 const filename=path.slice(launcherDir.length);
 assert.deepEqual(fs.readFileSync(path.slice(1)),fs.readFileSync(filename),'installed icon matches current app artwork: '+filename);
 assert.ok(sw.includes('"'+path+'"'),'launcher icon precached: '+filename);
}
for(const icon of manifest.icons)checkLauncher(icon.src);
assert.ok(manifest.icons.some(i=>i.purpose==='maskable'&&i.src.includes('pwa-icon-maskable-512.png')));
for(const page of [html,index]){
 assert.ok(page.includes('href="manifest.webmanifest"'),'stable manifest discovery URL');
 for(const match of page.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g))checkLauncher('/'+match[1]);
 assert.ok(page.includes(launcherDir.slice(1)+'favicon.ico')&&page.includes(launcherDir.slice(1)+'pwa-icon-180.png'));
}

assert.ok(html.includes('attachment-drop-v4813.js?v=4813-r76') && sw.includes('/attachment-drop-v4813.js'),'file drop handler loaded and available offline');
for(const file of ['core.js','incident-flow-v440.js','historical-followup-v452.js']){
 const url=html.split('"').find(value=>value.startsWith(file+'?'));
 assert.ok(url?.includes('drop=4813-r76'),file+' attachment drop release');
}

for(const file of ['report-v410.js','report-calendar-v465.js','report-calendar-v465.css']){
 const url=html.split('"').find(value=>value.startsWith(file+'?'));
 assert.ok(url?.includes('entry=4813-r77'),file+' numeric date/time entry release');
}

for(const file of ["report-v410.js","closed-incident-reopen-v438.js"]){const url=html.split('"').find(value=>value.startsWith(file+"?"));assert.ok(url?.includes("pastedit=4813-r78"),file+" historical name editing release");}

for(const file of ["approval-sheet-v486.js","management-approval-v448.js","pwa-push-v418.js","report-v410.js","closed-incident-reopen-v438.js"]){const url=html.split('"').find(value=>value.startsWith(file+"?"));assert.ok(url?.includes("reviewux=4813-r80"),file+" report review release");}

for(const file of ["platform-dashboard.js","platform-dashboard.css","platform.js","activity-history.js"]){assert.ok(html.split('"').find(x=>x.startsWith(file+"?"))?.includes("hubwork=4813-r83"),file+" fresh integrated work release");}

for(const file of ["platform-dashboard.js","platform-dashboard.css"]){assert.ok(html.split('"').find(x=>x.startsWith(file+"?"))?.includes("banner=4813-r84"));}
for(const file of ["golf-fire-r84.webp","health-check-2026-r84.webp"]){assert.ok(fs.existsSync("assets/banners/"+file));assert.ok(sw.includes("/assets/banners/"+file));}

// This offline asset is downloadable before login. Keep personnel details in the authenticated directory.
{
 const source=fs.readFileSync('site-master-seed-v400.js','utf8'),scope={window:{}};
 require('node:vm').runInNewContext(source,scope);
 const sites=scope.window.ENL_SITE_MASTER_SEED;
 assert.ok(sites.length>=33 && sites.every(s=>s.site_id && s.site_name));
 assert.ok(!/01[016789][ -]?\d{3,4}[ -]?\d{4}/.test(source),'public seed must not include mobile numbers');
 for(const site of sites)for(const key of Object.keys(site)){
  assert.ok(!['manager_name','part_name','clerk_name','agency_manager'].includes(key) && !/phone|email/i.test(key),'private contact field in offline site directory');
 }
}

/* Accident event-type regression: preserve legacy labels and the new flying-object category. */
{
  const fn=fs.readFileSync('core.js','utf8').split(String.fromCharCode(10)).find(line=>line.startsWith('function eventTypeOptions('));
  assert.ok(fn,'eventTypeOptions source exists');
  const options=require('node:vm').runInNewContext(fn+"; eventTypeOptions('맞음(날아옴)')");
  for(const label of ['넘어짐','부딪힘','맞음(날아옴)','베임/찔림','끼임','추락','차량/중장비','감전','화재/폭발','붕괴/전도','질식/중독','근골격','설비/시설 파손','기타']){
    assert.ok(options.includes('>'+label+'</option>'),'missing accident type: '+label);
  }
  assert.ok(options.includes('<option selected>맞음(날아옴)</option>'),'new type selection persists');
  assert.equal((options.match(/ selected/g)||[]).length,1,'only selected type highlighted');
  assert.ok(html.split('"').find(x=>x.startsWith('core.js?'))?.includes('eventtype=4813-r127'),'core cache key updated');
}
console.log('PASS flying-object incident category and existing types');

assert.ok(html.includes('risk-assessment.js?v=4813-r129') && sw.includes('/risk-assessment.js'),'risk workspace is served and available offline');

for(const name of ["processing-state.js","incident-analysis.js","incident-analysis.css"])assert.ok(html.includes(name+"?v=4813-r130")&&sw.includes("/"+name),name+" release asset");

for(const file of ["incident-analysis.js","incident-analysis.css","incident-stats-v426.js"])assert.ok(html.split('"').find(x=>x.startsWith(file+"?"))?.includes("dashboardmerge=4813-r131"));

for(const file of ["incident-analysis.js","incident-analysis.css","incident-stats-v426.js","site-dashboard-v450.js"])assert.ok(html.split('"').find(x=>x.startsWith(file+"?"))?.includes("details=4813-r132"));

for(const file of ['incident-analysis.js', 'incident-analysis.css', 'incident-stats-v426.js', 'site-dashboard-v450.js', 'organization.css', 'organization.js', 'risk-assessment.js'])assert.ok(html.split('"').find(x=>x.startsWith(file+"?"))?.includes("visual=4813-r133"));

for(const asset of ['risk-editor.js','risk-assessment.css']){assert.ok(html.includes(asset+'?v=4813-r134'));assert.ok(sw.includes('/'+asset));}
assert.ok(html.split('\"').find(x=>x.startsWith('risk-assessment.js?'))?.includes('records=4813-r134'));

for(const asset of ['platform-dashboard.js','platform-dashboard.css'])assert.ok(html.split('\"').find(x=>x.startsWith(asset+'?'))?.includes('sidebar=4813-r135'));
assert.ok(sw.includes('/assets/sidebar-outline-r135.svg'));

for(const file of ["incident-analysis.js","incident-analysis.css","workflow-lifecycle-v413.js"])assert.ok(html.split('"').find(x=>x.startsWith(file+"?"))?.includes("strategy=4813-r136"));

for(const file of ["incident-analysis.js","incident-analysis.css"])assert.ok(html.split('"').find(x=>x.startsWith(file+"?"))?.includes("compact=4813-r137"));

for(const f of ["analysis-target-policy.js","analysis-targets.js"])assert.ok(html.includes(f+"?v=4813-r138")&&sw.includes("/"+f));

for(const file of ["management-points.js","management-points.css"]){assert.ok(html.includes(file+"?v=4813-r140")&&sw.includes("/"+file),"management summary loaded and precached");}
assert.ok(html.indexOf("management-points.js?")<html.indexOf("incident-stats-v426.js?"),"summary available before dashboard rendering");

for(const file of ["risk-paper-templates.js","risk-paper.js"]){assert.ok((file==="risk-paper-templates.js"?fs.readFileSync("risk-editor.js","utf8"):html).includes(file+"?v=4813-r144"));assert.ok(sw.includes("/"+file));}
for(const file of ["platform-dashboard.js","platform.js","app-shell-v411.js","ui-stability-v422.js","auth-v411.js","organization.js","risk-assessment.js","risk-editor.js","risk-assessment.css","activity-history.js"])assert.ok(html.split('"').find(x=>x.startsWith(file+"?"))?.includes("retain=4813-r144"),file+" retained workspace cache key");

for(const file of ['platform-dashboard.js','platform-dashboard.css'])assert.ok(html.split('"').find(url=>url.startsWith(file+'?'))?.includes('newsroom=4813-r150'));

assert.ok(html.split('"').find(url=>url.startsWith('platform.js?'))?.includes('homecards=4813-r147'));

for(const file of ['organization.css','organization.js','platform-dashboard.js','reader-experience-v424.js','incident-view-v485.js','incident-sync-v411.js','risk-assessment.js'])assert.ok(html.split('"').find(url=>url.startsWith(file+'?'))?.includes('workalerts=4813-r152'),file);

assert.ok(html.split('"').find(url=>url.startsWith('site-dashboard-v450.js?'))?.includes('labels=4813-r161'));
assert.ok(html.split('"').find(url=>url.startsWith('platform-dashboard.js?'))?.includes('sidebarmenu=4813-r157'));
assert.ok(html.split('"').find(url=>url.startsWith('management-approval-v448.js?'))?.includes('dashboard=4813-r158'));
for(const asset of ['safety-card-model.js','safety-card.js','safety-card.css'])assert.ok(html.includes(asset+'?v=4813-'+(asset==='safety-card-model.js'?'r159':'r161'))&&sw.includes('/'+asset),asset+' is loaded and precached');
assert.ok(html.indexOf('safety-card-model.js?')<html.indexOf('safety-card.js?')&&html.indexOf('safety-card.js?')<html.indexOf('platform-dashboard.js?'),'card module available before navigation');

for(const file of ["incident-analysis.js","incident-analysis.css","analysis-targets.js","app-shell-v411.js"])assert.ok(html.split('"').find(url=>url.startsWith(file+"?"))?.includes("plan=4813-r162"),file+" refreshed analysis layout");

for(const file of ["management-points.js","management-points.css","platform-dashboard.css","incident-sync-v411.js"])assert.ok(html.split('"').find(url=>url.startsWith(file+"?"))?.includes("points=4813-r163"),file+" refreshed summary layout and readiness");

for(const file of ['safety-card-model.js','safety-card.js','safety-card.css','site-admin-v415.js','platform-dashboard.js'])assert.ok(html.split('\"').find(url=>url.startsWith(file+'?'))?.includes('linked=4813-r164'),file+' refreshed card data integration');

for(const file of ['safety-card-model.js','safety-card.js','safety-card.css'])assert.ok(html.split('\"').find(url=>url.startsWith(file+'?'))?.includes('editing=4813-r165'),file+' refreshed editable linked fields');

assert.ok(html.split('\"').find(url=>url.startsWith('safety-card.js?'))?.includes('print=4813-r166'),'print selected values refreshed');

for(const file of ['safety-card-model.js','safety-card.js','safety-card.css','site-admin-v415.js'])assert.ok(html.split('\"').find(url=>url.startsWith(file+'?'))?.includes('primary=4813-r167'),file+' refreshed primary source and full-width history');

for(const file of ['form-drafts.js','core.js','report-v410.js','incident-sync-v411.js','workflow-prevention-v429.js','closed-incident-reopen-v438.js','safety-ui.css'])assert.ok(html.split('\"').some(url=>url.startsWith(file+'?')&&url.includes('serverdraft=4813-r168')),file+' account draft release');

for(const file of ["policy-management.js","policy-management.css"]){assert.ok(html.includes(file+"?v=4813-r174"),file+" policy release key");assert.ok(sw.includes("/"+file),file+" available offline");}
assert.ok(html.indexOf("policy-management.js?")<html.indexOf("platform-dashboard.js?"),"policy module loads before workspace initialization");

for(const f of ["organization.js","organization.css"])assert.ok(new RegExp(f.replace(".","\\.")+"[^\"]*steps=4813-r179").test(html),f+" workflow guide cache key");
