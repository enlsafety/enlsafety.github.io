/* E&L Accident Report App v4.3.1 - incident review readability */
(function(){
  'use strict';

  const VERSION='4.3.1-review-preview1';
  const baseBind=window.enlBindAttachmentOpen;

  function ensureCss(){
    if(document.getElementById('incidentReview431Css'))return;
    const style=document.createElement('style');
    style.id='incidentReview431Css';
    style.textContent=`
      /* Long accident-detail rows need a visible but quiet separator. */
      .inc411-section-body>.inc411-kv{
        padding-top:9px;
        padding-bottom:9px;
      }
      .inc411-section-body>.inc411-kv+.inc411-kv{
        border-top:1px solid #d8ebf7;
      }
      .inc411-section-body>.inc411-kv>b{
        color:#4c6a80;
      }
      .inc411-section-body>.inc411-kv>span{
        line-height:1.65;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
      }

      /* Persisted images are signed on review and then displayed as real thumbnails. */
      .attach-card411.review431-image{
        min-height:126px;
        padding:0;
        background:#eef6fb;
      }
      .attach-card411.review431-image>img.review431-thumb{
        display:block;
        width:100%;
        height:126px;
        min-height:126px;
        object-fit:cover;
        border-radius:0;
        background:#eef6fb;
      }
      .attach-card411.review431-loading .attach-file411{
        opacity:.58;
      }
      .attach-card411.review431-loading::after{
        content:'미리보기 불러오는 중';
        position:absolute;
        left:7px;
        right:7px;
        bottom:7px;
        z-index:1;
        padding:4px 6px;
        border-radius:7px;
        background:rgba(31,85,124,.76);
        color:#fff;
        font-size:10px;
        font-weight:800;
        pointer-events:none;
      }
      @media(max-width:620px){
        .inc411-section-body>.inc411-kv{padding-top:10px;padding-bottom:10px}
        .attach-card411.review431-image>img.review431-thumb{height:116px;min-height:116px}
        .attach-card411.review431-image{min-height:116px}
      }
    `;
    document.head.appendChild(style);
  }

  function isStoredImage(file){
    if(!file||typeof file!=='object')return false;
    const kind=String(file.kind||'').toLowerCase();
    const mime=String(file.mime||'').toLowerCase();
    return !!file.path && (kind==='image'||mime.startsWith('image/')) && !file.previewUrl;
  }

  function urlForPath(urls,path,index){
    if(!urls)return '';
    if(typeof urls==='string')return urls;
    if(Array.isArray(urls)){
      const item=urls[index];
      if(typeof item==='string')return item;
      return item?.url||item?.signedUrl||item?.signed_url||'';
    }
    const direct=urls[path];
    if(typeof direct==='string')return direct;
    if(direct&&typeof direct==='object')return direct.url||direct.signedUrl||direct.signed_url||'';
    return '';
  }

  async function hydrateSavedImagePreviews(root,list){
    if(!root||!Array.isArray(list)||typeof signAttachments!=='function')return;
    const targets=[];
    list.forEach((file,index)=>{
      if(!isStoredImage(file))return;
      const card=root.querySelector(`[data-attach-card="${index}"]`);
      if(!card||card.querySelector('img.review431-thumb'))return;
      card.classList.add('review431-loading');
      targets.push({file,index,card});
    });
    if(!targets.length)return;

    const paths=[...new Set(targets.map(x=>String(x.file.path||'')).filter(Boolean))];
    if(!paths.length)return;
    try{
      const urls=await signAttachments(paths);
      targets.forEach(({file,index,card})=>{
        if(!card?.isConnected)return;
        const path=String(file.path||'');
        const pathIndex=paths.indexOf(path);
        const src=urlForPath(urls,path,pathIndex);
        card.classList.remove('review431-loading');
        if(!src)return;
        const old=card.querySelector('.attach-file411');
        const img=document.createElement('img');
        img.className='review431-thumb';
        img.alt=String(file.name||`사고사진 ${index+1}`);
        img.loading='lazy';
        img.decoding='async';
        img.src=src;
        img.addEventListener('load',()=>card.classList.add('review431-image'),{once:true});
        img.addEventListener('error',()=>{
          card.classList.remove('review431-image');
          img.remove();
          if(old)old.style.display='grid';
        },{once:true});
        if(old){old.style.display='none';old.insertAdjacentElement('afterend',img)}
        else card.prepend(img);
      });
    }catch(err){
      targets.forEach(({card})=>card?.classList.remove('review431-loading'));
      console.warn('[incident-review-v431] thumbnail signing failed',err);
    }
  }

  function enhancedBind(root,list){
    try{baseBind?.(root,list)}catch(err){console.warn('[incident-review-v431] base attachment binding failed',err)}
    hydrateSavedImagePreviews(root,list);
  }

  ensureCss();
  window.enlBindAttachmentOpen=enhancedBind;
  window.enlHydrateIncidentThumbnails431=hydrateSavedImagePreviews;
  window.ENL_INCIDENT_REVIEW_VERSION=VERSION;
})();
