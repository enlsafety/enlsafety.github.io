const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function dropDocuments(target,names){
 if(target.page().viewportSize().width>=1000){
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'board-drop-'));
  const cdp=await target.page().context().newCDPSession(target.page());
  try{
   const files=names.map(name=>{const file=path.join(dir,name);fs.writeFileSync(file,'%PDF-1.4 test');return file});
   await target.scrollIntoViewIfNeeded();
   const box=await target.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
   for(const type of ['dragEnter','dragOver','drop']){
    await cdp.send('Input.dispatchDragEvent',{type,x,y,data:{items:[],files,dragOperationsMask:1}});
    if(type==='dragOver')await target.page().locator('dialog.attachment-drop-active').waitFor();
   }
   await target.page().locator('.hub-asset-row').filter({hasText:names[0]}).waitFor();
  }finally{await cdp.detach();fs.rmSync(dir,{recursive:true,force:true})}
  return;
 }
 await target.evaluate((el,filenames)=>{
  const transfer=new DataTransfer();
  for(const name of filenames)transfer.items.add(new File(['%PDF-1.4 test'],name,{type:'application/pdf'}));
  for(const type of ['dragenter','dragover','drop']){
   const event=new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:transfer});
   el.dispatchEvent(event);
   if(type==='dragover'&&(!event.defaultPrevented||!el.closest('dialog').classList.contains('attachment-drop-active')))throw Error('File drop area did not activate');
  }
 },names);
}
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});try{for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!=='http://localhost:9009')return route.abort();const f=path.join(process.cwd(),url.pathname);if(!fs.existsSync(f)||!fs.statSync(f).isFile())return route.fulfill({status:404,body:''});let body=fs.readFileSync(f);if(url.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');return route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(f)]||'application/octet-stream'})});
 await page.goto('http://localhost:9009/stable412.html?role=safety');await page.waitForFunction(()=>currentUser()&&window.enlReturnToPlatform);await page.evaluate(()=>enlReturnToPlatform(currentUser()));
 const menu=page.locator('.hub-mobile-menu');if(await menu.isVisible())await menu.click();await page.locator('.hub-sidebar [data-hub=boards]').click();
 await page.locator('.hub-board-categories button').filter({hasText:'안전뉴스'}).click();await page.locator('.hub-board:visible [data-hub=new]').click();
 await page.locator('.hub-form [name=title]').fill('난방기 안전');await page.getByRole('textbox',{name:'게시글 내용'}).fill('불을 끄고 퇴근하세요');
 await dropDocuments(page.locator('.hub-editor-content'),['작업표.pdf','점검표.pdf']);
 await page.getByText('첨부 2개',{exact:true}).waitFor();
 assert.equal(await page.locator('.hub-editor-content').innerText(),'불을 끄고 퇴근하세요');
 await page.locator('[data-board-files]').setInputFiles({name:'카드.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:'본문에 넣기'}).click();assert.equal(await page.locator('.hub-editor-content img').count(),1);fs.mkdirSync('qa-output',{recursive:true});await page.screenshot({path:`qa-output/board-editor-${width}.png`,fullPage:true});
 await page.locator('.hub-form button[type=submit]').click();await page.locator('.hub-board:visible [data-content-list] button').filter({hasText:'난방기 안전'}).click();
 assert.equal(await page.locator('dialog[open]').count(),0);await page.locator('.hub-board-post .hub-rich-body img').waitFor();await page.waitForFunction(()=>document.querySelector('.hub-rich-body img')?.naturalWidth>0);assert.ok((await page.locator('.hub-detail-body').innerText()).includes('불을 끄고'));await page.screenshot({path:`qa-output/board-detail-${width}.png`,fullPage:true});
 assert.equal(await page.locator('.hub-post-files button').count(),2);
 await page.getByRole('button',{name:'수정',exact:true}).click();await page.locator('.hub-editor-content img').waitFor();assert.equal(await page.locator('.hub-asset-row').count(),2);
 await dropDocuments(page.locator('.hub-file-drop'),['추가.pdf']);
 await page.getByText('첨부 3개',{exact:true}).waitFor();
 await page.getByRole('button',{name:'HTML 소스 편집'}).click();
 const source=page.getByRole('textbox',{name:'본문 HTML 소스'});await source.fill((await source.inputValue()).replace(/<img[^>]*>/g,''));
 await page.getByRole('button',{name:'HTML 소스 편집'}).click();assert.equal(await page.locator('.hub-editor-content img').count(),0);await page.locator('.hub-form button[type=submit]').click();
 await page.locator('.hub-board:visible [data-content-list] button').filter({hasText:'난방기 안전'}).click();
 for(const name of ['작업표.pdf','점검표.pdf','추가.pdf'])await page.locator('.hub-post-files').getByRole('button',{name,exact:false}).waitFor();
 assert.equal(await page.locator('.hub-post-files button').count(),3);
 await page.locator('.hub-board-post header button').first().click();
 await page.locator('.hub-board:visible .hub-board-filter [name=query]').fill('없는내용');await page.locator('.hub-board:visible .hub-board-filter button').filter({hasText:'검색'}).click();await page.locator('.hub-board:visible').getByText('등록된 게시글이 없습니다.').waitFor();
 await page.locator('.hub-board:visible .hub-board-filter button[type=reset]').click();await page.locator('.hub-board:visible [data-content-list] button').filter({hasText:'난방기 안전'}).waitFor();
 await page.locator('.hub-board:visible [data-hub=new]').click();
 await page.locator('.hub-form [name=title]').fill('사진만 있는 게시글');
 const image={name:'본문.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII=','base64')};
 const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'본문 이미지 삽입'}).click();await (await choose).setFiles(image);
 await page.locator('.hub-editor-content img').waitFor();assert.equal(await page.locator('.hub-asset-row').count(),0);
 await page.locator('.hub-form button[type=submit]').click();await page.getByRole('button',{name:'사진만 있는 게시글',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.hub-rich-body img')?.naturalWidth>0);
 assert.equal(await page.locator('.hub-post-files').count(),0);
 await page.getByRole('button',{name:'수정',exact:true}).click();await page.locator('.hub-editor-content img').waitFor();
 await page.locator('[data-board-files]').setInputFiles({...image,name:'다운로드.png'});
 await page.locator('.hub-asset-row').filter({hasText:'다운로드.png'}).waitFor();
 await page.locator('.hub-form button[type=submit]').click();await page.getByRole('button',{name:'사진만 있는 게시글',exact:true}).click();
 await page.getByRole('button',{name:'첨부 다운로드 다운로드.png'}).waitFor();
 assert.equal(await page.locator('.hub-post-files button').count(),1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');fs.mkdirSync('qa-output',{recursive:true});await page.screenshot({path:`qa-output/board-rich-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);await page.close();
}console.log('PASS desktop/mobile create, inline image, detail, edit, remove, search and reset');}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
