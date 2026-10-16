/* E&L Incident Report: explicit year/month/day calendar for mobile and desktop. */
(function(){
  'use strict';
  const VERSION='4.6.5-r1';
  const MIN_YEAR=1900, MAX_YEAR=2100;
  const pad=n=>String(n).padStart(2,'0');
  const iso=(y,m,d)=>String(y)+'-'+pad(m)+'-'+pad(d);
  let opened=null;

  function parsedDate(raw){
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw||''));
    if(!match)return null;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    if(year<MIN_YEAR||year>MAX_YEAR||month<1||month>12||day<1||day>new Date(year,month,0).getDate())return null;
    return {year,month,day};
  }
  function syncLabel(input,trigger){
    const dt=parsedDate(input.value);
    const name=dt?'발생 날짜 '+dt.year+'년 '+dt.month+'월 '+dt.day+'일, 달력 열기':'발생 날짜 선택 달력 열기';
    trigger.setAttribute('aria-label',name);
  }
  function openCalendar(input,trigger){
    if(opened)opened.close(false);
    if(!input.isConnected)return;
    const selected=parsedDate(input.value),today=new Date();
    let year=selected?.year||today.getFullYear(),month=selected?.month||(today.getMonth()+1);
    if(year<MIN_YEAR||year>MAX_YEAR){year=2026;month=1;}
    const yearOptions=Array.from({length:MAX_YEAR-MIN_YEAR+1},(_,n)=>MIN_YEAR+n)
      .map(y=>'<option value="'+y+'">'+y+'년</option>').join('');
    const monthOptions=Array.from({length:12},(_,n)=>n+1)
      .map(m=>'<option value="'+m+'">'+m+'월</option>').join('');
    const weekdays=['일','월','화','수','목','금','토']
      .map((w,i)=>'<span class="report410-cal-weekday'+(i===0?' sun':i===6?' sat':'')+'">'+w+'</span>').join('');
    const shade=document.createElement('div');
    shade.className='report410-cal-backdrop';
    shade.setAttribute('data-report-calendar','');
    shade.innerHTML=
      '<section class="report410-cal-dialog" role="dialog" aria-modal="true" aria-labelledby="report410-cal-title">'+
        '<div class="report410-cal-top"><strong id="report410-cal-title">사고 발생 날짜 선택</strong><button type="button" class="report410-cal-close" data-report-cal-close aria-label="달력 닫기">×</button></div>'+
        '<p class="report410-cal-help">연도와 월을 고른 다음 <b>일자</b>를 눌러 확정해 주세요.</p>'+
        '<div class="report410-cal-controls">'+
          '<button type="button" class="report410-cal-nav" data-report-cal-prev aria-label="이전 달">‹</button>'+
          '<label><span>연도</span><select data-report-cal-year aria-label="연도 선택">'+yearOptions+'</select></label>'+
          '<label><span>월</span><select data-report-cal-month aria-label="월 선택">'+monthOptions+'</select></label>'+
          '<button type="button" class="report410-cal-nav" data-report-cal-next aria-label="다음 달">›</button>'+
        '</div>'+
        '<div class="report410-cal-weekdays" aria-hidden="true">'+weekdays+'</div>'+
        '<div class="report410-cal-days" data-report-cal-days role="group" aria-label="일자 선택"></div>'+
        '<div class="report410-cal-bottom"><button type="button" data-report-cal-today>오늘 날짜</button><button type="button" data-report-cal-cancel>취소</button></div>'+
      '</section>';
    const oldOverflow=document.body.style.overflow;
    document.body.appendChild(shade);
    document.body.style.overflow='hidden';
    trigger.setAttribute('aria-expanded','true');
    const yearSelect=shade.querySelector('[data-report-cal-year]');
    const monthSelect=shade.querySelector('[data-report-cal-month]');
    const days=shade.querySelector('[data-report-cal-days]');
    const prev=shade.querySelector('[data-report-cal-prev]');
    const next=shade.querySelector('[data-report-cal-next]');

    function close(focusTrigger=true){
      if(opened?.element!==shade)return;
      opened=null;
      document.body.style.overflow=oldOverflow;
      trigger.setAttribute('aria-expanded','false');
      shade.remove();
      if(focusTrigger&&trigger.isConnected)trigger.focus({preventScroll:true});
    }
    opened={element:shade,input,close};
    function drawDays(){
      yearSelect.value=String(year);
      monthSelect.value=String(month);
      prev.disabled=year===MIN_YEAR&&month===1;
      next.disabled=year===MAX_YEAR&&month===12;
      const first=new Date(year,month-1,1).getDay();
      const count=new Date(year,month,0).getDate();
      let html='';
      for(let i=0;i<first;i++)html+='<span class="report410-cal-blank" aria-hidden="true"></span>';
      for(let day=1;day<=count;day++){
        const isSelected=!!selected&&selected.year===year&&selected.month===month&&selected.day===day;
        const isToday=year===today.getFullYear()&&month===today.getMonth()+1&&day===today.getDate();
        const dow=(first+day-1)%7;
        const cls='report410-cal-day'+(isSelected?' selected':'')+(isToday?' today':'')+(dow===0?' sun':dow===6?' sat':'');
        html+='<button type="button" class="'+cls+'" data-report-cal-day="'+day+'" aria-label="'+year+'년 '+month+'월 '+day+'일" aria-pressed="'+isSelected+'">'+day+'</button>';
      }
      days.innerHTML=html;
    }
    function navigate(delta){
      const n=year*12+(month-1)+delta;
      const y=Math.floor(n/12),m=n%12+1;
      if(y<MIN_YEAR||y>MAX_YEAR)return;
      year=y;month=m;drawDays();
    }
    function apply(dayYear,dayMonth,day){
      if(!input.isConnected){close(false);return;}
      input.value=iso(dayYear,dayMonth,day);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      syncLabel(input,trigger);
      close();
    }
    yearSelect.addEventListener('change',()=>{year=Number(yearSelect.value);drawDays();});
    monthSelect.addEventListener('change',()=>{month=Number(monthSelect.value);drawDays();});
    prev.addEventListener('click',()=>navigate(-1));
    next.addEventListener('click',()=>navigate(1));
    days.addEventListener('click',event=>{
      const button=event.target.closest('[data-report-cal-day]');
      if(button)apply(year,month,Number(button.dataset.reportCalDay));
    });
    shade.querySelector('[data-report-cal-today]').addEventListener('click',()=>apply(today.getFullYear(),today.getMonth()+1,today.getDate()));
    shade.querySelector('[data-report-cal-cancel]').addEventListener('click',()=>close());
    shade.querySelector('[data-report-cal-close]').addEventListener('click',()=>close());
    shade.addEventListener('click',event=>{if(event.target===shade)close();});
    shade.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      const controls=Array.from(shade.querySelectorAll('button:not(:disabled),select:not(:disabled)'));
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    drawDays();
    shade.querySelector('[data-report-cal-close]').focus({preventScroll:true});
  }

  function enhance(){
    const input=document.getElementById('occurredDate410');
    if(!input||input.dataset.enlCustomCalendar==='1')return;
    const wrap=input.closest('[data-report410-picker]');
    if(!wrap)return;
    wrap.classList.add('report410-custom-date');
    input.tabIndex=-1;
    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='report410-date-launch';
    trigger.setAttribute('aria-haspopup','dialog');
    trigger.setAttribute('aria-expanded','false');
    trigger.textContent='날짜 선택';
    syncLabel(input,trigger);
    trigger.addEventListener('click',event=>{event.preventDefault();openCalendar(input,trigger);});
    // Also intercept clicks produced by the surrounding <label>.
    input.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      if(!opened)openCalendar(input,trigger);
    },true);
    input.addEventListener('input',()=>syncLabel(input,trigger));
    input.addEventListener('change',()=>syncLabel(input,trigger));
    input.dataset.enlCustomCalendar='1';
    wrap.appendChild(trigger);
  }
  function start(){
    enhance();
    const watcher=new MutationObserver(()=>{
      if(opened&&!opened.input.isConnected)opened.close(false);
      const input=document.getElementById('occurredDate410');
      if(input&&input.dataset.enlCustomCalendar!=='1')enhance();
    });
    watcher.observe(document.body,{childList:true,subtree:true});
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  window.ENL_REPORT_CALENDAR_VERSION=VERSION;
})();
