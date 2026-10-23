/* A4 portrait incident report. Runs locally, including before final approval. */
(function () {
  'use strict';

  const VERSION = '4.7.1';
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ROW_HEIGHT = 17.5, COL_WIDTH = 7.5, FONT_SIZE = 10.5;
  const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\r\n?/g, '\n');
  const text = (value, fallback = '미확인') => clean(value).trim() || fallback;
  const join = parts => parts.filter(v => v !== null && v !== undefined && String(v).trim()).join('\n');
  const lookup = (value, labels, fallback = '미확인') => labels[value] || fallback;
  const dateText = value => {
    if (!value) return '미확인';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = koreanDate(value);
    return date ? date.toISOString().slice(0, 16).replace('T', ' ') : '미확인';
  };
  function koreanDate(value) {
    let source = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(source)) source += '+09:00';
    const date = new Date(source);
    return Number.isNaN(date.getTime()) ? null : new Date(date.getTime() + 9 * 3600000);
  }
  function siteName(i) {
    try { return text(window.siteById?.(i.siteId)?.name || window.ENL_SITE_DIRECTORY?.find(s => String(s.id) === String(i.siteId))?.name || i.siteId); }
    catch (_) { return text(i.siteId); }
  }
  function statusText(i) {
    if (i.historicalImport?.workflowExempt) return '과거자료 이관 (조치 완료 여부 별도 확인)';
    return lookup(i.status, {reported:'보고 접수', supplement:'보고 보완 요청', supplement_submitted:'보완자료 제출', approved:'사고보고 승인', closed:'사고 종결', rejected:'보고 반려', draft:'작성 중'});
  }
  function actionStatus(c) {
    return lookup(c.status, {approved:'조치 승인', submitted:'조치 검토 중', rejected:'조치 보완 요청', draft:'조치 작성 중', in_progress:'조치 진행 중', pending:'조치 대기', planned:'조치 예정'}, c.actionDetail ? '조치 상태 미확인' : '조치 미작성');
  }
  function reportFields(i) {
    const d = i.reportDetails || {}, c = i.corrective || {}, h = i.historicalImport || {};
    const person = i.category === 'person', files = [...(i.photos || []), ...(i.supplement?.attachments || []), ...(c.afterPhotos || [])];
    const causeState = lookup(d.causeAnalysisStatus, {investigating:'조사 중 (원인 미확정)', analyzed:'원인 검토 완료', not_reviewed:'원인 확인 전'}, '원인 확인 상태 미기록');
    const cost = person ? d.medicalCost : d.repairCost;
    const knownCost = cost !== null && cost !== undefined && cost !== '' && Number.isFinite(Number(cost)) && Number(cost) >= 0;
    const bulk = i.externalInitialApproval;
    return {
      type: person ? '사람이 다친 사고' : i.category === 'property' ? '물품·시설이 파손된 사고' : '사고',
      site: siteName(i),
      occurred: i.occurrenceTimeKnown === false || /^\d{4}-\d{2}-\d{2}$/.test(i.occurredAt || '')
        ? text(i.occurredDate || String(i.occurredAt || '').slice(0, 10)) + ' (시간 미확인)' : koreanDate(i.occurredAt),
      place: text(d.place),
      event: text(i.eventType),
      worker: join([person ? d.injuredName || i.injuredName : d.workerName, d.job || i.job]) || '미확인',
      cost: (person ? d.medicalCostPending : d.repairCostPending) ? '사후 보완 예정' : knownCost ? Number(cost) : '미확인',
      work: text(d.workAction),
      how: text(d.incidentHow || i.summary),
      damage: person ? join([text(d.injuryDetail), d.diagnosis && '진단: ' + d.diagnosis, d.doctorOpinion && '치료: ' + d.doctorOpinion,
        '휴업 예상: ' + lookup(i.leaveEstimate, {none:'휴업 없음', under3:'3일 미만', '3plus':'3일 이상', longterm:'장기치료 예상'})])
        : join([d.damagedItem && '파손 대상: ' + d.damagedItem, text(d.damageDetail)]),
      immediate: text(i.immediateAction, '조치 내용 미기재'),
      cause: join([causeState, d.environmentCause && '작업환경: ' + d.environmentCause, d.behaviorCause && '작업방법: ' + d.behaviorCause,
        d.causeAnalysisNote, c.rootCause && '추가 확인: ' + c.rootCause]),
      plan: text(c.planDetail || d.preventionPlan || h.additionalActionNote || h.existingActionNote, '예방계획 미기재'),
      action: join([actionStatus(c), c.actionDetail || (h.workflowExempt ? h.existingActionNote : ''),
        (c.actionCompletedDate || c.completedDate) && '완료일: ' + dateText(c.actionCompletedDate || c.completedDate), c.additionalNotes]),
      owner: text(c.actionOwner || c.ownerName || c.submittedBy, '미지정'),
      due: text(c.dueDate, '미지정'),
      review: join(['보고: ' + text(h.originalReporterName || i.reporterName),
        '사고보고 검토: ' + (h.workflowExempt ? '과거 ERP 자료 이관' : bulk ? (bulk.state === 'verified' ? '기존 ERP 결재 확인' : '기존 결재 미확인') : i.approvedAt ? text(i.approvedBy) + ' / ' + dateText(i.approvedAt) : '승인 전'),
        c.reviewedAt && '조치 검토: ' + text(c.reviewedBy) + ' / ' + dateText(c.reviewedAt), c.reviewNote,
        bulk && (bulk.state === 'verified' ? 'ERP 결재 확인: ' + text(bulk.documentNo) : '기존 결재 확인 불가: ' + text(bulk.reason))]),
      note: join([d.specialNote, person ? d.medicalCostDetail : d.repairCostDetail,
        i.potentialMajor && '큰 사고로 이어질 가능성 있음',
        i.officialRecord?.actionRecheckRequired && '정정에 따른 조치 재검토 필요',
        h.workflowExempt && '과거자료 이관종결은 재발방지조치 완료를 의미하지 않습니다.',
        files.length ? '첨부 ' + files.length + '건 (앱에서 원본 확인)' : '등록된 첨부 없음']),
      status: statusText(i),
      person
    };
  }

  // Measure actual Korean glyphs when available; the fallback is conservative for Node QA.
  let context;
  function measure(value) {
    if (context === undefined) {
      try { context = document.createElement('canvas').getContext('2d'); } catch (_) { context = null; }
      if (context) context.font = `${FONT_SIZE * 4 / 3}px "Malgun Gothic", sans-serif`;
    }
    return context ? context.measureText(value).width : Array.from(value).reduce((n, ch) => n + (/[^\x00-\x7f]/.test(ch) ? 14 : 8), 0);
  }
  function wrap(value, columns) {
    const capacity = columns * 57 - 18, lines = [];
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      for (const ch of paragraph) {
        if (line && measure(line + ch) > capacity) { lines.push(line); line = ''; }
        line += ch;
      }
      lines.push(line);
    }
    return lines;
  }
  function stylesXml() {
    const fonts = [
      [10.5, false, '172B3A'], [17, true, '173B66'], [10.5, true, 'FFFFFF'],
      [10.5, true, '24455C'], [9, false, '526575']
    ].map(([size, bold, color]) => `<font>${bold ? '<b/>' : ''}<sz val="${size}"/><color rgb="FF${color}"/><name val="Malgun Gothic"/><family val="2"/></font>`).join('');
    const xf = (font, fill, border, horizontal = 'left', numFmt = 0) => `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="${horizontal}" vertical="center" wrapText="1"${horizontal === 'left' ? ' indent="1"' : ''}/></xf>`;
    return XML + `<styleSheet xmlns="${NS}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="165" formatCode="#,##0&quot;원&quot;"/></numFmts><fonts count="5">${fonts}</fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF244F6E"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F4F7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${['left','right','top','bottom'].map(edge => `<${edge} style="thin"><color rgb="FFB8C6D0"/></${edge}>`).join('')}<diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">${xf(0,0,0)}${xf(1,0,0,'center')}${xf(2,2,0)}${xf(3,3,1,'center')}${xf(0,0,1)}${xf(4,0,0)}${xf(0,0,1,'center',164)}${xf(0,0,1,'right',165)}${xf(0,0,1,'center')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
  function sheetBuilder(escape) {
    const cells = new Map(), merges = [], heights = new Map(), overflow = [];
    const col = n => String.fromCharCode(64 + n);
    function put(c1, r1, c2, r2, value, style, label = '', limit = true) {
      let displayed = value;
      if (typeof value === 'string' && limit) {
        const lines = wrap(value, c2 - c1 + 1);
        const maxLines = Math.max(1, Math.floor(((r2 - r1 + 1) * ROW_HEIGHT - 6) / 14));
        if (lines.length > maxLines) {
          overflow.push({label, value});
          const marker = `… [전문 ${overflow.length}]`, kept = lines.slice(0, maxLines);
          let last = kept[maxLines - 1];
          while (last && measure(last + marker) > (c2 - c1 + 1) * 57 - 18) last = Array.from(last).slice(0, -1).join('');
          kept[maxLines - 1] = last + marker;
          displayed = kept.join('\n');
        } else displayed = lines.join('\n');
      }
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const key = col(c) + r, head = r === r1 && c === c1;
        let body = '';
        if (head && value instanceof Date) body = `<v>${(value.getTime() - Date.UTC(1899, 11, 30)) / 86400000}</v>`;
        else if (head && typeof value === 'number') body = `<v>${value}</v>`;
        else if (head) body = `<is><t xml:space="preserve">${escape(displayed)}</t></is>`;
        cells.set(key, `<c r="${key}" s="${style}"${head && !(value instanceof Date) && typeof value !== 'number' ? ' t="inlineStr"' : ''}>${body}</c>`);
      }
      if (c1 !== c2 || r1 !== r2) merges.push(`${col(c1)}${r1}:${col(c2)}${r2}`);
    }
    function xml(end, singlePage = true) {
      const rows = Array.from({length:end}, (_, n) => `<row r="${n+1}" ht="${heights.get(n+1) || ROW_HEIGHT}" customHeight="1">${Array.from({length:12}, (_, c) => cells.get(col(c+1)+(n+1)) || '').join('')}</row>`).join('');
      return XML + `<worksheet xmlns="${NS}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:L${end}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"/></sheetViews><sheetFormatPr defaultRowHeight="${ROW_HEIGHT}"/><cols><col min="1" max="12" width="${COL_WIDTH}" customWidth="1"/></cols><sheetData>${rows}</sheetData><mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1" verticalCentered="1" gridLines="0" headings="0"/><pageMargins left="0.47244" right="0.47244" top="0.47244" bottom="0.47244" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="${singlePage ? 1 : 0}"/><headerFooter><oddFooter>&amp;C&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
    }
    return {put, xml, heights, overflow};
  }
  function buildWorkbook(i) {
    if (!i?.id) throw new Error('사고자료를 찾지 못했습니다.');
    const codec = window.ENLIncidentXlsx;
    if (!codec) throw new Error('엑셀 출력 기능을 불러오지 못했습니다. 앱을 새로고침해 주세요.');
    const e = codec.xmlEsc, f = reportFields(i), main = sheetBuilder(e), {put} = main;
    const section = (r, title) => put(1,r,12,r,title,2,'',false);
    const field = (r1,r2,label,value) => { put(1,r1,2,r2,label,3,'',false); put(3,r1,12,r2,value,4,label); };
    const pair = (r1,r2,left,right) => [left,right].forEach(([label,value,style=4], n) => {
      const start = n * 6 + 1;
      put(start,r1,start+1,r2,label,3,'',false);
      put(start+2,r1,start+5,r2,value,style,label);
    });
    put(1,1,12,2,'사고보고서',1,'',false);
    put(1,3,12,3,`${f.type} · ${f.status} · 개정 ${Number(i.officialRecord?.revisionNumber || 0)}`,5,'보고 상태');
    [4,12,26,39].forEach(r => main.heights.set(r, ROW_HEIGHT / 2));
    section(5,'1. 사고 개요');
    pair(6,7,['사업장',f.site],['발생 일시',f.occurred || '미확인',f.occurred instanceof Date ? 6 : 4]);
    pair(8,9,['사고 장소',f.place],['사고 유형',f.event]);
    pair(10,11,[f.person ? '다친 사람' : '작업자',f.worker],[f.person ? '확인된 진료비' : '복구 예상비',f.cost,typeof f.cost === 'number' ? 7 : 4]);
    section(13,'2. 무엇이 일어났고, 어떻게 조치했나요?');
    field(14,15,'사고 전 작업',f.work);
    field(16,19,'사고 발생 경위',f.how);
    field(20,22,f.person ? '다친 내용' : '파손 내용',f.damage);
    field(23,25,'즉시 한 조치',f.immediate);
    section(27,'3. 왜 발생했고, 다시 막으려면 무엇을 하나요?');
    field(28,30,'확인된 원인',f.cause);
    field(31,33,'재발 방지 계획',f.plan);
    field(34,36,'실제 한 조치',f.action);
    pair(37,38,['조치 담당자',f.owner],['완료 목표일',f.due]);
    section(40,'4. 보고·검토 및 참고사항');
    field(41,42,'보고·검토',f.review);
    field(43,44,'참고사항',f.note);
    const footer = main.overflow.length ? '인쇄: 현재 시트 A4 세로 1장 · [전문 n]의 전체 내용은 ‘내용 전문’ 시트에 보존됩니다.' : '인쇄: 현재 시트 A4 세로 1장 · 미확인 항목은 확인 후 보완해 주세요.';
    put(1,45,12,45,footer,5,'',false);
    const sheets = [{name:'사고보고서', xml:main.xml(45), end:45}];
    if (main.overflow.length) {
      const full = sheetBuilder(e);
      full.put(1,1,12,2,'사고보고서 내용 전문',1,'',false);
      full.put(1,3,12,3,`사고번호: ${i.id}`,5,'',false);
      let r = 5;
      main.overflow.forEach(({label,value}, n) => {
        full.put(1,r,12,r,`전문 ${n+1}. ${label}`,2,'',false); r++;
        // Short separate rows avoid Excel's merged-cell auto-height and cell-length limits.
        for (const line of wrap(value,12)) { full.put(1,r,12,r,line,4,'',false); r++; }
        r++;
      });
      sheets.push({name:'내용 전문',xml:full.xml(r-1,false),end:r-1});
    }
    const files = [
      {name:'[Content_Types].xml',data:XML+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,n)=>`<Override PartName="/xl/worksheets/sheet${n+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`},
      {name:'_rels/.rels',data:XML+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
      {name:'xl/workbook.xml',data:XML+`<workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s,n)=>`<sheet name="${s.name}" sheetId="${n+1}" r:id="rId${n+1}"/>`).join('')}</sheets><definedNames>${sheets.map((s,n)=>`<definedName name="_xlnm.Print_Area" localSheetId="${n}">'${s.name}'!$A$1:$L$${s.end}</definedName>`).join('')}</definedNames><calcPr calcId="191029"/></workbook>`},
      {name:'xl/_rels/workbook.xml.rels',data:XML+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,n)=>`<Relationship Id="rId${n+1}" Type="${REL}/worksheet" Target="worksheets/sheet${n+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`},
      {name:'xl/styles.xml',data:stylesXml()},
      ...sheets.map((s,n)=>({name:`xl/worksheets/sheet${n+1}.xml`,data:s.xml}))
    ];
    return codec.zipStore(files);
  }
  function download(id, button) {
    if (button?.disabled) return;
    let url, anchor;
    try {
      const i = (typeof data !== 'undefined' ? data.incidents || [] : []).find(x => String(x.id) === String(id));
      const user = window.currentUser?.();
      if (!i || !user || !window.enlCanViewIncidentOriginal?.(i,user)) throw new Error('이 사고보고서를 열람할 권한이 없습니다.');
      if (button) { button.disabled = true; button.textContent = '엑셀 파일 생성 중…'; }
      const bytes = buildWorkbook(i);
      url = URL.createObjectURL(new Blob([bytes], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      anchor = document.createElement('a'); anchor.href = url;
      const safe = value => text(value,'미확인').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,48);
      anchor.download = `사고보고서_${safe(siteName(i))}_${safe(dateText(i.occurredDate || i.occurredAt).slice(0,10))}_${safe(i.id)}.xlsx`;
      anchor.style.display = 'none'; document.body.appendChild(anchor); anchor.click();
      const cleanupUrl = url, cleanupAnchor = anchor;
      setTimeout(() => { URL.revokeObjectURL(cleanupUrl); cleanupAnchor.remove(); },60000);
      url = null; anchor = null;
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      anchor?.remove();
      alert(error?.message || '엑셀 보고서를 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (button) { button.disabled = false; button.textContent = '엑셀 사고보고서 출력'; }
    }
  }
  window.enlBuildOnePageIncidentWorkbook = buildWorkbook;
  window.enlDownloadOnePageIncidentExcel = download;
  window.ENL_ONE_PAGE_EXCEL_VERSION = VERSION;
})();
