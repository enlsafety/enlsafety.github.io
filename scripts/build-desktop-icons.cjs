// Repack the approved raster into OS icon slots; never redraw the artwork.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'sharp'):'sharp');
const {execFileSync}=require('node:child_process');
(async()=>{
 const original='assets/enl-app-icon-r53.png';
 const {data,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // The supplied RGB master has white outside the rounded blue tile. Walk in
 // from each side only: enclosed white lettering is always left untouched.
 const {width,height}=info;
 for(let y=0;y<height;y++){
  for(const direction of [1,-1]){
   const start=direction===1?0:width-1;
   for(let x=start;x>=0 && x<width;x+=direction){
    const pixel=(y*width+x)*4;
    if(data[pixel+2]-data[pixel]>32)break;
    data[pixel+3]=0;
   }
  }
 }
 const source=await sharp(data,{raw:{width,height,channels:4}}).png().toBuffer();
 // Match the sky blue gradient at the top and bottom of the app tile.
 function skyBackground(size){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#48c5fa"/><stop offset="1" stop-color="#008cf7"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#sky)"/></svg>';
  return sharp(Buffer.from(svg));
 }
 // Ignore effectively invisible alpha residue when measuring, with a 4px source gutter.
 let l=info.width,t=info.height,r=0,b=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}
 const crop={left:Math.max(0,l-4),top:Math.max(0,t-4),width:Math.min(info.width,r+5)-Math.max(0,l-4),height:Math.min(info.height,b+5)-Math.max(0,t-4)};
 // iOS requires an opaque tile; the adaptive asset keeps the entire mark in its safe circle.
 await skyBackground(180).composite([{input:await sharp(source).resize(180,180).png().toBuffer()}]).removeAlpha().png().toFile('pwa-icon-180.png');
 fs.copyFileSync('pwa-icon-180.png','apple-touch-icon.png');
 let maxRadius=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8)maxRadius=Math.max(maxRadius,Math.hypot(x-info.width/2,y-info.height/2));
 const adaptiveSize=Math.floor(info.width*200/maxRadius/2)*2;
 const offset=(512-adaptiveSize)/2;
 await skyBackground(512).composite([{input:await sharp(source).resize(adaptiveSize,adaptiveSize).png().toBuffer(),left:offset,top:offset}]).png().toFile('pwa-icon-maskable-512.png');
 console.log('Adaptive mark radius',maxRadius*adaptiveSize/info.width,'<204.8');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'enl-icons-'));
 const sizes=[16,20,24,32,40,48,64,128,192,256,512];
 for(const size of sizes){
  const border=size>=256?2:1;
  const file=path.join(tmp,`${size}.png`);
  await sharp(source).extract(crop).resize(size-2*border,size-2*border,{fit:'contain',background:'#00000000'}).extend({top:border,bottom:border,left:border,right:border,background:'#00000000'}).png().toFile(file);
  if([16,32].includes(size))fs.copyFileSync(file,`favicon-${size}.png`);
  if([192,512].includes(size))fs.copyFileSync(file,`pwa-icon-${size}.png`);
  const {data:p,info:m}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if((x===0||y===0||x===size-1||y===size-1)&&p[(y*size+x)*4+3]!==0)throw Error(`Artwork touches edge: ${size}`);
  console.log(`PASS ${size}x${size}: clear edge, proportional fit`);
 }
 execFileSync('convert',sizes.filter(n=>n<=256).map(n=>path.join(tmp,`${n}.png`)).concat('favicon.ico'));
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Approved source crop',crop);
})();
