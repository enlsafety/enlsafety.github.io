/* E&L Accident Report App v4.2.3 - prominent finalized read acknowledgement */
(function(){
  'use strict';
  const VERSION='4.2.3-reader-ack1';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const userId=u=>String(u?.id||u?.personnelId||u?.username||'');

  function ensureCss(){
    if(document.getElementById('reader423AckCss'))return;
    const s=document.createElement('style');
    s.id='reader423AckCss';
    s.textContent=`
      .reader423-ack-banner{margin:12px 0 14px;padding:14px;border:2px solid #e3a93c;border-radius:14px;background:#fff8e8;box-shadow:0 5px 16px rgba(134,91,17,.09)}
      .reader423-ack-banner.done{border-color:#8fc8a4;background:#eef9f2;box-shadow:none}
      .reader423-ack-title{display:flex;align-items:center;gap:9px;color:#6f4b12;font-size:17px;font-weight:950;line-height:1.35}
      .reader423-ack-banner.done .reader423-ack-title{color:#256343}
      .reader423-ack-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;border-radius:50%;background:#e3a93c;color:#fff;font-size:17px;font-weight:950}
      .reader423-ack-banner.done .reader423-ack-icon{background:#4f9b6d}
      .reader423-ack-desc{margin:8px 0 11px;color:#665a45;font-size:13px;line-height:1.55;font-weight:750}
      .reader423-ack-banner.done .reader423-ack-desc{color:#4c6e59}
      .reader423-ack-banner #ackIncident411{margin:0;min-height:54px;background:#175f96;border:2px solid #175f96;border-radius:11px;color:#fff;font-size:16px;font-weight:950;box-shadow:0 5px 12px rgba(23,95,150,.18)}
      .reader423-ack-banner #ackIncident411:hover:not(:disabled),.reader423-ack-banner #ackIncident411:focus-visible:not(:disabled){background:#124c78;border-color:#124c78;outline:3px solid rgba(30,93,145,.17);outline-offset:2px}
      .reader423-ack-banner #ackIncident411.done{background:#fff;border-color:#9fcdb0;color:#286847;box-shadow:none}
      .reader423-list-ack{display:inline-flex;align-items:center;min-height:25px;margin-left:6px;padding:0 9px;border-radius:999px;border:1px solid #e1b25a;background:#fff6df;color:#795317;font-size:11px;font-weight:950;vertical-align:middle}
      .reader423-list-ack.done{border-color:#a9d0b7;background:#edf8f1;color:#2a6847}
      @media(max-width:560px){.reader423-ack-banner{padding:12px}.reader423-ack-title{font-size:16px}.reader423-ack-banner #ackIncident411{min-height:56px;font-size:16px}.reader423-list-ack{display:flex;width:max-content;margin:7px 0 0}}
    `;
    document.head.appendChild(s);
  }

  function receiptFor(i,u){
    const id=userId(u);if(!id)return null;
    return (Array.isArray(i?.readReceipts)?i.readReceipts:[]).find(r=>String(r?.userId||'')===id)||null;
  }

  function decorateClosedList(){
    const u=currentUser?.();if(!isReader(u))return;
    document.querySelectorAll('[data-lifecycle-open]').forEach(card=>{
      const id=String(card.dataset.lifecycleOpen||'');
      const i=(data?.incidents||[]).find(x=>String(x?.id||'')===id);
      if(!i||String(i.status||'')!=='closed'||String(i.corrective?.status||'')!=='approved')return;
      const receipt=receiptFor(i,u),existing=card.querySelector('.reader423-list-ack');
      if(existing){existing.classList.toggle('done',!!receipt);existing.textContent=receipt?'✓ 열람확인 완료':'● 열람확인 필요';return}
      const mark=document.createElement('span');mark.className=`reader423-list-ack ${receipt?'done':''}`.trim();mark.textContent=receipt?'✓ 열람확인 완료':'● 열람확인 필요';
      const top=card.firstElementChild;if(top)top.appendChild(mark);else card.prepend(mark);
    });
  }

  function decorateClosedModal(){
    const u=currentUser?.();if(!isReader(u))return;
    const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
    const final=modal.querySelector('[data-lifecycle-final]'),btn=modal.querySelector('#ackIncident411');
    if(!final||!btn)return;
    const id=String(final.getAttribute('data-lifecycle-final')||'');
    const i=(data?.incidents||[]).find(x=>String(x?.id||'')===id);
    if(!i)return;
    const receipt=receiptFor(i,u),done=!!receipt||btn.classList.contains('done')||btn.disabled;
    let banner=modal.querySelector('.reader423-ack-banner');
    if(!banner){
      banner=document.createElement('section');banner.className='reader423-ack-banner';banner.setAttribute('aria-label','종결사고 열람 확인');
      const head=modal.querySelector('.modal-head');if(head)head.insertAdjacentElement('afterend',banner);else modal.prepend(banner);
    }
    banner.classList.toggle('done',done);
    banner.innerHTML=`<div class="reader423-ack-title"><span class="reader423-ack-icon">${done?'✓':'!'}</span><span>${done?'이 종결사고는 열람 확인을 완료했습니다':'이 종결사고는 열람 확인이 필요합니다'}</span></div><div class="reader423-ack-desc">${done?'확인 기록이 저장되어 있습니다. 아래에서 사고경위와 최종 조치내용을 계속 확인할 수 있습니다.':'사고경위와 최종 조치내용을 확인한 뒤 아래 버튼을 눌러 공식 열람 기록을 남겨주세요.'}</div>`;
    if(done){
      btn.classList.add('done');btn.disabled=true;
      if(receipt?.readAt&&typeof fmt==='function')btn.textContent=`✓ ${fmt(receipt.readAt)} 열람 확인 완료`;
      else if(!String(btn.textContent||'').includes('완료'))btn.textContent='✓ 열람 확인 완료';
    }else{
      btn.classList.remove('done');btn.textContent='✓ 이 종결사고 열람 확인하기';
    }
    banner.appendChild(btn);
  }

  let queued=false,timer=null;
  function schedule(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{
      queued=false;decorateClosedList();
      clearTimeout(timer);timer=setTimeout(decorateClosedModal,40);
    });
  }

  ensureCss();
  const root=document.getElementById('app')||document.body;
  const mo=new MutationObserver(schedule);mo.observe(root,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-lifecycle-open]'))setTimeout(decorateClosedModal,60)},true);
  schedule();
  window.ENL_READER_ACK_UX_VERSION=VERSION;
})();
