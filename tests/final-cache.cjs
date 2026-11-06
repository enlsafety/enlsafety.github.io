const fs=require('node:fs'),assert=require('node:assert/strict');const meta=JSON.parse(fs.readFileSync('version.json')),html=fs.readFileSync('stable412.html','utf8'),sw=fs.readFileSync('sw-v418.js','utf8'),index=fs.readFileSync('index.html','utf8');assert.equal(meta.build,'stable-4813-r83');assert.equal(meta.version,'4.8.13');assert.ok(html.includes('content="4.8.13-r83"'));assert.ok(sw.includes("ENL_SW_VERSION='4.8.13-r83'"));assert.ok(index.includes("BUILD='4813-r83'"));assert.ok(html.includes('site-dashboard-v450.js?v=4.6.0-r3'),'map cache version');assert.ok(html.includes('auth-v411.js?v=4.8.2-r1'));assert.ok(fs.existsSync('zerowiz-demo.html')&&fs.existsSync('zerowiz-demo.js')&&fs.existsSync('zerowiz-demo.css'),'vendor demo files must exist');assert.ok(sw.includes("url.pathname.startsWith('/zerowiz-')"),'all demo pages and assets bypass PWA cache');for(const f of ['zerowiz-demo-app.html','zerowiz-fidelity-boot.js','zerowiz-fidelity-runtime.js','zerowiz-fidelity.css','zerowiz-fidelity-dashboard.js'])assert.ok(fs.existsSync(f),'actual operational UI demo asset '+f);for(const f of ['closed-incident-reopen-v438.js', 'historical-correction-v461.js', 'incident-excel-v421.js', 'incident-flow-v440.js', 'incidents-v410.js', 'official-records-v439.js', 'report-v410.css', 'report-v410.js', 'required-fields-v453.js', 'workflow-enhancements-v432.js', 'workflow-lifecycle-v413.js', 'workflow-prevention-v429.js', 'zerowiz-fidelity-boot.js', 'zerowiz-fidelity-runtime.js'])assert.ok((f.startsWith('zerowiz-')?fs.readFileSync('docs/disabled-demo/zerowiz-demo-app.html.txt','utf8'):html).includes(f+'?v='+(['report-v410.js','workflow-prevention-v429.js','workflow-lifecycle-v413.js','incident-flow-v440.js'].includes(f)?'4.8.2-r1':['closed-incident-reopen-v438.js','report-v410.js','incident-flow-v440.js','workflow-prevention-v429.js'].includes(f)?'4.7.3-r1':['incidents-v410.js','report-v410.css'].includes(f)?'4.7.2-r3':['incident-flow-v440.js','zerowiz-fidelity-boot.js'].includes(f)?'4.7.2-r2':['incident-excel-v421.js','official-records-v439.js'].includes(f)?'4.7.1-r1':'4.7.0-r1')),f+' must refresh');for(const f of ['reader-ack-ux-v423.js','historical-bulk-ui-v454.js']){assert.ok(!html.includes(f));assert.ok(!sw.includes('/'+f))}for(const x of html.matchAll(/(?:src|href)="([^"?]+)(?:\?[^" ]*)?"/g)){if(!/^(https?:|data:|#)/.test(x[1]))assert.ok(fs.existsSync(x[1]),x[1])}console.log('PASS release/cache/local runtime assets and retired script exclusion');

assert.ok(index.includes('/sw-v418.js?v=4.8.13-r83') && html.includes('/sw-v418.js?v=4.8.13-r83'), 'PWA registration must re-install to refresh precache');
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

assert.ok(html.includes('safety-ui.css?v=2') && sw.includes('/safety-ui.css'), 'screen theme is available offline');

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
