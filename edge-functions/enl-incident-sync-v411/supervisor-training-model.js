/* Appointment-based annual periods. Dates are civil dates in Asia/Seoul. */
(function(root){
  'use strict';
  const day=86400000;
  function validDate(value){
    if(typeof value!=='string'||!/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(value))return false;
    const d=new Date(value+'T00:00:00Z');
    return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;
  }
  const today=(now=new Date())=>new Date(+now+9*3600000).toISOString().slice(0,10);
  // Feb 29 renews on March 1 in non-leap years; the preceding period ends Feb 28.
  function anniversary(date,offset){const [y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y+offset,m-1,d)).toISOString().slice(0,10);}
  function period(date,index){
    if(!validDate(date)||!Number.isInteger(index)||index<0||index>300)return null;
    const start=anniversary(date,index),next=anniversary(date,index+1);
    return {index,start,end:new Date(Date.parse(next+'T00:00:00Z')-day).toISOString().slice(0,10),next};
  }
  function current(date,asOf=today()){
    if(!validDate(date)||!validDate(asOf))return null;
    let index=Math.max(0,Number(asOf.slice(0,4))-Number(date.slice(0,4)));
    if(index&&anniversary(date,index)>asOf)index--;
    return period(date,index);
  }
  function matches(record,appointment){return record.appointment?.date===appointment.date&&record.appointment?.name===appointment.name;}
  function summary(appointment,records,p,asOf=today()){
    const certificates=records.filter(r=>matches(r,appointment)&&r.completed_on>=p.start&&r.completed_on<=p.end&&r.completed_on<=asOf);
    const remaining=Math.round((Date.parse(p.end+'T00:00:00Z')-Date.parse(asOf+'T00:00:00Z'))/day);
    const state=certificates.length?'registered':asOf<p.start?'upcoming':remaining<0?'overdue':remaining<=30?'due':'pending';
    return {state,remaining,certificates,label:{registered:'수료증 등록',upcoming:'교육기간 시작 전',overdue:'기한 경과 / 수료증 미등록',due:'기한 임박 / 수료증 미등록',pending:'수료증 미등록'}[state]};
  }
  root.enlSupervisorTrainingModel={validDate,today,period,current,matches,summary};
})(globalThis);
