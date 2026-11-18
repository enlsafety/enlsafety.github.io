/* Fixed worksheet geometry; only the designated entry cells contain controls. */
(()=>{
 'use strict';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 window.enlRiskPaper=(sheet,config)=>{
  const {content,site,kind,writable,changed,photoControl,print=false}=config;
  const wrap=el('div',null,'risk-paper-scroll'),table=el('table',null,'risk-paper');
  wrap.tabIndex=0;wrap.setAttribute('aria-label',sheet.name+' 양식, 좌우로 이동하여 작성');
  table.dataset.riskSheet=sheet.id;table.setAttribute('aria-label',sheet.name+' 위험성평가 고정 양식');
  const cols=el('colgroup'),total=sheet.widths.reduce((a,b)=>a+b,0);
  for(const width of sheet.widths){const col=el('col');col.style.width=width/total*100+'%';cols.append(col);}
  table.append(cols);const body=el('tbody');table.append(body);wrap.append(table);
  const rows=content.rows.filter(r=>r.section===sheet.name&&!r.id.startsWith('custom-'));
  const improvement=sheet.improvement?content.improvements[Number(sheet.id.slice(-2))-1]:null;
  function input(cell,obj,key,type,label){
   cell.classList.add('risk-entry');
   if(print){cell.append(el('span',obj[key]||''));return;}
   const control=el(type==='textarea'?'textarea':'input');if(type!=='textarea')control.type=type;else control.rows=2;
   control.value=obj[key]||'';control.disabled=!writable;control.dataset.riskField=key;
   control.setAttribute('aria-label',label);if(type!=='date')control.maxLength=2000;
   control.oninput=()=>{obj[key]=control.value;changed();};cell.append(control);
  }
  function level(cell,row){
   cell.classList.add('risk-entry');
   if(print){cell.textContent=row.excluded?'해당 작업 없음\n'+row.excludeReason:['상','중','하'].map(v=>(row.level===v?'☑ ':'□ ')+v).join(' ');return;}
   const levels=el('div',null,'risk-levels');levels.setAttribute('role','radiogroup');levels.setAttribute('aria-label',row.number+'번 위험성 수준');
   for(const value of ['상','중','하']){
    const label=el('label'),radio=el('input');radio.type='radio';radio.name='risk-level-'+row.id;radio.value=value;radio.checked=row.level===value;radio.disabled=!writable||row.excluded;radio.dataset.riskField='level';
    radio.onchange=()=>{row.level=value;changed();};label.append(radio,document.createTextNode(value));levels.append(label);
   }
   cell.append(levels);
   const details=el('details',null,'risk-nonapplicable');details.open=row.excluded;details.append(el('summary','해당 작업 없음'));
   const label=el('label'),check=el('input');check.type='checkbox';check.checked=row.excluded;check.disabled=!writable;check.setAttribute('aria-label',row.number+'번 평가 제외');
   check.onchange=()=>{row.excluded=check.checked;for(const radio of levels.querySelectorAll('input'))radio.disabled=!writable||row.excluded;changed();};label.append(check,document.createTextNode('평가 제외'));details.append(label);
   input(details,row,'excludeReason','textarea',row.number+'번 제외 사유');cell.append(details);
  }
  for(const sourceRow of sheet.rows){
   const tr=el('tr');tr.style.height=sourceRow.height+'px';body.append(tr);
   const number=sourceRow.cells.find(c=>/^B\d+$/.test(c.address))?.value;
   const row=!improvement&&rows.find(r=>r.number===Number(number));
   if(row){tr.dataset.riskRow=row.id;tr.className='risk-row';}
   for(const source of sourceRow.cells){
    const td=el('td');td.rowSpan=source.span[0];td.colSpan=source.span[1];Object.assign(td.style,window.ENLRiskPaperStyles[source.style]);td.dataset.cell=source.address;tr.append(td);
    const a=source.address,column=a.replace(/\d/g,'');
    if(improvement){
     const fields={I2:['number','text','관련 평가번호'],C3:['process','text','공정'],I3:['task','text','작업'],C4:['hazard','textarea','위험요인'],C5:['measure','textarea','개선내용'],C6:['date','date','개선일자'],I6:['reviewer','text','확인자']};
     if(a==='C2')td.textContent=site.site_name;
     else if(fields[a]){const [key,type,label]=fields[a];input(td,improvement,key,type,label);}
     else if(a==='A9'||a==='A11'){td.classList.add('risk-entry','risk-picture-cell');td.append(photoControl(improvement,a==='A9'?'beforePhoto':'afterPhoto',a==='A9'?'개선 전 사진':'개선 후 사진',print));}
     else td.textContent=source.value;
    }else if(a==='D3')td.textContent=site.site_name;
    else if(a==='G3')td.textContent=(kind==='initial'?'☑':'□')+' 최초  '+(kind==='regular'?'☑':'□')+' 정기  □ 수시';
    else if(a==='I3')input(td,content,'assessmentDate','date','평가일자');
    else if(a==='G4')input(td,content,'target','text','평가대상');
    else if(a==='I4')input(td,content,'evaluator','text','평가자');
    else if(row&&column==='F')level(td,row);
    else if(row&&['G','H','I','J'].includes(column)){
     const [key,type,label]={G:['measure','textarea','개선대책'],H:['dueDate','date','조치기한'],I:['doneDate','date','완료일'],J:['owner','text','담당자']}[column];input(td,row,key,type,row.number+'번 '+label);
    }else if(row&&['D','E'].includes(column))td.textContent=row[column==='D'?'task':'hazard'];
    else td.textContent=source.value;
   }
  }
  return wrap;
 };
})();
