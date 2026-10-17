// Shared, transport-independent closure contract. No ERP credentials or endpoints.
export class Fault extends Error {
  constructor(code, status = 409) { super(code); this.status = status; }
}
export const terminal = s => ['approved', 'rejected'].includes(s);
export function assertReady(i, role) {
  if (role !== 'safety') throw new Fault('safety_only', 403);
  if (i.recordMode === 'historical_transfer' || i.historicalImport?.enabled || i.historicalTransfer) throw new Fault('historical_excluded');
  if (i.status !== 'approved' || !i.approvedAt || i.corrective?.status !== 'approved' || !i.corrective.reviewedAt) throw new Fault('reviews_required');
  for (const k of ['rootCause', 'planDetail', 'actionDetail']) if (!String(i.corrective[k] || '').trim()) throw new Fault('incomplete_corrective');
  if (!i.corrective.afterPhotos?.length) throw new Fault('evidence_required');
}
export function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])]));
  return x;
}
export async function sha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
const enc = s => new TextEncoder().encode(s);
const xml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const b64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
export const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function crc32(bytes) { let c = -1; for (const b of bytes) { c ^= b; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; }
function numbers(size, fields) { const a = new Uint8Array(size), d = new DataView(a.buffer); for (const [offset, width, value] of fields) width === 4 ? d.setUint32(offset,value,true) : d.setUint16(offset,value,true); return a; }
function concat(parts) { const out = new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let i=0; for(const p of parts){out.set(p,i);i+=p.length;} return out; }
// Uncompressed ZIP/OOXML avoids runtime dependencies and preserves Korean text.
export function docx(paragraphs) {
  const files = {
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs.map(p=>'<w:p><w:r><w:t xml:space="preserve">'+xml(p)+'</w:t></w:r></w:p>').join('')+'<w:sectPr/></w:body></w:document>'
  };
  const local=[], central=[]; let offset=0;
  for(const [name,text] of Object.entries(files)) {
    const n=enc(name), b=enc(text), crc=crc32(b);
    const h=numbers(30,[[0,4,0x04034b50],[4,2,20],[14,4,crc],[18,4,b.length],[22,4,b.length],[26,2,n.length]]);
    const c=numbers(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[16,4,crc],[20,4,b.length],[24,4,b.length],[28,2,n.length],[42,4,offset]]);
    local.push(h,n,b); central.push(c,n); offset+=h.length+n.length+b.length;
  }
  const dir=concat(central), end=numbers(22,[[0,4,0x06054b50],[8,2,3],[10,2,3],[12,4,dir.length],[16,4,offset]]);
  return concat([...local,dir,end]);
}
export async function packageIncident(i, revision, approvalLine) {
  assertReady(i, 'safety');
  if (!approvalLine?.length || approvalLine.some(x=>!x.id || x.active !== true)) throw new Fault('approval_line_not_configured');
  const title = `[사고종결] ${i.siteName} · ${i.occurredAt.slice(0,10)} · ${i.id}`;
  const c=i.corrective;
  const paragraphs=[title,`사고번호: ${i.id}`,`발생일시: ${i.occurredAt}`,`사고내용: ${i.summary}`,`원인분석: ${c.rootCause}`,`재발방지계획: ${c.planDetail}`,`현장조치: ${c.actionDetail}`,`담당자: ${c.ownerName}`,`실제 완료일: ${c.completedAt}`,`최초보고 승인: ${i.approvedAt}`,`안전관리자 확인: ${c.reviewedAt}`];
  const attachments=[{name:`incident-${i.id}-r${revision}.docx`,mediaType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',base64:b64(docx(paragraphs))}];
  for(const f of [...(i.photos||[]),...(i.supplement?.attachments||[]),...c.afterPhotos]) {
    if (!f.base64 || !/\.(pdf|docx|xlsx|jpg|png|zip|rar|hwp|hwpx)$/i.test(f.name)) throw new Fault('evidence_unavailable');
    attachments.push({name:f.name,mediaType:f.mediaType,base64:f.base64});
  }
  for(const a of attachments) { const bytes=unb64(a.base64); if(!bytes.length || bytes.length>2*1024*1024) throw new Fault('attachment_size'); a.size=bytes.length; a.sha256=await sha256(bytes); }
  const payload={templateId:4,clientReference:`${i.id}:r${revision}`,title,body:paragraphs.join('\n'),approvalLine:structuredClone(approvalLine),attachments};
  return {...payload,snapshotHash:await sha256(JSON.stringify(canonical(payload)))};
}
// No result from a browser/UI label, user input, or absent status is trusted here.
export function applyProviderResult(incident, job, document) {
  if (!document || document.clientReference!==job.client_reference || document.id!==job.document_id || document.snapshotHash!==job.snapshot.snapshotHash) throw new Fault('provider_identity_mismatch');
  const i=structuredClone(incident);
  if (terminal(job.state)) return {incident:i,state:job.state,ignored:true};
  if (document.result==='approved') { i.status='closed'; i.closedAt=document.decidedAt; if(!i.closedAt) throw new Fault('decision_time_missing'); return {incident:i,state:'approved'}; }
  if (document.result==='rejected') { i.status='approved'; i.closedAt=null; i.corrective={...i.corrective,status:'rejected',reviewNote:document.reason||'ERP 반려: 보완 필요'}; return {incident:i,state:'rejected'}; }
  return {incident:i,state:document.result==='pending'?'pending':'status_unknown'};
}
export function enforceClosureWrite(previous, proposed, job) {
  if (job && !terminal(job.state)) throw new Fault('erp_decision_pending');
  if (proposed.status==='closed' && (previous.status!=='closed' || job?.state!=='approved')) throw new Fault('erp_approval_required');
  return proposed;
}
export function liveProvider() { throw new Fault('erp_integration_not_authorized',503); }
