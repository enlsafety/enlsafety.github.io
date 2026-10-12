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
 await loaded[kind];
}
const trim=x=>String(x==null?'':x).trim();
function decode(bytes){
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
 catch(_){return new TextDecoder('euc-kr').decode(bytes)}
}
function csvRows(src){
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
 row.push(value);if(row.some(trim))rows.push(row);
 return rows;
}
async function zipUnits(bytes,ext){
 await library('zip',()=>!!window.JSZip);
 const archive=await window.JSZip.loadAsync(bytes);
 const names=Object.keys(archive.files).filter(name=>ext==='docx'
  ?name==='word/document.xml'
  :/^Contents\/section\d+\.xml$/i.test(name)).sort();
 if(!names.length)throw Error('문서 본문 XML이 없어.');
 const units=[];
 for(const name of names){
  const xml=await archive.file(name).async('string');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('문서 본문 XML 파싱 실패');
  const elements=[...doc.getElementsByTagName('*')];
  const fromText=node=>[...node.getElementsByTagName('*')].filter(x=>x.localName==='t').map(x=>x.textContent).join(' ');
  const tables=elements.filter(x=>x.localName==='tbl');
  tables.forEach((table,i)=>{
   const rows=[...table.children].filter(x=>x.localName==='tr').map(tr=>[...tr.children].filter(x=>x.localName==='tc').map(cell=>trim(fromText(cell))));
   if(rows.length&&rows.some(row=>row.some(trim)))units.push({location:name+' 표 '+(i+1),rows});
  });
  const inTable=p=>{for(let a=p.parentElement;a;a=a.parentElement)if(a.localName==='tbl')return true;return false};
  const lines=elements.filter(x=>x.localName==='p'&&!inTable(x)).map(p=>trim(fromText(p))).filter(trim);
  if(lines.length)units.push({location:name+' 본문',text:lines.join('\n')});
  if(!tables.length&&!lines.length)throw Error('문서에서 판독 가능한 글자를 찾지 못했어.');
 }
 return {method:'text',units};
}
async function ocr(image){
 await library('ocr',()=>!!window.Tesseract?.createWorker);
 const worker=await window.Tesseract.createWorker('kor+eng',1);
 try{
  const out=await worker.recognize(image);
  return trim(out.data?.text);
 }finally{await worker.terminate()}
}
async function pdfUnits(bytes,progress){
 await library('pdf',()=>!!window.pdfjsLib?.getDocument);
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const pdf=await window.pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
 if(pdf.numPages>20)throw Error('20페이지가 넘는 PDF는 사고별로 나눠 업로드해 줘.');
 let ocrUsed=false;const units=[];
 try{
 for(let n=1;n<=pdf.numPages;n++){
  progress?.('PDF 텍스트 추출 '+n+'/'+pdf.numPages);
  const page=await pdf.getPage(n),items=(await page.getTextContent()).items;
  let lastY=null,txt='';
  for(const item of items){
   const y=Number(item.transform?.[5]||0);
   if(lastY!==null&&Math.abs(lastY-y)>2)txt+='\n';
   else if(txt)txt+=' ';
   txt+=item.str||'';lastY=y;
  }
  if(trim(txt).length<15){
   if(pdf.numPages>8)throw Error('스캔 PDF가 8페이지를 넘어. 나눠 업로드하거나 텍스트 PDF를 사용해 줘.');
   progress?.('스캔 페이지 OCR '+n+'/'+pdf.numPages);
   const view=page.getViewport({scale:1.4}),canvas=document.createElement('canvas');
   canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
   txt=await ocr(canvas);ocrUsed=true;
  }
  if(!trim(txt))throw Error(n+'페이지 판독 실패: 원본을 확인해 줘.');
  units.push({location:n+'페이지',text:txt});
 }
 }finally{await pdf.destroy().catch(()=>{})}
 return {method:ocrUsed?'ocr':'text',units};
}
async function read(file,progress){
 if(!file||file.size<=0||file.size>12*1024*1024)throw Error('파일 크기는 1B~12MB여야 해.');
 const type=(file.name.split('.').pop()||'').toLowerCase();
 if(!['pdf','xlsx','xls','csv','docx','hwpx','jpg','jpeg','png','webp'].includes(type))throw Error('지원하지 않는 파일 형식');
 const bytes=new Uint8Array(await file.arrayBuffer());
 let extraction;
 if(type==='csv')extraction={method:'text',units:[{location:'CSV',rows:csvRows(decode(bytes))}]};
 else if(['xlsx','xls'].includes(type)){
  await library('xlsx',()=>!!window.XLSX?.read);
  const work=window.XLSX.read(bytes,{type:'array'});
  extraction={method:'text',units:work.SheetNames.map(name=>({
   location:name,rows:window.XLSX.utils.sheet_to_json(work.Sheets[name],{header:1,raw:false,defval:''})
  }))};
 }else if(['docx','hwpx'].includes(type))extraction=await zipUnits(bytes,type);
 else if(type==='pdf')extraction=await pdfUnits(bytes,progress);
 else {
  progress?.('사진 OCR · 기기에서 글자 인식');
  const s=await ocr(file);if(!s)throw Error('이미지에서 텍스트를 읽지 못했어.');
  extraction={method:'ocr',units:[{location:'이미지 OCR',text:s}]};
 }
 if(!extraction.units?.length)throw Error('추출 결과가 없어.');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
 let binary='';const chunk=16384;
 for(let j=0;j<bytes.length;j+=chunk)binary+=String.fromCharCode(...bytes.subarray(j,j+chunk));
 return {name:file.name,size:file.size,id:hash,hash,base64:btoa(binary),...extraction};
}
window.ENLHistoricalBulkExtract454={read,csvRows,decode};
})();