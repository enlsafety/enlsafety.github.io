/* Full-resolution attachment optimization. A metric pass is not a forensic assessment:
 * originals can be retained explicitly and all unsupported/uncertain cases fail closed. */
(function(global){
  'use strict';
  const VERSION='1.0.0', TARGET=500*1024, MAX_PIXELS=16*1024*1024, TILE=256;
  const imageTypes=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
  const limits={minTileSSIM:.985,maxTileMAE:3.5,maxEdgeMAE:5,maxAlphaError:0};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  const round=(n,d=5)=>Math.round(n*10**d)/10**d;
  async function hash(blob){
    if(!global.crypto?.subtle)return '';
    const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  }
  function mimeOf(file){
    if(file.type)return file.type.toLowerCase();
    return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',pdf:'application/pdf'})[String(file.name||'').split('.').pop().toLowerCase()]||'application/octet-stream';
  }
  function decode(blob){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob),img=new Image();let settled=false;
      const finish=(err)=>{if(settled)return;settled=true;clearTimeout(timer);URL.revokeObjectURL(url);err?reject(err):resolve(img)};
      const timer=setTimeout(()=>finish(Error('image_decode_timeout')),20000);
      img.onload=()=>finish();img.onerror=()=>finish(Error('image_decode_failed'));img.src=url;
    });
  }
  function encode(canvas,mime,quality){
    return new Promise(resolve=>{
      try{canvas.toBlob(blob=>resolve(blob?.type===mime?blob:null),mime,quality)}catch(e){resolve(null)}
    });
  }
  function canvasFor(w,h){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('canvas_unavailable');
    return {canvas,ctx};
  }
  function standardSrgbProfile(bytes){
    // Match the actual matrix and transfer curves, not the editable profile name.
    try{
      if(bytes.length<132)return false;
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=(p,n)=>String.fromCharCode(...bytes.subarray(p,p+n)),n=view.getUint32(128),tags={};
      if(text(36,4)!=='acsp'||text(16,4)!=='RGB '||text(20,4)!=='XYZ '||n>128||132+n*12>bytes.length)return false;
      for(let k=0;k<n;k++){const p=132+k*12,at=view.getUint32(p+4),length=view.getUint32(p+8);if(at+length>bytes.length)return false;tags[text(p,4)]={at,length}}
      if(['A2B0','A2B1','A2B2','B2A0','B2A1','B2A2'].some(k=>tags[k]))return false;
      const fixed=p=>view.getInt32(p)/65536,near=(x,y)=>Math.abs(x-y)<.0002;
      for(const [key,expected] of Object.entries({rXYZ:[.43607,.22249,.01392],gXYZ:[.38515,.71687,.09708],bXYZ:[.14307,.06061,.71410],wtpt:[.9642,1,.8249]})){
        const t=tags[key];if(!t||t.length<20||text(t.at,4)!=='XYZ '||expected.some((v,j)=>!near(fixed(t.at+8+j*4),v)))return false;
      }
      for(const key of ['rTRC','gTRC','bTRC']){
        const t=tags[key];if(!t||t.length<32||text(t.at,4)!=='para')return false;
        const type=view.getUint16(t.at+8),expected=[2.4,1/1.055,.055/1.055,1/12.92,.04045];
        if(type!==3&&type!==4)return false;if(type===4){if(t.length<40)return false;expected.push(0,0)}
        if(expected.some((v,j)=>!near(fixed(t.at+12+j*4),v)))return false;
      }
      return true;
    }catch(e){return false}
  }
  function embeddedProfile(header,mime){
    try{
      const v=new DataView(header.buffer,header.byteOffset,header.byteLength),text=(p,n)=>String.fromCharCode(...header.subarray(p,p+n));
      if(mime==='image/jpeg'){
        const parts=[];let total=0;
        for(let p=2;p+4<=header.length;){
          if(header[p]!==255)break;const marker=header[p+1];if(marker===218||marker===217)break;
          const len=v.getUint16(p+2);if(len<2||p+2+len>header.length)break;
          if(marker===226&&len>=16&&text(p+4,12)==='ICC_PROFILE\0'){const seq=header[p+16],count=header[p+17];if(!seq||!count||count>64||seq>count||(total&&total!==count)||parts[seq-1])return null;total=count;parts[seq-1]=header.slice(p+18,p+2+len)}
          p+=2+len;
        }
        if(!total||parts.length!==total||Array.from({length:total},(_,i)=>parts[i]).some(x=>!x))return null;
        const joined=new Uint8Array(parts.reduce((n,x)=>n+x.length,0));let offset=0;for(const part of parts){joined.set(part,offset);offset+=part.length}return joined;
      }
      if(mime==='image/webp'){for(let p=12;p+8<=header.length;){const size=v.getUint32(p+4,true);if(p+8+size>header.length)return null;if(text(p,4)==='ICCP')return header.slice(p+8,p+8+size);p+=8+size+(size%2)}}
    }catch(e){}
    return null;
  }
  async function compare(reference,candidate){
    const w=reference.width,h=reference.height,a=reference.getContext('2d',{willReadFrequently:true}),b=candidate.getContext('2d',{willReadFrequently:true});
    let minTileSSIM=1,maxTileMAE=0,maxEdgeMAE=0,maxAlphaError=0,tiles=0;
    for(let y=0;y<h;y+=TILE){
      for(let x=0;x<w;x+=TILE){
        const tw=Math.min(TILE,w-x),th=Math.min(TILE,h-y),src=a.getImageData(x,y,tw,th).data,dst=b.getImageData(x,y,tw,th).data,n=tw*th;
        let sx=0,sy=0,sxx=0,syy=0,sxy=0,error=0,edgeError=0,edges=0;
        for(let p=0;p<n;p++){
          const i=p*4,sl=.2126*src[i]+.7152*src[i+1]+.0722*src[i+2],dl=.2126*dst[i]+.7152*dst[i+1]+.0722*dst[i+2];
          sx+=sl;sy+=dl;sxx+=sl*sl;syy+=dl*dl;sxy+=sl*dl;
          const delta=(Math.abs(src[i]-dst[i])+Math.abs(src[i+1]-dst[i+1])+Math.abs(src[i+2]-dst[i+2]))/3;
          error+=delta;maxAlphaError=Math.max(maxAlphaError,Math.abs(src[i+3]-dst[i+3]));
          // Every native-resolution edge is assessed, including 1px text and fine cracks.
          const left=p%tw?i-4:i,up=p>=tw?i-tw*4:i;
          const gradient=Math.max(Math.abs(src[i]-src[left]),Math.abs(src[i+1]-src[left+1]),Math.abs(src[i+2]-src[left+2]),Math.abs(src[i]-src[up]),Math.abs(src[i+1]-src[up+1]),Math.abs(src[i+2]-src[up+2]));
          if(gradient>=20){edgeError+=delta;edges++}
        }
        const mx=sx/n,my=sy/n,vx=Math.max(0,sxx/n-mx*mx),vy=Math.max(0,syy/n-my*my),cov=sxy/n-mx*my;
        const ssim=((2*mx*my+6.5025)*(2*cov+58.5225))/((mx*mx+my*my+6.5025)*(vx+vy+58.5225));
        minTileSSIM=Math.min(minTileSSIM,ssim);maxTileMAE=Math.max(maxTileMAE,error/n);maxEdgeMAE=Math.max(maxEdgeMAE,edges?edgeError/edges:0);tiles++;
      }
      // Yield between rows so the mobile page can paint and handle touch/scroll.
      await tick();
    }
    return {passed:minTileSSIM>=limits.minTileSSIM&&maxTileMAE<=limits.maxTileMAE&&maxEdgeMAE<=limits.maxEdgeMAE&&maxAlphaError<=limits.maxAlphaError,minTileSSIM:round(minTileSSIM),maxTileMAE:round(maxTileMAE),maxEdgeMAE:round(maxEdgeMAE),maxAlphaError,tiles};
  }
  async function prepare(file,options={}){
    const sourceMime=mimeOf(file),sourceSha256=await hash(file).catch(()=>''),base={version:VERSION,sourceBytes:file.size,outputBytes:file.size,sourceMime,mime:sourceMime,originalName:String(file.name||'file').slice(0,120),sourceSha256,sha256:sourceSha256,preservedOriginal:true,mode:'original'};
    const original=reason=>({file,optimization:{...base,reason}});
    if(options.preserveOriginal)return original('evidence_original_requested');
    if(!imageTypes.has(sourceMime))return original(sourceMime==='application/pdf'?'pdf_unchanged':'unsupported_type');
    // Canvas may tone-map HEIC/HDR or wide-gamut profiles to sRGB. Keep those source
    // bytes until a codec can prove profile/bit-depth preservation on the device.
    if(sourceMime==='image/heic'||sourceMime==='image/heif')return original('heic_original_color_preserved');
    if(file.size>32*1024*1024)return original('source_size_limit');
    // Animated evidence must never be flattened to its first frame.
    const header=new Uint8Array(await file.slice(0,262144).arrayBuffer());
    const headerText=new TextDecoder('latin1').decode(header),extendedWebP=sourceMime==='image/webp'&&header.length>20&&String.fromCharCode(...header.slice(12,16))==='VP8X';
    if(sourceMime==='image/png'&&header.length>25&&header[24]>8)return original('high_bit_depth_preserved');
    if((extendedWebP&&(header[20]&2))||(sourceMime==='image/png'&&headerText.includes('acTL')))return original('animated_image');
    const hasProfile=headerText.includes('ICC_PROFILE')||(sourceMime==='image/png'&&(headerText.includes('iCCP')||headerText.includes('cICP')))||(extendedWebP&&(header[20]&32));
    if(hasProfile){const profile=embeddedProfile(header,sourceMime);if(!profile||!standardSrgbProfile(profile))return original('color_profile_preserved');base.sourceColorProfile='verified_srgb'}
    if(sourceMime==='image/jpeg'&&headerText.includes('Adobe')&&!hasProfile)return original('color_profile_preserved');
    let reference,output;
    try{
      const img=await decode(file),w=img.naturalWidth,h=img.naturalHeight;
      Object.assign(base,{sourceWidth:w,sourceHeight:h,width:w,height:h});
      if(!w||!h||w*h>MAX_PIXELS)return original('pixel_memory_limit');
      reference=canvasFor(w,h);reference.ctx.drawImage(img,0,0,w,h);
      // The whole native-resolution image is inspected; there is no dimension reduction.
      let alpha=false;
      for(let y=0;y<h&&!alpha;y+=TILE){for(let x=0;x<w&&!alpha;x+=TILE){const pixels=reference.ctx.getImageData(x,y,Math.min(TILE,w-x),Math.min(TILE,h-y)).data;for(let i=3;i<pixels.length;i+=4){if(pixels[i]!==255){alpha=true;break}}}await tick()}
      const trials=alpha?[['image/png',1]]:[['image/webp',.88],['image/webp',.82],['image/webp',.96],['image/jpeg',.94],['image/jpeg',.99]];
      let best=null,quality=null,metrics=null;
      output=canvasFor(w,h);
      for(const [mime,q] of trials){
        // Once WebP passes at .82, higher quality cannot improve byte savings.
        if(best&&mime==='image/webp'&&q>.88)continue;
        const blob=await encode(reference.canvas,mime,q);
        if(!blob||blob.size>=file.size*.95||(best&&blob.size>=best.size))continue;
        const decoded=await decode(blob);if(decoded.naturalWidth!==w||decoded.naturalHeight!==h)continue;
        output.ctx.clearRect(0,0,w,h);output.ctx.drawImage(decoded,0,0,w,h);
        const result=await compare(reference.canvas,output.canvas);
        if(result.passed){best=blob;quality=q;metrics=result}
      }
      if(!best)return original('no_smaller_quality_pass');
      const ext=best.type==='image/webp'?'webp':best.type==='image/png'?'png':'jpg',name=String(file.name||'photo').replace(/\.[^.]+$/,'')+'.'+ext;
      const optimized=new File([best],name,{type:best.type,lastModified:file.lastModified||Date.now()});
      return {file:optimized,optimization:{...base,outputBytes:optimized.size,mime:optimized.type,sha256:await hash(optimized),preservedOriginal:false,mode:'full_resolution',quality,targetBytes:TARGET,targetMet:optimized.size<=TARGET,metrics}};
    }catch(e){return original('quality_check_unavailable')}
    finally{if(reference)reference.canvas.width=reference.canvas.height=1;if(output)output.canvas.width=output.canvas.height=1}
  }
  global.ENLImageOptimizer=Object.freeze({prepare,version:VERSION,limits:Object.freeze({...limits})});
})(window);
