-- Change generated notification wording only, preserving recipient/turn logic and data.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.enl_incident_push_trigger()'::regprocedure) into definition;
  definition:=replace(definition,'[경영진 병렬결재 요청]','[경영진 결재 요청]');
  definition:=replace(definition,'병렬결재가 모두 완료되었습니다. 최종결재를 진행해 주세요.','경영진 결재가 모두 완료되었습니다. 최종결재를 진행해 주세요.');
  definition:=replace(definition,'순서 없이 병렬결재를 진행해 주세요.','사고보고서를 확인하고 결재해 주세요.');
  execute definition;
end;
$migration$;
