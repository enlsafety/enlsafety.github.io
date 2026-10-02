const fs=require('node:fs');
const assert=require('node:assert/strict');
const { chromium }=require('playwright');

(async()=>{
  const source=fs.readFileSync('admin.js','utf8');
  const start=source.indexOf('function openModal(html)');
  const end=source.indexOf('\n\ntry{const bc=',start);
  assert.ok(start>=0&&end>start,'openModal/closeModal block not found');
  const modalFns=source.slice(start,end);

  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:700}});
  await page.setContent(`<!doctype html><style>
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.2);padding:120px}
    .modal{width:420px;min-height:260px;margin:auto;background:#fff;padding:24px}
    textarea{width:360px;height:120px}
  </style><div id="modalRoot"></div>`);
  await page.addScriptTag({content:modalFns+'\nwindow.openModal=openModal;window.closeModal=closeModal;'});
  await page.evaluate(()=>window.openModal('<textarea id="cause">원인분석 자동초안 내용을 마우스로 드래그해 수정합니다.</textarea><button data-close>닫기</button>'));

  const textarea=page.locator('#cause');
  const box=await textarea.boundingBox();
  assert.ok(box,'textarea box missing');

  // Start selection inside textarea and release on backdrop: modal must stay open.
  await page.mouse.move(box.x+80,box.y+35);
  await page.mouse.down();
  await page.mouse.move(20,20,{steps:8});
  await page.mouse.up();
  assert.equal(await page.locator('#modalRoot .modal').count(),1,'modal closed after drag ending on backdrop');

  // A genuine backdrop click still closes it.
  await page.mouse.click(20,20);
  assert.equal(await page.locator('#modalRoot .modal').count(),0,'plain backdrop click did not close modal');

  await browser.close();
  console.log('PASS: modal survives text-selection drag outside and closes on intentional backdrop click');
})().catch(e=>{console.error(e);process.exit(1)});
