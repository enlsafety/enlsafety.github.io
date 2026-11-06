/* E&L Incident Report: explicit year/month/day calendar for mobile and desktop. */
(function(){
  'use strict';
  const VERSION='4.8.13-r77';
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
    if(!input.isConnected||input.disabled||input.readOnly)return;
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

  function parsedTime(raw){
    const match=/^(\d{2}):(\d{2})$/.exec(String(raw||''));
    return match&&Number(match[1])<24&&Number(match[2])<60?{hour:Number(match[1]),minute:Number(match[2])}:null;
  }
  function mask(raw,type){
    const digits=String(raw||'').replace(/\D/g,'').slice(0,type==='date'?8:4);
    if(type==='time')return digits.slice(0,2)+(digits.length>=2?':':'')+digits.slice(2);
    return digits.slice(0,4)+(digits.length>=4?'-':'')+digits.slice(4,6)+(digits.length>=6?'-':'')+digits.slice(6);
  }
  function validate(input,type){
    const valid=!input.value||(type==='date'?parsedDate(input.value):parsedTime(input.value));
    input.setCustomValidity(valid?'':type==='date'?'발생 날짜를 1900~2100년의 올바른 날짜로 입력해 주세요. 예: 2026-11-06':'발생 시간을 00:00~23:59 형식으로 입력해 주세요. 예: 09:30');
    return input.disabled||input.checkValidity();
  }
  function openTime(input,trigger){
    if(input.disabled||input.readOnly||!input.isConnected)return;
    if(opened)opened.close(false);
    const selected=parsedTime(input.value);
    let hour=selected?.hour??new Date().getHours(),minute=selected?.minute??0,stage='hour';
    const shade=document.createElement('div');shade.className='report410-cal-backdrop';shade.setAttribute('data-report-time','');
    shade.innerHTML='<section class="report410-cal-dialog report410-time-dialog" role="dialog" aria-modal="true" aria-labelledby="report410-time-title">'+
      '<div class="report410-cal-top"><strong id="report410-time-title">사고 발생 시간 선택</strong><button type="button" class="report410-cal-close" data-report-time-close aria-label="시간 선택 닫기">×</button></div>'+
      '<p class="report410-cal-help">시를 고른 다음 분을 누르면 입력이 완료됩니다. (24시간제)</p>'+
      '<div class="report410-time-tabs"><button type="button" data-report-time-hour-tab></button><span>:</span><button type="button" data-report-time-minute-tab></button></div>'+
      '<p class="report410-time-stage" aria-live="polite"></p><div class="report410-time-grid" role="group"></div>'+
      '<div class="report410-cal-bottom"><button type="button" data-report-time-cancel>취소</button></div></section>';
    const overflow=document.body.style.overflow;document.body.appendChild(shade);document.body.style.overflow='hidden';trigger.setAttribute('aria-expanded','true');
    function close(focus=true){if(opened?.element!==shade)return;opened=null;shade.remove();document.body.style.overflow=overflow;trigger.setAttribute('aria-expanded','false');if(focus&&trigger.isConnected)trigger.focus({preventScroll:true})}
    opened={element:shade,input,close};
    const grid=shade.querySelector('.report410-time-grid'),hourTab=shade.querySelector('[data-report-time-hour-tab]'),minuteTab=shade.querySelector('[data-report-time-minute-tab]');
    function draw(focus=false){
      hourTab.textContent=pad(hour)+'시';minuteTab.textContent=pad(minute)+'분';hourTab.setAttribute('aria-pressed',stage==='hour');minuteTab.setAttribute('aria-pressed',stage==='minute');
      shade.querySelector('.report410-time-stage').textContent=stage==='hour'?'시 선택':'분 선택';grid.setAttribute('aria-label',stage==='hour'?'시 선택':'분 선택');
      grid.innerHTML=Array.from({length:stage==='hour'?24:60},(_,n)=>'<button type="button" data-report-time-'+stage+'="'+n+'" class="report410-cal-day'+(n===(stage==='hour'?hour:minute)?' selected':'')+'" aria-label="'+pad(n)+(stage==='hour'?'시':'분')+'">'+pad(n)+'</button>').join('');
      grid.scrollTop=0;if(focus)grid.querySelector('button.selected').focus({preventScroll:true});
    }
    hourTab.onclick=()=>{stage='hour';draw(true)};minuteTab.onclick=()=>{stage='minute';draw(true)};
    grid.onclick=e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-report-time-hour')){hour=Number(button.dataset.reportTimeHour);stage='minute';draw(true);return}
      if(!input.isConnected||input.disabled){close(false);return}
      minute=Number(button.dataset.reportTimeMinute);input.value=pad(hour)+':'+pad(minute);
      input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();
    };
    shade.querySelector('[data-report-time-close]').onclick=()=>close();shade.querySelector('[data-report-time-cancel]').onclick=()=>close();
    shade.onclick=e=>{if(e.target===shade)close()};
    shade.onkeydown=e=>{
      if(e.key==='Escape'){e.preventDefault();close();return}if(e.key!=='Tab')return;
      const controls=[...shade.querySelectorAll('button:not(:disabled)')],first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    };
    draw();shade.querySelector('[data-report-time-close]').focus({preventScroll:true});
  }
  function enhance(){
    for(const type of ['date','time']){
      const input=document.getElementById(type==='date'?'occurredDate410':'occurredTime410');
      if(!input||input.dataset.enlCustomCalendar==='1'||input.readOnly)continue;
      const wrap=input.closest('[data-report410-picker]');if(!wrap)continue;
      wrap.classList.add('report410-custom-'+type);
      const value=input.value;input.type='text';input.value=value;input.inputMode='numeric';input.autocomplete='off';input.maxLength=type==='date'?10:5;input.tabIndex=0;
      input.placeholder=type==='date'?'0000-00-00':'00:00';
      const trigger=document.createElement('button');trigger.type='button';trigger.className=type==='date'?'report410-date-launch':'report410-time-launch';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
      trigger.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(type==='date'?'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')+'</svg>';
      const sync=()=>{trigger.disabled=input.disabled;if(type==='date')syncLabel(input,trigger);else trigger.setAttribute('aria-label',input.value?'발생 시간 '+input.value+', 시간 선택 열기':'발생 시간 선택 열기');input.placeholder=input.disabled?'시간 미상':type==='date'?'0000-00-00':'00:00';validate(input,type)};
      const format=()=>{
        const before=input.value,caret=input.selectionStart??before.length,count=before.slice(0,caret).replace(/\D/g,'').length;
        input.value=mask(before,type);
        let pos=0,seen=0;while(pos<input.value.length&&seen<count){if(/\d/.test(input.value[pos]))seen++;pos++}while(pos<input.value.length&&/[-:]/.test(input.value[pos]))pos++;
        if(document.activeElement===input)input.setSelectionRange(pos,pos);sync();
      };
      // Keep the caret usable when deleting an automatically inserted separator.
      input.addEventListener('keydown',e=>{const p=input.selectionStart;if(e.key==='Backspace'&&p===input.selectionEnd&&p>1&&/[-:]/.test(input.value[p-1]))input.setSelectionRange(p-2,p)});
      input.addEventListener('input',format,true);input.addEventListener('change',format,true);input.addEventListener('blur',sync);
      trigger.addEventListener('click',e=>{e.preventDefault();if(!input.disabled)(type==='date'?openCalendar:openTime)(input,trigger)});
      input.dataset.enlCustomCalendar='1';wrap.appendChild(trigger);sync();
    }
  }
  function start(){
    enhance();
    const watcher=new MutationObserver(()=>{
      if(opened&&(!opened.input.isConnected||opened.input.disabled))opened.close(false);
      enhance();
      for(const id of ['occurredDate410','occurredTime410']){
        const input=document.getElementById(id),trigger=input?.closest('[data-report410-picker]')?.querySelector('button');
        if(trigger&&trigger.disabled!==input.disabled)trigger.disabled=input.disabled;
        if(input?.disabled){input.placeholder='시간 미상';input.setCustomValidity('')}
        else if(input?.dataset.enlCustomCalendar==='1')input.placeholder=id==='occurredDate410'?'0000-00-00':'00:00';
      }
    });
    watcher.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
  }
  window.enlValidateOccurrenceInputs=()=>{
    for(const [id,type] of [['occurredDate410','date'],['occurredTime410','time']]){
      const input=document.getElementById(id);if(input&&!validate(input,type)){input.reportValidity();return false}
    }return true;
  };
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  window.ENL_REPORT_CALENDAR_VERSION=VERSION;
})();
