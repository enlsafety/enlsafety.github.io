import {halfYear,reviewState} from './organization.ts';

const cardText=(v:any)=>String(v??'').trim();
export const linkedCardKeys=['D6','J6','N6','D7','N7','D8','J8','P8','C9','E9','K9','O9','D10','H10','D14','F14','H14','D15','F15','H15','D16','F16','H16','D22','H22','D23','D24','F24','D25','D26','D27','L13','P13','L14','P14','J16','L16','M16','P16','J17','L17','M17','P17','J18','L18','M18','P18',...Array.from({length:8},(_,i)=>'P'+(23+i))];
function cardDate(value:any){
 const s=cardText(value);if(!s)return '';
 const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T00:00:00Z':s);
 if(!Number.isFinite(+date))return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return date.toISOString().slice(0,10)===s?s:'';
 return new Date(+date+9*3600000).toISOString().slice(0,10);
}
export function safetyCardLinks(snapshot:any,role:string,at=new Date()){
 const s=snapshot.site,profile=s.safety_card_profile||{},org=snapshot.org,period=halfYear(at);
 const values:any={},sources:any={};
 function set(key:string,value:any,source:string){values[key]=cardText(value)||'미등록';sources[key]=source;}
 const master:any={D6:'site_name',J6:'region',D7:'address',N7:'start_date',P8:'site_type',C9:'regular_count',E9:'daily_count',K9:'course_holes',O9:'headcount_basis',D14:'manager_name',F14:'manager_phone',D15:'part_name',F15:'part_phone',D16:'clerk_name',F16:'clerk_phone',D22:'safety_outsource_status',H22:'inspection_cycle',D23:'safety_agency',D24:'agency_manager',F24:'agency_phone',D25:'contract_period',D26:'agency_scope',D27:'agency_note'};
 for(const [key,name] of Object.entries(master))set(key,s[name as string],'시스템관리 > 사업장 정보 수정');
 for(const [key,name] of Object.entries({N6:'corporation',D8:'business_number',J8:'insurance_number',D10:'confirmed_on',H10:'original_check'}))set(key,profile[name],'시스템관리 > 사업장 정보 수정');
 for(const key of ['C9','E9'])if(values[key]==='미등록')values[key]='미확인';
 const orgState=reviewState(org,period,snapshot.orgTip);
 const orgLabel:any={approved:'승인완료',pending:'검토대기',draft:'최신화 필요',empty:'승인자료 없음'};
 set('H14',org?.chart?.lead?'조직도 책임자: '+org.chart.lead:'현장소장','사업장 연락망 / 안전보건조직');
 set('H15',org?.chart?.supervisor?'조직도 관리감독자: '+org.chart.supervisor:'파트장(반장)','사업장 연락망 / 안전보건조직');
 set('H16','서무','시스템관리 > 사업장 정보 수정');
 set('P32',orgLabel[orgState],'안전보건조직 '+period+' / 최신 조직도 승인상태');
 const today=new Date(+at+9*3600000).toISOString().slice(0,10);
 const from=(years:number)=>{const y=Number(today.slice(0,4))-years,m=Number(today.slice(5,7)),d=Math.min(Number(today.slice(8)),new Date(Date.UTC(y,m,0)).getUTCDate());return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;};
 const rows=(snapshot.incidents||[]).filter((i:any)=>!i.bulkInvalidation?.active&&['reported','supplement','supplement_submitted','approved','closed'].includes(i.status)).map((i:any)=>({...i,date:cardDate(i.occurredAt||i.occurredDate)})).filter((i:any)=>i.date&&i.date<=today).sort((a:any,b:any)=>b.date.localeCompare(a.date)||cardText(b.id).localeCompare(cardText(a.id)));
 const incidentSource=`사고보고 / ${from(1)} ~ ${today} (최근 1년), ${from(3)} ~ ${today} (최근 3년)`;
 set('L13',role==='worker'?'미확인':rows.filter((i:any)=>i.date>=from(1)).length,incidentSource);
 set('P13',role==='worker'?'미확인':rows.filter((i:any)=>i.date>=from(3)).length,incidentSource);
 set('L14',role==='worker'?'조회 제한':rows[0]?.date||'등록 이력 없음',incidentSource);
 set('P14',role==='worker'?'조회 제한':'연동완료',incidentSource);
 for(let n=0;n<3;n++){
  const i=role==='worker'?null:rows[n],r=16+n;
  const prevention=i?.status==='closed'?'종결':i?.corrective?.status==='approved'?'재발방지 승인':i?.corrective?.status==='submitted'?'재발방지 검토 중':i?.corrective?'재발방지 작성 중':'미등록';
  for(const [col,value] of Object.entries({J:i?.date||'',L:i?({person:'대인',property:'대물'}[i.category]||'기타'):'',M:i?(i.summary||i.reportDetails?.incidentHow||i.eventType||'내용 미등록'):'',P:i?prevention:''})){values[col+r]=cardText(value).slice(0,1000);sources[col+r]=incidentSource;}
 }
 const risk=snapshot.risk||[],latestYear=String(Number(today.slice(0,4)));
 const groups=['initial','regular'].map(kind=>risk.filter((r:any)=>r.kind===kind&&(kind==='initial'||r.period===latestYear)));
 const riskStatus=!risk.length?'승인자료 없음':groups.every(g=>g.length&&g.every((r:any)=>r.state==='completed'))?'작성완료 / 승인 전':'작성 중 / 승인 전';
 for(let r=23;r<=30;r++)set('P'+r,r===23?riskStatus:'승인자료 없음',r===23?'위험성평가 / 최초 및 올해 정기평가. 작성 완료는 안전관리자 승인이 아닙니다.':'안전보건서류관리 / 연결 가능한 안전관리자 승인 기록 없음');
 return {values,sources,labels:{J19:'사고보고에 등록된 최근 1년 / 3년 건수와 최신 3건 자동 반영',J33:'관리상태는 실제 승인 기록 기준. 작성 완료와 승인 완료를 구분합니다.'},calculated:{N31:orgState==='approved'?'조직도 승인 / 나머지 확인 필요':'승인 확인 필요'},checkedAt:at.toISOString(),organization:{period,state:orgState},incidentCount:role==='worker'?null:rows.length};
}
export async function loadSafetyCardLinks(sql:any,siteId:string,role:string){
 const [snapshot]=await sql`select to_jsonb(s) as site,
  (select to_jsonb(c)-'print_jpeg' from private.enl_org_charts c join private.enl_org_folders f using(site_id) where c.site_id=s.site_id and c.deleted_at is null and not f.deleted order by c.revision desc limit 1) as org,
  (select max(revision) from private.enl_org_charts where site_id=s.site_id) as "orgTip",
  (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select distinct on(r.kind,r.period,r.template_id) r.kind,r.period,r.template_id,r.state from private.enl_risk_records r join private.enl_risk_folders f using(site_id) where r.site_id=s.site_id and not f.deleted and (r.kind='initial' or r.period=to_char(now() at time zone 'Asia/Seoul','YYYY')) order by r.kind,r.period,r.template_id,r.revision desc) r) as risk,
  (select coalesce(jsonb_agg(payload),'[]') from public.enl_incident_active where site_id=s.site_id and ${role!=='worker'}) as incidents
  from public.enl_site_master s where s.site_id=${siteId}`;
 return safetyCardLinks(snapshot,role);
}
