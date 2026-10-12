/* Local document extraction; files leave the browser only for the private E&L archive. */
(function(){
'use strict';
const libs={
 pdf:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
 xlsx:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
 zip:'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
 ocr:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
};
const loaded={};
async function library(kind,ready){
 if(ready())return;
 if(!loaded[kind])loaded[kind]=new Promise((resolve,reject)=>{
  const s=document.createElement('script');
  s.src=libs[kind];s.crossOrigin='anonymous';s.async=true;
  s.onload=()=>ready()?resolve():reject(Error(kind+' 파서 초기화 실패'));
  s.onerror=()=>reject(Error(kind+' 라이브러리 다운로드 실패'));
  document.head.appendChild(s);
 });
 try{await loaded[kind]}catch(e){delete loaded[kind];throw e}
}
const trim=x=>String(x==null?'':x).trim();
function decode(bytes){
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
 catch(_){return new TextDecoder('euc-kr').decode(bytes)}
}
function csvRows(src){
 src=String(src||'').replace(/^\uFEFF/,'');
 const rows=[];let row=[],value='',quote=false;
 for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(ch==='"'){if(quote&&src[i+1]==='"'){value+='"';i++}else quote=!quote}
  else if(ch===','&&!quote){row.push(value);value=''}
  else if((ch==='\r'||ch==='\n')&&!quote){
   if(ch==='\r'&&src[i+1]==='\n')i++;
   row.push(value);if(row.some(trim))rows.push(row);row=[];value='';
  }else value+=ch;
 }
 if(quote)throw Error('CSV 따옴표가 닫히지 않아. 원본 CSV를 확인해 줘.');
 row.push(value);if(row.some(trim))rows.push(row);
 return rows;
}
async function zipUnits(bytes,ext){
 await library('zip',()=>!!window.JSZip);
 const archive=await window.JSZip.loadAsync(bytes);
 const names=Object.keys(archive.files).filter(name=>ext==='docx'
  ?name==='word/document.xml'
  :/^Contents\/section\d+\.xml$/i.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 if(!names.length)throw Error('문서 본문 XML이 없어. 암호 설정 또는 파일 형식을 확인해 줘.');
 const units=[];let textSize=0;
 for(const name of names){
  const xml=await archive.file(name).async('string');
  textSize+=xml.length;if(textSize>12*1024*1024)throw Error('압축 해제한 문서가 너무 커. 사고별로 나눠 업로드해 줘.');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('문서 본문 XML 파싱 실패');
  let tableNo=0,paragraphNo=0;
  const fromText=node=>{
   const parts=[];
   const visit=n=>{for(const x of n.children||[]){if(x.localName==='t')parts.push(x.textContent);else if(['br','lineBreak'].includes(x.localName))parts.push('\n');else if(x.localName==='tab')parts.push('\t');else{visit(x);if(x.localName==='p')parts.push('\n');}}};
   visit(node);return trim(parts.join(''));
  };
  const walk=node=>{
   for(const el of node.children||[]){
    if(el.localName==='tbl'){
     const rows=[...el.children].filter(x=>x.localName==='tr').map(tr=>[...tr.children].filter(x=>x.localName==='tc').map(fromText));
     if(rows.length&&rows.some(row=>row.some(trim)))units.push({location:name+' 표 '+(++tableNo),method:'text',rows});
    }else if(el.localName==='p'&&![...el.getElementsByTagName('*')].some(x=>x.localName==='tbl')){
     const content=fromText(el);if(content)units.push({location:name+' 문단 '+(++paragraphNo),method:'text',text:content});
    }else walk(el);
   }
  };
  walk(doc);
 }
 if(!units.length)throw Error('문서에서 판독 가능한 글자를 찾지 못했어. 이미지 문서는 PDF나 사진으로 변환해 줘.');
 return {method:'text',units};
}
async function ocr(image,sharedWorker=null){
 await library('ocr',()=>!!window.Tesseract?.createWorker);
 const worker=sharedWorker||await window.Tesseract.createWorker('kor+eng',1);
 try{
  const out=await worker.recognize(image);
  return {text:trim(out.data?.text),confidence:Number.isFinite(out.data?.confidence)?out.data.confidence:null};
 }finally{if(!sharedWorker)await worker.terminate()}
}
async function pdfUnits(bytes,progress){
 await library('pdf',()=>!!window.pdfjsLib?.getDocument);
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const pdf=await window.pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
 if(pdf.numPages>60){await pdf.destroy().catch(()=>{});throw Error('60페이지가 넘는 PDF는 나눠 업로드해 줘.');}
 let ocrUsed=false,ocrWorker=null;const units=[];
 try{
 for(let n=1;n<=pdf.numPages;n++){
  progress?.('PDF 텍스트 추출 '+n+'/'+pdf.numPages);
  const page=await pdf.getPage(n),items=(await page.getTextContent()).items;
  let lastY=null,lastXEnd=null,txt='',method='text',confidence=null;
  for(const item of items){
   const y=Number(item.transform?.[5]||0);
   if(lastY!==null&&Math.abs(lastY-y)>2)txt+='\n';
   else if(txt)txt+=lastXEnd!==null&&Number(item.transform?.[4]||0)-lastXEnd>12?'  ':' ';
   txt+=item.str||'';lastY=y;lastXEnd=Number(item.transform?.[4]||0)+Number(item.width||0);
   if(item.hasEOL){txt+='\n';lastY=null;lastXEnd=null;}
  }
  if(trim(txt).length<15){
   progress?.('스캔 페이지 OCR '+n+'/'+pdf.numPages);
   const view=page.getViewport({scale:1.4}),canvas=document.createElement('canvas');
   canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
   if(!ocrWorker){await library('ocr',()=>!!window.Tesseract?.createWorker);ocrWorker=await window.Tesseract.createWorker('kor+eng',1);}
   const recognized=await ocr(canvas,ocrWorker);txt=recognized.text;confidence=recognized.confidence;method='ocr';ocrUsed=true;canvas.width=0;canvas.height=0;
  }
  // Blank separator pages do not discard successfully extracted pages in the same file.
  if(trim(txt))units.push({location:n+'페이지',method,confidence,text:txt});
 }
 }finally{if(ocrWorker)await ocrWorker.terminate().catch(()=>{});await pdf.destroy().catch(()=>{})}
 return {method:ocrUsed?'ocr':'text',units};
}
async function read(file,progress){
 if(!file||file.size<=0||file.size>12*1024*1024)throw Error('파일 크기는 1B~12MB여야 해.');
 const type=(file.name.split('.').pop()||'').toLowerCase();
 if(type==='hwp')throw Error('일반 HWP는 직접 판독할 수 없어. 한글에서 HWPX 또는 텍스트 PDF로 저장해 다시 올려 줘.');
 if(!['pdf','xlsx','xls','csv','docx','hwpx','jpg','jpeg','png','webp'].includes(type))throw Error('지원하지 않는 형식이야. PDF·XLSX·XLS·CSV·DOCX·HWPX·JPG·PNG·WEBP로 변환해 줘.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 let extraction;
 if(type==='csv')extraction={method:'text',units:[{location:'CSV',rows:csvRows(decode(bytes))}]};
 else if(['xlsx','xls'].includes(type)){
  await library('xlsx',()=>!!window.XLSX?.read);
  const work=window.XLSX.read(bytes,{type:'array',cellDates:true});
  for(const name of work.SheetNames)for(const [key,cell] of Object.entries(work.Sheets[name])){if(!key.startsWith('!')&&cell?.t==='d'){cell.z='yyyy-mm-dd';delete cell.w;}}
  extraction={method:'text',units:work.SheetNames.map(name=>({
   location:name,method:'text',rows:window.XLSX.utils.sheet_to_json(work.Sheets[name],{header:1,raw:false,defval:'',dateNF:'yyyy-mm-dd'})
  }))};
 }else if(['docx','hwpx'].includes(type))extraction=await zipUnits(bytes,type);
 else if(type==='pdf')extraction=await pdfUnits(bytes,progress);
 else {
  progress?.('사진 OCR · 기기에서 글자 인식');
  const s=await ocr(file);if(!s.text)throw Error('이미지에서 텍스트를 읽지 못했어.');
  extraction={method:'ocr',units:[{location:'이미지 OCR',method:'ocr',confidence:s.confidence,text:s.text}]};
 }
 extraction.units=extraction.units.filter(u=>u.rows?u.rows.some(row=>row.some(trim)):trim(u.text));
 if(!extraction.units?.length)throw Error('추출 결과가 없어. 빈 문서나 텍스트가 없는 파일인지 확인해 줘.');
 if(JSON.stringify(extraction.units).length>350000)throw Error('추출 내용이 너무 많아. 사고별로 파일을 나눠 다시 올려 줘.');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
 let binary='';const chunk=16384;
 for(let j=0;j<bytes.length;j+=chunk)binary+=String.fromCharCode(...bytes.subarray(j,j+chunk));
 return {name:file.name,size:file.size,id:hash,hash,base64:btoa(binary),...extraction};
}
window.ENLHistoricalBulkExtract454={read,csvRows,decode};
})();