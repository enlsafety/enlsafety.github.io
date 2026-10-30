/* E&L Accident Report App v4.3.1 - incident review readability */
(function(){
  'use strict';

  const VERSION='4.8.4-single-preview';

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

      @media(max-width:620px){
        .inc411-section-body>.inc411-kv{padding-top:10px;padding-bottom:10px}
      }
    `;
    document.head.appendChild(style);
  }

  // core.js owns attachment hydration for every gallery. Running a second
  // signer here inserted a second image when its response arrived after the
  // core preview. Keep review styling only; never wrap the shared binder.
  ensureCss();
  window.ENL_INCIDENT_REVIEW_VERSION=VERSION;
})();
