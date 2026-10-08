/* ERP handoff v1: pure safety/eligibility and redacted summary rules. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ENLErpLinkModel = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var STATUSES = Object.freeze(['submitted', 'approved']);

  function text(value) { return String(value == null ? '' : value).trim(); }
  function role(value) { return text(value) === 'final' ? 'manager' : text(value); }
  function historical(incident) {
    if (!incident) return false;
    return text(incident.recordMode) === 'historical_transfer'
      || text(incident.historicalTransfer && incident.historicalTransfer.mode) === 'historical_transfer'
      || (incident.historicalImport && incident.historicalImport.enabled === true
          && incident.historicalImport.erpApproved === true);
  }
  function finalized(incident) {
    return !!incident && !historical(incident)
      && text(incident.status) === 'closed'
      && text(incident.corrective && incident.corrective.status) === 'approved';
  }
  function canUse(incident, user) {
    return !!user && role(user.role) === 'safety' && finalized(incident);
  }
  function documentNumber(value) {
    var s = text(value);
    if (!s || s.length > 80 || /[\x00-\x1f\x7f<>]/.test(s)) return null;
    return s;
  }
  function validStatus(value) { return STATUSES.includes(text(value)); }
  function summary(incident, siteLabel) {
    if (!incident || !finalized(incident)) return '';
    var location = text(siteLabel) || text(incident.siteId) || '-';
    var date = text(incident.occurredAt).slice(0, 10) || '-';
    // No injured name, diagnosis, contact, free-text cause, or medical information.
    return [
      '[이앤엘 사고보고 ERP 전달용 요약]',
      '사고관리번호: ' + text(incident.id),
      '사업장: ' + location,
      '발생일: ' + date,
      '구분: ' + (incident.category === 'person' ? '대인사고' : incident.category === 'property' ? '대물사고' : '기타 사고'),
      '사고보고앱 상태: 사고 및 재발방지조치 승인·종결',
      '상세 경위 및 첨부자료: 별도 승인된 사고보고서 파일 참조',
      '※ 개인정보가 포함된 첨부자료는 ERP에서 접근권한 확인 후 등록'
    ].join('\n');
  }
  return Object.freeze({ STATUSES: STATUSES, historical: historical, finalized: finalized,
    canUse: canUse, documentNumber: documentNumber, validStatus: validStatus, summary: summary });
});
