/* E&L Accident Report App v4.1.8 - safety-only finalized incident Excel export */
(function(){
  'use strict';
  const VERSION='4.1.8-excel1';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finalized=i=>typeof window.enlIncidentFinalized==='function'?window.enlIncidentFinalized(i):!!i&&String(i.status)==='closed'&&String(i.corrective?.status)==='approved';
  const isSafety=()=>roleNorm(typeof currentUser==='function'?currentUser()?.role:'')==='safety';
  const findIncident=id=>(data?.incidents||[]).find(i=>String(i?.id||'')===String(id||''));
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const categoryText=v=>v==='person'?'대인사고':v==='property'?'대물사고':'사고';
  const priorityText=v=>v==='urgent'?'긴급':v==='important'?'중요':'일반';
  const severityText=v=>v==='major'?'중대':v==='moderate'?'보통':'경미';
  const leaveText=v=>v==='none'?'휴업 없음':v==='under3'?'3일 미만 예상':v==='3plus'?'3일 이상 예상':v==='longterm'?'장기치료 / 중상 가능':'미확인';
  const yesNo=v=>v?'예':'아니오';
  const money=v=>{const n=Number(v||0);return Number.isFinite(n)&&n>0?`${n.toLocaleString('ko-KR')}원`:'-'};
  const fmtDate=v=>{if(!v)return '-';try{return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v))}catch(e){return String(v)}};
  const dateKey=v=>{const d=v?new Date(v):new Date();if(Number.isNaN(d.getTime()))return new Date().toISOString().slice(0,10).replace(/-/g,'');return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`};
  const cleanFile=v=>String(v||'사고').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_').slice(0,36);
  const xmlEsc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/\r\n|\r|\n/g,'&#10;');
  const attachmentText=arr=>{const list=(Array.isArray(arr)?arr:[]).map((a,n)=>{if(typeof a==='string')return `${n+1}. ${a}`;const name=a?.name||a?.fileName||a?.originalName||a?.filename||`첨부자료 ${n+1}`,url=a?.url||a?.publicUrl||a?.downloadUrl||'';return `${n+1}. ${name}${url?`\n${url}`:''}`});return list.length?list.join('\n'):'-'};

  const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0}return t})();
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
  function u16(n){const a=new Uint8Array(2),v=new DataView(a.buffer);v.setUint16(0,n,true);return a}
  function u32(n){const a=new Uint8Array(4),v=new DataView(a.buffer);v.setUint32(0,n>>>0,true);return a}
  function concat(parts){const len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
  function dosNow(){const d=new Date(),year=Math.max(1980,d.getFullYear());return {time:((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31),date:(((year-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31)}}
  function zipStore(files){
    const enc=new TextEncoder(),dt=dosNow(),locals=[],centrals=[];let offset=0;
    for(const f of files){
      const name=enc.encode(f.name),body=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(body),flags=0x0800;
      const local=concat([u32(0x04034b50),u16(20),u16(flags),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(body.length),u32(body.length),u16(name.length),u16(0),name,body]);
      locals.push(local);
      const central=concat([u32(0x02014b50),u16(20),u16(20),u16(flags),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(body.length),u32(body.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
      centrals.push(central);offset+=local.length;
    }
    const centralSize=centrals.reduce((n,p)=>n+p.length,0),end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralSize),u32(offset),u16(0)]);
    return concat([...locals,...centrals,end]);
  }

  const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="10"/><color rgb="FF173B66"/><name val="맑은 고딕"/></font>
    <font><sz val="9"/><color rgb="FF667788"/><name val="맑은 고딕"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF173B66"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2D6C9F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF3FA"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFB9C9D6"/></left><right style="thin"><color rgb="FFB9C9D6"/></right><top style="thin"><color rgb="FFB9C9D6"/></top><bottom style="thin"><color rgb="FFB9C9D6"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function cellXml(ref,val,style=4){return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(val)}</t></is></c>`}
  function sheetXml(rows,merges=[]){
    const heights={1:30,2:8};
    const body=rows.map((row,idx)=>{const r=idx+1,h=row.height||heights[r]||((row.cells||[]).some(c=>String(c?.v||'').includes('\n'))?42:24),cells=(row.cells||[]).map(c=>cellXml(`${c.col}${r}`,c.v,c.s)).join('');return `<row r="${r}" ht="${h}" customHeight="1">${cells}</row>`}).join('');
    const maxRow=rows.length,mergeXml=merges.length?`<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:'';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:D${maxRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="34" customWidth="1"/></cols><sheetData>${body}</sheetData>${mergeXml}<printOptions horizontalCentered="1"/><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;C이앤엘 사고보고앱 자동작성</oddFooter></headerFooter></worksheet>`;
  }
  function c(col,v,s=4){return {col,v:v??'-',s}}
  function titleRow(text){return {height:34,cells:[c('A',text,1)]}}
  function sectionRow(text){return {height:27,cells:[c('A',text,2)]}}
  function pairRow(l1,v1,l2,v2){return {cells:[c('A',l1,3),c('B',v1,4),c('C',l2,3),c('D',v2,4)]}}
  function wideRow(label,value,height){return {height:height||34,cells:[c('A',label,3),c('B',value,4)]}}
  function noteRow(text){return {height:24,cells:[c('A',text,6)]}}

  function reportSheet(i){
    const d=i.reportDetails||{},person=i.category==='person',rows=[],merges=[];
    rows.push(titleRow('이앤엘 사고경위서'));merges.push('A1:D1');
    rows.push({height:8,cells:[]});
    rows.push(sectionRow('1. 사고 개요'));merges.push('A3:D3');
    rows.push(pairRow('사고 구분',categoryText(i.category),'관리등급',priorityText(i.priority)));
    rows.push(pairRow('사업장',siteName(i.siteId),'발생 일시',fmtDate(i.occurredAt)));
    rows.push(wideRow('사고 장소',d.place||'-'));merges.push('B6:D6');
    rows.push(pairRow('사고 유형',i.eventType||'-',person?'부상 정도':'피해 정도',severityText(i.severity)));
    rows.push(pairRow('보고자',i.reporterName||'-','보고 일시',fmtDate(i.createdAt)));
    rows.push(pairRow('사고보고 승인자',i.approvedBy||'-','승인 일시',fmtDate(i.approvedAt)));
    rows.push(pairRow('종결 일시',fmtDate(i.closedAt),'중대 가능성',yesNo(i.potentialMajor)));
    rows.push({height:8,cells:[]});
    rows.push(sectionRow('2. 사고 경위 및 원인'));merges.push('A12:D12');
    rows.push(wideRow('사고 직전 작업',d.workAction||'-',42));merges.push('B13:D13');
    rows.push(wideRow('사고 발생 경위',d.incidentHow||i.summary||'-',58));merges.push('B14:D14');
    rows.push(wideRow('사고 직후 조치',i.immediateAction||'-',46));merges.push('B15:D15');
    rows.push(wideRow('환경적 요인',d.environmentCause||'-',38));merges.push('B16:D16');
    rows.push(wideRow('행동적 요인',d.behaviorCause||'-',38));merges.push('B17:D17');
    rows.push({height:8,cells:[]});
    rows.push(sectionRow(person?'3. 대인 피해 상황':'3. 대물 피해 상황'));merges.push('A19:D19');
    if(person){
      rows.push(pairRow('피해 직원',d.injuredName||i.injuredName||'-','직종 / 업무',d.job||i.job||'-'));
      rows.push(wideRow('부상 내용',d.injuryDetail||'-',46));merges.push('B21:D21');
      rows.push(wideRow('진단명',d.diagnosis||'-',34));merges.push('B22:D22');
      rows.push(wideRow('의사 소견 / 치료기간',d.doctorOpinion||'-',42));merges.push('B23:D23');
      rows.push(pairRow('진료비',money(d.medicalCost),'치료 / 휴업 예상',leaveText(i.leaveEstimate)));
      rows.push(wideRow('진료비 상세',d.medicalCostDetail||'-',38));merges.push('B25:D25');
    }else{
      rows.push(pairRow('작업자',d.workerName||'-','직종 / 업무',d.job||i.job||'-'));
      rows.push(wideRow('파손 물품 / 시설',d.damagedItem||'-',38));merges.push('B21:D21');
      rows.push(wideRow('파손 내용',d.damageDetail||'-',48));merges.push('B22:D22');
      rows.push(pairRow('복구 예상 비용',money(d.repairCost),'피해 정도',severityText(i.severity)));
      rows.push(wideRow('견적 / 비용 상세',d.repairCostDetail||'-',42));merges.push('B24:D24');
    }
    const next=rows.length+1;rows.push({height:8,cells:[]});
    const sec=rows.length+1;rows.push(sectionRow('4. 재발 방지 및 관리'));merges.push(`A${sec}:D${sec}`);
    let r=rows.length+1;rows.push(wideRow('재발 방지 대책',d.preventionPlan||'-',58));merges.push(`B${r}:D${r}`);
    r=rows.length+1;rows.push(wideRow('특이사항',d.specialNote||'-',38));merges.push(`B${r}:D${r}`);
    r=rows.length+1;rows.push(wideRow('사고 현장 첨부자료',attachmentText(i.photos),50));merges.push(`B${r}:D${r}`);
    rows.push(noteRow('※ 본 문서는 이앤엘 사고보고앱의 종결 사고 데이터를 기준으로 자동 작성되었습니다.'));merges.push(`A${rows.length}:D${rows.length}`);
    return sheetXml(rows,merges);
  }

  function actionSheet(i){
    const d=i.reportDetails||{},x=i.corrective||{},rows=[],merges=[];
    rows.push(titleRow('이앤엘 사고조치보고서'));merges.push('A1:D1');
    rows.push({height:8,cells:[]});
    rows.push(sectionRow('1. 사고 및 조치 개요'));merges.push('A3:D3');
    rows.push(pairRow('사고 구분',categoryText(i.category),'관리등급',priorityText(i.priority)));
    rows.push(pairRow('사업장',siteName(i.siteId),'사고 발생 일시',fmtDate(i.occurredAt)));
    rows.push(wideRow('사고 장소',d.place||'-'));merges.push('B6:D6');
    rows.push(pairRow('사고 유형',i.eventType||'-','사고보고 승인자',i.approvedBy||'-'));
    rows.push(pairRow('사고보고 승인일',fmtDate(i.approvedAt),'종결 일시',fmtDate(i.closedAt)));
    rows.push({height:8,cells:[]});
    rows.push(sectionRow('2. 원 사고 내용'));merges.push('A10:D10');
    rows.push(wideRow('사고 발생 경위',d.incidentHow||i.summary||'-',58));merges.push('B11:D11');
    rows.push(wideRow('사고 직후 조치',i.immediateAction||'-',46));merges.push('B12:D12');
    rows.push({height:8,cells:[]});
    rows.push(sectionRow('3. 사고조치 및 재발방지'));merges.push('A14:D14');
    rows.push(wideRow('원인 분석',x.rootCause||'-',52));merges.push('B15:D15');
    rows.push(wideRow('조치 내용',x.actionDetail||'-',66));merges.push('B16:D16');
    rows.push(pairRow('조치 담당자',x.ownerName||'-','완료 목표일',x.dueDate||'-'));
    rows.push(pairRow('조치 제출자',x.submittedBy||'-','조치 제출일',fmtDate(x.submittedAt)));
    rows.push(pairRow('사고조치 승인자',x.reviewedBy||'-','승인 일시',fmtDate(x.reviewedAt)));
    rows.push(wideRow('안전관리자 최종 검토의견',x.reviewNote||'-',48));merges.push('B20:D20');
    rows.push(wideRow('조치 사진 / 첨부자료',attachmentText(x.afterPhotos),52));merges.push('B21:D21');
    rows.push({height:8,cells:[]});
    rows.push(sectionRow('4. 최종 승인 확인'));merges.push('A23:D23');
    rows.push(pairRow('사고보고 상태','승인 완료','사고조치 상태','승인 완료'));
    rows.push(pairRow('사고보고 승인',`${i.approvedBy||'-'} / ${fmtDate(i.approvedAt)}`,'사고조치 승인',`${x.reviewedBy||'-'} / ${fmtDate(x.reviewedAt)}`));
    rows.push(noteRow('※ 사고보고와 사고조치가 모두 승인되어 종결된 건에 한해 자동 작성되는 문서입니다.'));merges.push('A26:D26');
    return sheetXml(rows,merges);
  }

  function buildWorkbook(i){
    if(!i||!finalized(i))throw new Error('종결된 사고만 엑셀 보고서를 만들 수 있습니다.');
    const now=new Date().toISOString(),files=[
      {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`},
      {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
      {name:'docProps/core.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>이앤엘 종결 사고보고서</dc:title><dc:creator>이앤엘 사고보고앱</dc:creator><cp:lastModifiedBy>이앤엘 사고보고앱</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`},
      {name:'docProps/app.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>이앤엘 사고보고앱</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>2</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="2" baseType="lpstr"><vt:lpstr>사고경위서</vt:lpstr><vt:lpstr>사고조치보고서</vt:lpstr></vt:vector></TitlesOfParts></Properties>`},
      {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="12000"/></bookViews><sheets><sheet name="사고경위서" sheetId="1" r:id="rId1"/><sheet name="사고조치보고서" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>`},
      {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {name:'xl/styles.xml',data:stylesXml},
      {name:'xl/worksheets/sheet1.xml',data:reportSheet(i)},
      {name:'xl/worksheets/sheet2.xml',data:actionSheet(i)},
    ];
    return zipStore(files);
  }

  function downloadExcel(id){
    if(!isSafety())return alert('종결 사고 엑셀 보고서는 안전관리자만 받을 수 있습니다.');
    const i=findIncident(id);if(!i)return alert('해당 사고자료를 찾지 못했습니다.');
    if(!finalized(i))return alert('사고보고와 사고조치가 모두 승인된 종결 사고만 엑셀 보고서를 받을 수 있습니다.');
    try{
      const bytes=buildWorkbook(i),blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`이앤엘_종결사고보고서_${cleanFile(siteName(i.siteId))}_${dateKey(i.occurredAt)}.xlsx`;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1200);
    }catch(e){console.error('incident excel export failed',e);alert('엑셀 보고서를 만드는 중 오류가 발생했습니다. 다시 시도해 주세요.')}
  }

  function ensureCss(){if(document.getElementById('excel418Css'))return;const s=document.createElement('style');s.id='excel418Css';s.textContent=`.excel418-row{display:flex;justify-content:flex-end;margin-top:-3px;margin-bottom:3px}.excel418-btn{min-height:42px;border:1.5px solid #2d6c9f;border-radius:10px;background:#eef6fc;color:#174d78;padding:0 14px;font-size:13px;font-weight:950;cursor:pointer}.excel418-btn:hover,.excel418-btn:focus-visible{background:#dfeefa;border-color:#174d78;outline:none}.excel418-modal-row{display:flex;justify-content:flex-end;margin:10px 0 2px}.excel418-modal-row .excel418-btn{min-height:46px;font-size:14px}@media(max-width:560px){.excel418-row,.excel418-modal-row{justify-content:stretch}.excel418-btn{width:100%;min-height:46px}}`;document.head.appendChild(s)}
  function makeRow(id,modal=false){const row=document.createElement('div');row.className=modal?'excel418-modal-row':'excel418-row';row.dataset.excel418For=String(id);row.innerHTML=`<button type="button" class="excel418-btn" data-excel418-id="${escx(id)}">엑셀 보고서 받기</button>`;return row}
  function syncButtons(root=document){
    if(!root?.querySelectorAll)return;
    if(!isSafety()){root.querySelectorAll('.excel418-row,.excel418-modal-row').forEach(x=>x.remove());return}
    root.querySelectorAll('[data-lifecycle-open]').forEach(card=>{const id=card.dataset.lifecycleOpen,i=findIncident(id);if(!finalized(i))return;const next=card.nextElementSibling;if(next?.classList?.contains('excel418-row')&&String(next.dataset.excel418For)===String(id))return;card.insertAdjacentElement('afterend',makeRow(id,false))});
    root.querySelectorAll('[data-lifecycle-final]').forEach(section=>{const id=section.dataset.lifecycleFinal,i=findIncident(id);if(!finalized(i))return;if(section.nextElementSibling?.classList?.contains('excel418-modal-row')&&String(section.nextElementSibling.dataset.excel418For)===String(id))return;section.insertAdjacentElement('afterend',makeRow(id,true))});
  }

  ensureCss();
  document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-excel418-id]');if(!b)return;e.preventDefault();e.stopPropagation();downloadExcel(b.dataset.excel418Id)},true);
  let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;syncButtons(document)})};
  const observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true});
  syncButtons(document);setTimeout(()=>syncButtons(document),60);
  window.enlBuildFinalIncidentWorkbook=buildWorkbook;
  window.enlDownloadFinalIncidentExcel=downloadExcel;
  window.enlSyncFinalIncidentExcelButtons=syncButtons;
  window.ENL_INCIDENT_EXCEL_VERSION=VERSION;
})();
