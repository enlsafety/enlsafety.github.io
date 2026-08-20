/* v3 compatibility fixes */
function openEditIncidentModal(i,u){
  openModal(`<div class="modal-head"><h2>사고정보 수정</h2><button class="x" data-close>×</button></div>
    <form id="editIncidentForm">
      <div class="formgrid">
        <label class="lbl"><span>사업장</span><select id="eSite">${data.sites.map(s=>`<option value="${s.id}" ${s.id===i.siteId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="lbl"><span>사고 구분</span><select id="eCategory"><option value="person" ${i.category==='person'?'selected':''}>대인사고</option><option value="property" ${i.category==='property'?'selected':''}>대물사고</option><option value="near_miss" ${i.category==='near_miss'?'selected':''}>아차사고</option><option value="hazard" ${i.category==='hazard'?'selected':''}>위험요인</option></select></label>
        <label class="lbl"><span>사고 유형</span><select id="eType">${eventTypeOptions(i.eventType)}</select></label>
        <label class="lbl"><span>사고 정도</span><select id="eSeverity"><option value="minor" ${i.severity==='minor'?'selected':''}>경미</option><option value="moderate" ${i.severity==='moderate'?'selected':''}>보통</option><option value="major" ${i.severity==='major'?'selected':''}>중대</option></select></label>
        <label class="lbl"><span>치료/휴업 예상</span><select id="eLeave"><option value="unknown" ${i.leaveEstimate==='unknown'?'selected':''}>미확인</option><option value="none" ${i.leaveEstimate==='none'?'selected':''}>휴업 없음</option><option value="under3" ${i.leaveEstimate==='under3'?'selected':''}>3일 미만 예상</option><option value="3plus" ${i.leaveEstimate==='3plus'?'selected':''}>3일 이상 예상</option><option value="longterm" ${i.leaveEstimate==='longterm'?'selected':''}>장기치료/중상 가능</option></select></label>
        <label class="lbl"><span>사고자</span><input id="eInj" value="${esc(i.injuredName||'')}"></label>
      </div>
      <label class="lbl"><span>사고내용</span><textarea id="eSummary" rows="4">${esc(i.summary)}</textarea></label>
      <label class="lbl"><span>즉시조치</span><textarea id="eImmediate" rows="3">${esc(i.immediateAction)}</textarea></label>
      <label class="lbl"><span><input id="ePotential" type="checkbox" style="width:auto" ${i.potentialMajor?'checked':''}> 잠재 중대위험</span></label>
      <button class="primary full">수정 저장</button>
    </form>`);
  document.getElementById('editIncidentForm').onsubmit=e=>{
    e.preventDefault();
    i.siteId=document.getElementById('eSite').value;
    i.category=document.getElementById('eCategory').value;
    i.eventType=document.getElementById('eType').value;
    i.severity=document.getElementById('eSeverity').value;
    i.leaveEstimate=document.getElementById('eLeave').value;
    i.injuredName=i.category==='person'?document.getElementById('eInj').value.trim():'';
    i.summary=document.getElementById('eSummary').value.trim();
    i.immediateAction=document.getElementById('eImmediate').value.trim();
    i.potentialMajor=document.getElementById('ePotential').checked;
    i.priority=computePriority(i.category,i.severity,i.eventType,i.potentialMajor,i.leaveEstimate);
    i.legalReview=computeLegalReview(i.category,i.severity,i.leaveEstimate);
    i.updatedAt=nowISO();
    saveData();closeModal();renderShell(u);
  };
}
