import {b64,docx} from './core.mjs';
export const MOCK_LINE=Object.freeze([{id:'qa-manager',active:true},{id:'qa-executive',active:true}]);
export const SCENARIOS=['normal','timeout_after_submit','transient_before_submit','attachment_failure'];
export function fixture(id, revision=1) {
  const at='2026-10-08T00:00:00.000Z';
  return {id,synthetic:true,siteId:'qa-site',siteName:'가상 시험사업장',status:'approved',approvedAt:at,occurredAt:at,summary:'시험용 적치물 전도 상황. 실제 사고가 아닙니다.',corrective:{status:'approved',reviewedAt:at,rootCause:'시험용 적치 구획 미표시',planDetail:'적치 구획 표시 및 작업 전 확인',actionDetail:`가상 구획 표시 및 점검 완료 (${revision}차)`,ownerName:'가상 담당자',completedAt:'2026-10-08',afterPhotos:[{name:`evidence-r${revision}.docx`,mediaType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',base64:b64(docx(['SYNTHETIC EVIDENCE ONLY',`가상 조치증빙 ${revision}차`]))}]}};
}
