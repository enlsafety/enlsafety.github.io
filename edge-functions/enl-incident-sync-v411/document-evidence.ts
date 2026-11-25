// Preserve original PDFs and the existing compressed JPEG evidence format.
export const MAX_DOCUMENT_PDF_BYTES = 10 * 1024 * 1024;

export function validPrintPhoto(data:unknown){
  if(typeof data!=='string'||data.length>466668||!/^\/9j\/[a-zA-Z0-9+/]*={0,2}$/.test(data))return false;
  let image;
  try{image=atob(data);}catch{return false;}
  if(image.length>350000||!image.endsWith('\xff\xd9'))return false;
  const word=(i:number)=>image.charCodeAt(i)*256+image.charCodeAt(i+1);
  let hasFrame=false;
  for(let i=2;i+4<image.length;){
    if(image.charCodeAt(i++)!==255)return false;
    while(image.charCodeAt(i)===255)i++;
    const marker=image.charCodeAt(i++),size=word(i);
    if(size<2||i+size>image.length)return false;
    if([192,193,194].includes(marker)){
      if(size<8||!word(i+3)||!word(i+5)||Math.max(word(i+3),word(i+5))>1400)return false;
      hasFrame=true;
    }
    if(marker===218)return hasFrame&&i+size<image.length-2;
    i+=size;
  }
  return false;
}

export function validDocumentEvidence(data:unknown){
  if(typeof data!=='string')return false;
  if(data.startsWith('/9j/'))return validPrintPhoto(data);
  if(data.length>Math.ceil(MAX_DOCUMENT_PDF_BYTES/3)*4||!/^JVBERi0[A-Za-z0-9+/]*={0,2}$/.test(data))return false;
  try{
    const pdf=atob(data);
    return pdf.length<=MAX_DOCUMENT_PDF_BYTES&&/^%PDF-(1\.[0-7]|2\.0)[\r\n\t ]/.test(pdf)&&/%%EOF[\s\x00]*$/.test(pdf.slice(-2048));
  }catch{return false;}
}

export function documentEvidenceUrl(data:string){
  const base64=data.replace(/\s/g,'');
  return 'data:'+(base64.startsWith('JVBERi0')?'application/pdf':'image/jpeg')+';base64,'+base64;
}
