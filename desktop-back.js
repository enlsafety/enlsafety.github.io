// Keep keyboard navigation inside the signed-in app and separate from browser history.
(() => {
  'use strict';
  if (navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return;

  const trail = [];
  const edited = new WeakSet();
  const submitted = new WeakSet();
  document.addEventListener('submit', event => submitted.add(event.target), true);
  let owner = '';
  let interacted = false;
  let picker = null;
  let pickerOwner = null;
  const editControls = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="spinbutton"]';
  const attachmentControls = 'input[type="file"],.photo-box,.attach-card411,[data-rm],[data-attach-open],[data-wf440-file-rm],.wf440-filebox';

  function rememberView() {
    const user = currentUser();
    const key = user ? JSON.stringify([user.id || user.personnelId, user.role, user.siteId]) : '';
    if (key !== owner || !document.getElementById('view')) {
      trail.length = 0;
      picker = pickerOwner = null;
      owner = key;
      interacted = false;
    }
    if (key && document.getElementById('view') && currentView && trail.at(-1) !== currentView) {
      if (!interacted) trail.length = 0;
      trail.push(currentView);
      if (trail.length > 40) trail.shift();
    }
  }
  // Read the final route after role-specific renderers finish.
  const render = window.renderShell;
  window.renderShell = function (...args) {
    const result = render.apply(this, args);
    rememberView();
    return result;
  };
  rememberView();

  function activeEditor() {
    return document.querySelector('#modalRoot .modal') || document.querySelector('#view form');
  }
  document.addEventListener('click', event => {
    rememberView();
    if (event.isTrusted) interacted = true;
    const target = event.target;
    if (target.matches?.('input[type="file"]')) {
      picker = target;
      pickerOwner = target.closest('form,.modal') || activeEditor();
    }
    if (target.closest?.('[data-rm],.attach-remove411,[data-wf440-file-rm]')) {
      const editor = target.closest('form,.modal');
      if (editor) edited.add(editor);
    }
    requestAnimationFrame(rememberView);
  }, true);
  function changed(event) {
    const el = event.target;
    if (el.matches?.('input[type="file"]')) {
      const editor = pickerOwner || el.closest('form,.modal') || activeEditor();
      if (editor && el.files?.length) edited.add(editor);
      picker = pickerOwner = null;
    } else if (el.matches?.(editControls) || el.isContentEditable) {
      if (el.closest('form,.modal,[contenteditable]') || el.closest('#view') && !el.matches('input[type="search"],select')) edited.add(el);
    }
  }
  document.addEventListener('change', changed, true);
  document.addEventListener('input', changed, true);
  document.addEventListener('cancel', event => {
    if (event.target === picker) picker = pickerOwner = null;
  }, true);
  document.addEventListener('pointerdown', () => { picker = pickerOwner = null; }, true);

  function backAction(user, modal) {
    if (modal) {
      const button = modal.querySelector('[data-close]:not(:disabled)');
      return button && (() => button.click());
    }
    const withinView = document.getElementById('view');
    const localBack = withinView.querySelector('[data-cancel-edit],[data-change-type],[data-inquiry-back],[data-list-origin]');
    if (localBack) return localBack.disabled ? null : () => {
      if (!localBack.matches('[data-change-type]')) trail.pop();
      localBack.click();
      rememberView();
    };
    if (trail.length < 2) {
      const fallback = withinView.querySelector('[data-field-back],[data-report-home],#backSafetyHome411');
      return fallback && (() => fallback.click());
    }
    return () => {
      trail.pop();
      currentView = trail.at(-1);
      if (currentView === 'personnel') window.enlRenderPersonnelPage(user);
      else window.renderShell(user);
    };
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Backspace' || event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const user = currentUser();
    if (!user || !document.getElementById('view')) return;
    const path = event.composedPath();
    const on = selector => path.some(el => el.matches?.(selector)) || document.activeElement?.closest(selector);
    if (!picker && !on('input[type="file"]') && (on(editControls) || document.activeElement?.isContentEditable)) return;
    event.preventDefault();
    if (event.repeat || picker || on(attachmentControls) || document.querySelector('[aria-busy="true"]')) return;
    const modal = document.querySelector('#modalRoot .modal');
    if ([...document.querySelectorAll('[aria-modal="true"],[role="dialog"],dialog[open],#enl418Overlay')].some(
      el => el.getClientRects().length && el !== modal && !el.contains(modal))) return;
    rememberView();
    const goBack = backAction(user, modal);
    if (!goBack) return;
    const scope = modal || document.getElementById('view');
    if ([...scope.querySelectorAll('form')].some(form => submitted.has(form) && form.querySelector('button:disabled')) || window.enlIncidentSaveInProgress?.()) {
      alert('저장 중입니다. 저장이 끝나면 다시 눌러 주세요.');
      return;
    }
    const unsaved = edited.has(scope) || [...scope.querySelectorAll('form,' + editControls)].some(el => edited.has(el)) ||
      scope.querySelector('[data-wf440-dirty="1"]') || window.enlIncidentHasUnsavedChanges?.();
    if (unsaved && !confirm('저장되지 않은 내용이 있을 수 있습니다. 이전 화면으로 이동할까요?\n계속 작성하려면 취소를 누르세요.')) return;
    goBack();
  });
})();
