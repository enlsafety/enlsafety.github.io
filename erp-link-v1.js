/* ERP document handoff v1: manual export + auditable ERP reference, safety role only. */
(function () {
  'use strict';
  var MODEL = window.ENLErpLinkModel;
  if (!MODEL || typeof document === 'undefined') return;
  var API = 'https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-erp-link-v1';
  var ERP = 'https://erp.enlife.co.kr/';
  var activeId = '';
  var queued = false;

  function user() { try { return typeof currentUser === 'function' ? currentUser() : null; } catch (_) { return null; } }
  function incident(id) {
    try { return ((typeof data !== 'undefined' && data.incidents) || []).find(function (i) { return String(i.id) === String(id); }) || null; }
    catch (_) { return null; }
  }
  function locationName(id) {
    try { return (typeof siteById === 'function' && siteById(id)?.name)
      || window.ENL_SITE_DIRECTORY?.find(function (s) { return String(s.id) === String(id); })?.name
      || String(id || '-'); } catch (_) { return String(id || '-'); }
  }
  function passwordProof(u) {
    var proof = String(u?.passwordHash || '').trim();
    try {
      var s = typeof session !== 'undefined' ? (session?.manager || session?.worker) : null;
      if (!proof && s && String(s.id || s.personnelId || '') === String(u?.id || u?.personnelId || '')) {
        proof = String(s.passwordHash || '').trim();
      }
      if (!proof && typeof data !== 'undefined' && Array.isArray(data.users)) {
        var found = data.users.find(function (x) { return String(x.id) === String(u?.id); });
        proof = String(found?.passwordHash || '').trim();
      }
    } catch (_) {}
    return proof;
  }
  async function request(action, id, fields) {
    var u = user();
    if (!MODEL.canUse(incident(id), u)) throw new Error('forbidden');
    var hash = passwordProof(u);
    if (!hash) throw new Error('auth_proof_required');
    var payload = Object.assign({
      action: action,
      incidentId: String(id),
      actor: { id: u.id || u.personnelId || u.username, role: 'safety' },
      actorPasswordHash: hash
    }, fields || {});
    var timeout = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = timeout ? setTimeout(function () { timeout.abort(); }, 13000) : null;
    try {
      var response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ENL-App': 'incident-report-v2' },
        body: JSON.stringify(payload),
        signal: timeout?.signal,
        cache: 'no-store'
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok || result.ok !== true) throw new Error(result.message || 'erp_api_unavailable');
      return result;
    } finally { if (timer) clearTimeout(timer); }
  }
  function errorLabel(err) {
    var code = String(err?.message || '');
    return ({
      forbidden: '안전관리자 권한이 필요합니다.',
      auth_proof_required: '인증정보가 없습니다. 다시 로그인한 후 시도해 주세요.',
      not_finalized: '서버의 최신 사고 상태가 종결·조치승인 상태가 아닙니다.',
      not_found: '서버에서 이 사고를 찾지 못했습니다.',
      version_conflict: '다른 사용자가 먼저 수정했습니다. 다시 조회한 후 저장해 주세요.',
      invalid_fields: '문서번호 또는 확인 상태를 다시 확인해 주세요.',
      server_error: '연계 서버 오류입니다. 이후 다시 시도해 주세요.',
      erp_api_unavailable: '연계 서버에 연결하지 못했습니다. 관리자에게 확인해 주세요.'
    })[code] || '연계 기록을 처리하지 못했습니다. 연결상태를 확인해 주세요.';
  }
  function css() {
    if (document.getElementById('enlErpLinkCss')) return;
    var style = document.createElement('style');
    style.id = 'enlErpLinkCss';
    style.textContent = [
      '.enl-erp-panel{margin:14px 0;border:1px solid #bcd9ee;border-radius:14px;background:#f7fbfe;padding:16px;box-sizing:border-box;color:#213f59}',
      '.enl-erp-panel h3{font-size:16px;line-height:1.4;margin:0 0 8px;color:#185687}',
      '.enl-erp-panel p,.enl-erp-panel small{font-size:12px;line-height:1.6;color:#4d6980}',
      '.enl-erp-panel .enl-erp-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}',
      '.enl-erp-panel .enl-erp-btn{display:flex;align-items:center;justify-content:center;min-height:44px;text-align:center;border:1px solid #8ebad9;border-radius:9px;background:#fff;color:#195481;font-weight:800;font-size:13px;text-decoration:none;cursor:pointer;padding:8px}',
      '.enl-erp-panel .enl-erp-btn.primary{background:#1c6095;color:#fff;border-color:#1c6095}',
      '.enl-erp-panel button:disabled{opacity:.55;cursor:default}',
      '.enl-erp-panel .enl-erp-form{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:10px}',
      '.enl-erp-panel label{display:grid;gap:5px;min-width:0;font-weight:800;color:#35556c;font-size:12px}',
      '.enl-erp-panel input,.enl-erp-panel select{min-height:44px;border:1px solid #b7ccd9;border-radius:8px;background:#fff;color:#142f48;padding:9px 10px;font-size:15px;width:100%;min-width:0;box-sizing:border-box}',
      '.enl-erp-panel .enl-erp-footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}',
      '.enl-erp-panel .enl-erp-status{border-radius:9px;padding:10px 12px;margin:10px 0 0;font-size:12px;line-height:1.5;background:#eaf3fb;color:#23567c}',
      '.enl-erp-panel .enl-erp-status.error{background:#fff0ee;color:#9b3531}',
      '.enl-erp-panel .enl-erp-status.good{background:#e8f5ef;color:#21664b}',
      '@media(max-width:550px){.enl-erp-panel{padding:12px;margin:12px 0}.enl-erp-panel .enl-erp-steps{grid-template-columns:1fr}.enl-erp-panel .enl-erp-form{grid-template-columns:1fr}.enl-erp-panel .enl-erp-footer .enl-erp-btn{flex:1 1 120px}}'
    ].join('');
    document.head.appendChild(style);
  }
  function createPanel(modal, id) {
    var i = incident(id), u = user();
    if (!MODEL.canUse(i, u)) return;
    css();
    var box = document.createElement('section');
    box.className = 'enl-erp-panel';
    box.dataset.enlErpIncident = String(id);
    box.setAttribute('aria-label', 'ERP 문서 연계');
    box.innerHTML =
      '<h3>ERP 전달 및 문서번호 관리</h3>' +
      '<p>사고보고앱의 종결 기록은 그대로 유지됩니다. ERP 자동전송·자동결재가 아니라, 사람이 ERP에서 문서를 등록한 뒤 문서번호를 수기로 기록하는 단계입니다.</p>' +
      '<div class="enl-erp-steps">' +
        '<button type="button" class="enl-erp-btn" data-erp-export>① 승인 보고서 받기</button>' +
        '<button type="button" class="enl-erp-btn" data-erp-copy>② 기본 요약 복사</button>' +
        '<a class="enl-erp-btn" href="https://erp.enlife.co.kr/" target="_blank" rel="noopener noreferrer">③ ERP 열기 ↗</a>' +
      '</div>' +
      '<p>보고서 Excel에 개인정보·진료정보·사진이 포함될 수 있어. 회사에서 승인된 ERP 결재 권한 및 보안절차를 확인한 후 첨부해 주세요.</p>' +
      '<div class="enl-erp-form">' +
        '<label>ERP 문서번호<input data-erp-number type="text" maxlength="80" autocomplete="off" placeholder="ERP에서 실제 발급된 번호"></label>' +
        '<label>ERP 확인 상태<select data-erp-state><option value="submitted">ERP 기안·접수 확인(수기)</option><option value="approved">ERP 결재완료 확인(수기)</option></select></label>' +
      '</div>' +
      '<div class="enl-erp-footer">' +
        '<button type="button" class="enl-erp-btn" data-erp-load>연계 기록 조회</button>' +
        '<button type="button" class="enl-erp-btn primary" data-erp-save disabled>확인한 내용 저장</button>' +
      '</div>' +
      '<div class="enl-erp-status" role="status" aria-live="polite" data-erp-status>조회 버튼을 눌러 기존 ERP 연계기록을 확인해 주세요. 조회 전에는 저장할 수 없습니다.</div>' +
      '<small>※ ERP 상태는 입력자가 실제 ERP 화면에서 확인했다는 수기 기록이며, ERP 서버의 실시간 상태 검증 결과가 아닙니다.</small>';
    var actions = modal.querySelector('.modal-actions');
    if (actions) actions.parentNode.insertBefore(box, actions);
    else modal.appendChild(box);
    var state = { revision: null, busy: false };
    var number = box.querySelector('[data-erp-number]');
    var status = box.querySelector('[data-erp-state]');
    var save = box.querySelector('[data-erp-save]');
    var load = box.querySelector('[data-erp-load]');
    var feedback = box.querySelector('[data-erp-status]');
    function message(msg, tone) {
      feedback.textContent = msg;
      feedback.className = 'enl-erp-status' + (tone ? ' ' + tone : '');
    }
    function busy(flag) {
      state.busy = flag;
      save.disabled = flag || state.revision === null;
      load.disabled = flag;
    }
    box.querySelector('[data-erp-export]').addEventListener('click', async function () {
      if (!MODEL.canUse(incident(id), user())) return message('사고 상태나 권한이 변경되었습니다. 다시 로그인해 주세요.', 'error');
      if (typeof window.enlDownloadFinalIncidentExcel !== 'function') return message('기존 사고보고서 내보내기 기능을 찾을 수 없습니다.', 'error');
      try { await window.enlDownloadFinalIncidentExcel(id); }
      catch (_) { message('보고서 생성 오류입니다. 기존 Excel 내보내기 화면을 확인해 주세요.', 'error'); }
    });
    box.querySelector('[data-erp-copy]').addEventListener('click', async function () {
      var current = incident(id);
      if (!MODEL.canUse(current, user())) return message('사고 상태나 권한이 변경되었습니다.', 'error');
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard');
        await navigator.clipboard.writeText(MODEL.summary(current, locationName(current.siteId)));
        message('개인정보를 제외한 기본 요약을 복사했어. ERP 기안의 본문에 붙여넣으면 돼.', 'good');
      } catch (_) { message('복사 권한이 없습니다. HTTPS 페이지에서 클립보드 권한을 확인해 주세요.', 'error'); }
    });
    load.addEventListener('click', async function () {
      state.revision = null;
      busy(true);
      message('ERP 연계기록을 조회하고 있습니다.');
      try {
        var response = await request('get', id);
        if (!box.isConnected) return;
        var entry = response.record;
        number.value = entry ? String(entry.erpDocumentNo || '') : '';
        status.value = entry?.erpStatus === 'approved' ? 'approved' : 'submitted';
        state.revision = entry ? Number(entry.revision) : 0;
        message(entry
          ? '저장된 ERP 문서번호·상태를 불러왔습니다. 최종 수정 기록: ' + (entry.updatedAt || '-') + ' (수기 확인)'
          : '아직 ERP 연계 기록이 없습니다. ERP에서 실제 기안·접수 후 문서번호를 입력해 주세요.', 'good');
      } catch (err) {
        state.revision = null;
        message(errorLabel(err), 'error');
      } finally { if (box.isConnected) busy(false); }
    });
    save.addEventListener('click', async function () {
      if (state.busy || state.revision === null) return;
      var doc = MODEL.documentNumber(number.value);
      var value = status.value;
      if (!doc || !MODEL.validStatus(value)) return message('유효한 ERP 문서번호와 상태를 입력해 주세요.', 'error');
      if (!confirm('ERP에서 문서번호 및 해당 상태를 실제로 확인했나요? 이 내용은 수기 확인 이력으로 남습니다.')) return;
      busy(true);
      message('ERP 연계 기록을 저장하고 있습니다.');
      try {
        var response = await request('save', id, {
          erpDocumentNo: doc, erpStatus: value, expectedRevision: state.revision
        });
        if (!box.isConnected) return;
        state.revision = Number(response.record.revision);
        number.value = response.record.erpDocumentNo;
        status.value = response.record.erpStatus;
        message('ERP 연계 수기 기록 저장 완료 · 수정 이력 ' + state.revision + '회', 'good');
      } catch (err) {
        if (String(err?.message) === 'version_conflict') state.revision = null;
        message(errorLabel(err), 'error');
      } finally { if (box.isConnected) busy(false); }
    });
  }
  function mount() {
    var modal = document.querySelector('#modalRoot .modal');
    if (!modal || !modal.querySelector('.inc411-section')) return;
    var candidate = modal.dataset.wf440Incident || activeId;
    if (!candidate) return;
    var current = incident(candidate);
    if (!MODEL.canUse(current, user())) return;
    if (modal.querySelector('[data-enl-erp-incident]')) return;
    createPanel(modal, candidate);
  }
  function queue() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; try { mount(); } catch (err) { console.warn('[erp-link] view skipped', err); } }, 0);
  }
  function wrap(name) {
    var original = window[name];
    if (typeof original !== 'function' || original.__enlErpWrapped) return;
    var wrapped = function (id) {
      if (id) activeId = String(id);
      var result = original.apply(this, arguments);
      queue();
      return result;
    };
    wrapped.__enlErpWrapped = true;
    window[name] = wrapped;
    if (name === 'openIncidentModal' && typeof openIncidentModal === 'function') {
      try { openIncidentModal = wrapped; } catch (_) {}
    }
  }
  wrap('openIncidentModal');
  wrap('enlOpenIncidentReview');
  document.addEventListener('click', function (ev) {
    var button = ev.target?.closest?.('[data-inc-id],[data-reader-open],[data-safety-inc],[data-manager-inc],[data-lifecycle-open]');
    if (!button) return;
    var id = button.dataset.incId || button.dataset.readerOpen || button.dataset.safetyInc
      || button.dataset.managerInc || button.dataset.lifecycleOpen;
    if (id) { activeId = String(id); queue(); }
  }, true);
  var root = document.getElementById('modalRoot');
  if (root && typeof MutationObserver !== 'undefined') new MutationObserver(queue).observe(root, { childList: true, subtree: true });
  window.ENL_ERP_LINK_VERSION = 'v1-manual-audited';
})();
