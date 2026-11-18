'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function check(browser, role) {
  const page = await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  const origin = 'http://newsroom.test';
  const now = new Date().toISOString();
  const notices = Array.from({length:7}, (_,i)=>({
    id:'post-'+i, kind:'notice', title:'검증 공지 '+i, body:'검증 본문 '+i,
    pinned:i===6 && role==='safety', label:i===5 && role==='manager'?'important':'general',
    created_at:new Date(Date.now()-i*86400000).toISOString()
  }));
  const approvalsOpen = ['safety','executive'].includes(role);
  const lead = role==='safety'?6:role==='manager'?5:0;
  const events=Array.from({length:12},(_,i)=>({id:'event-'+i,kind:'event',title:'검증 일정 '+i,body:'일정 내용',starts_at:now,ends_at:now}));
  let feedCount=8;
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
  try {
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      const file=path.join(process.cwd(),url.pathname);
      if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
      let body=fs.readFileSync(file);
      if(url.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
      if(url.pathname==='/tests/integrated-home-fixture.js'){
        body=body.toString().replace('let records=[]','let records='+JSON.stringify([...notices,...events.slice(0,feedCount)]));
        body=body.replace('const moduleKeys=', 'incidents.splice(0,1,...Array.from({length:'+feedCount+'},(_,i)=>({...incidents[0],id:"sample-"+i,corrective:{status:"submitted"}}))); const moduleKeys=');
        if(approvalsOpen)body=body.replaceAll("['incident','history','notices','system'].includes(key)","['incident','history','notices','system','approvals'].includes(key)");
      }
      return route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
    });
    await page.goto(origin+'/stable412.html?role='+role);
    await page.waitForFunction(()=>currentUser() && window.enlReturnToPlatform);
    await page.evaluate(()=>window.enlReturnToPlatform(currentUser()));
    const wrapper=page.locator('.hub-home-content');
    const rows=wrapper.locator('.hub-notice-row strong');
    await rows.first().waitFor();
    assert.deepEqual(await rows.allTextContents(),[notices[lead],...notices.filter((_,i)=>i!==lead).slice(0,4)].map(x=>x.title));
    const grid=wrapper.locator('.platform-modules > .platform-grid');
    await grid.locator('[data-module=incident]').waitFor();
    assert.equal(await wrapper.locator('[data-hub=edit]').count(),role==='safety'?1:0);
    assert.equal(await grid.locator('[data-key=system]').count(),role==='safety'?1:0);
    for(const width of [1440,1280,1024,768,390,320]){
      await page.setViewportSize({width,height:900});
      const boxes=await wrapper.evaluate(el=>{
        const rect=selector=>el.querySelector(selector).getBoundingClientRect().toJSON();
        const cards=Array.from(el.querySelector('.platform-modules > .platform-grid').children).map(c=>c.getBoundingClientRect()).filter(r=>r.width);
        return {notice:rect('.hub-bulletins'),schedule:rect('.hub-schedule'),approvals:rect('.hub-approvals'),features:rect('.hub-features'),recent:rect('.hub-recent'),
          firstRow:cards.filter(r=>r.top===cards[0].top).length,wide:cards.some(r=>r.x<0||r.right>innerWidth+1)};
      });
      const density=await page.evaluate(()=>{
        const banner=document.querySelector('.hub-hero'), bad=[];
        for(const slide of banner.querySelectorAll('.hub-banner-slide')){
          const bounds=slide.getBoundingClientRect();
          const walker=document.createTreeWalker(slide,NodeFilter.SHOW_TEXT);
          for(let node;node=walker.nextNode();){
            if(!node.textContent.trim())continue;
            const range=document.createRange();range.selectNodeContents(node);
            for(const r of range.getClientRects())if(r.width && (r.top<bounds.top-1 || r.bottom>bounds.bottom+1 || r.left<bounds.left-1 || r.right>bounds.right+1))bad.push(node.textContent);
          }
        }
        for(const card of document.querySelectorAll('.hub-features .feature-card-wrap')){
          if(!card.offsetWidth)continue;
          const bounds=card.getBoundingClientRect();
          for(const el of card.querySelectorAll('.hub-card-title,.hub-card-description,.platform-card>small')){
            if(!el.textContent.trim())continue;
            const range=document.createRange();range.selectNodeContents(el);
            for(const r of range.getClientRects())if(r.width && (r.top<bounds.top-1 || r.bottom>bounds.bottom+1 || r.left<bounds.left-1 || r.right>bounds.right+1))bad.push(el.textContent);
          }
        }
        const list=document.querySelector('.hub-bulletins');
        const lead=getComputedStyle(list.querySelector('.hub-notice-lead strong'));
        const regular=getComputedStyle(list.querySelector('.hub-notice-row:nth-child(2) strong'));
        const card=document.querySelector('.platform-modules [data-key=incident]');
        return {bad,height:banner.offsetHeight,cardHeight:card.offsetHeight,sameSize:lead.fontSize===regular.fontSize,color:lead.color,weight:lead.fontWeight};
      });
      assert.deepEqual(density.bad,[],'banner or card text at '+width);
      assert.ok(density.sameSize&&density.color==='rgb(170, 36, 60)'&&Number(density.weight)>=700);
      console.log('layout',role,width,density.height,density.cardHeight);
      const {notice,schedule,approvals,features,recent}=boxes;
      for(const rect of [notice,schedule,approvals,features,recent])assert.ok(rect.left>=0&&rect.right<=width+1,JSON.stringify({width,rect}));
      assert.ok(!boxes.wide && approvals.y>=schedule.bottom && features.y>=Math.max(notice.bottom,approvals.bottom) && recent.y>=features.bottom);
      if(width>1100){
        assert.equal(boxes.firstRow,4);
        assert.ok(schedule.x>notice.right && notice.width/(notice.width+schedule.width)>=0.64);
      }else assert.ok(schedule.y>=notice.bottom);
    }
    await page.setViewportSize({width:approvalsOpen?1440:390,height:900});
    const home=async()=>{await page.locator('[data-worktab=home]').click();await wrapper.waitFor()};
    await wrapper.locator('.hub-notice-lead').click();
    await page.getByRole('heading',{name:notices[lead].title,exact:true}).waitFor();
    assert.ok(await wrapper.isHidden());
    await home();
    await wrapper.locator('.hub-event-row').first().click();
    const dialog=page.locator('dialog[open]');
    await dialog.getByRole('heading',{name:'검증 일정 0'}).waitFor();
    await dialog.locator('header button').first().click();
    await wrapper.locator('[data-hub=schedule]').click();
    await page.locator('[data-list-workspace=schedule]').waitFor();
    await home();
    await wrapper.locator('[data-hub=approvals]').click();
    if(approvalsOpen){
      await page.locator('[data-approval-list]').waitFor();
      await home();
    }else{
      await page.locator('.hub-status').waitFor();
      assert.ok(await wrapper.isVisible());
      assert.equal(await page.locator('[data-worktab=approvals]').count(),0);
    }
    const recent=wrapper.locator('[data-list=recent] button').first();
    if(await recent.count()){
      await recent.click();
      await dialog.getByRole('heading',{name:'작업 기록'}).waitFor();
      await dialog.locator('header button').first().click();
    }
    if(role==='safety'){
      await wrapper.locator('[data-hub=edit]').click();
      await page.locator('.hub-editing .hub-features').waitFor();
      await wrapper.locator('[data-hub=edit]').click();
    }
    if(role==='safety'){
      let firstTop;
      for(feedCount of [0,1,5,8,12]){
        await page.goto(origin+'/stable412.html?role=safety&count='+feedCount);
        await page.waitForFunction(()=>currentUser() && window.enlReturnToPlatform);
        await page.evaluate(()=>window.enlReturnToPlatform(currentUser()));
        await page.waitForFunction(n=>['[data-event-count]','[data-approval-count]'].every(s=>document.querySelector(s)?.textContent===String(n)),feedCount);
        assert.equal(await wrapper.locator('.hub-event-row').count(),Math.min(5,feedCount));
        assert.equal(await wrapper.locator('.hub-approval-row').count(),Math.min(5,feedCount));
        const top=await wrapper.locator('.hub-features').evaluate(e=>e.getBoundingClientRect().top+scrollY);
        if(firstTop===undefined)firstTop=top;
        assert.ok(Math.abs(top-firstTop)<=1,'stable features top '+top+' vs '+firstTop);
      }
    }
    console.log('PASS',role,'six viewport widths, notice priority, detail links, schedule, approvals and card visibility');
  }finally{await page.close()}
}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PW_CHANNEL||undefined});
  try{for(const role of ['safety','manager','field','executive'])await check(browser,role)}
  finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
