# 과거사고 후속 개선조치 · 4.4.27

## 원칙과 사용 위치
과거사고 상세의 `후속 개선조치 요구`로 현재 시점의 활동을 등록한다. 원 사고의 이관종결, 발생일, corrective, 공식기록은 쓰지 않는다. 한 사고에 여러 조치를 연결할 수 있다. 담당 사업장은 선택 가능하므로 계약종료 현장의 과거사고를 현재 담당 현장에 연결할 수도 있다.

`후속 개선조치` 메뉴에서 현장소장·파트장·서무는 자기 사업장만 조회/처리한다. 안전관리자는 생성/검토, 관리자·경영진은 읽기 전용이다. 미등록 비밀번호 증명이 필요한 세션은 기존 계정 비밀번호를 재확인한다. 사용자/계정 설정은 변경하지 않는다.

- 요구 → 현장조치 시작 → 작성 저장/결과 제출 → 보완/재제출 → 완료 승인.
- 필수 조치내용·실제 조치일·조치자·조치 후 이미지 검증. 요구일 이전 또는 미래 조치일은 차단한다.
- 완료 후 수정/재개 없음. 새로운 개선이 필요하면 같은 사고에 새 조치를 만든다.
- 기한 정상/D-3/오늘 마감/기한초과. 진행중·제출대기·완료는 별도 KPI이고 사고통계와 합산하지 않는다.

## 서버와 데이터
`enl-historical-followup`의 모든 작업은 서버에 저장된 HQ password hash / 현장 PIN hash로 검증한다. 이름·역할·사업장·직책은 서버 값으로 재확인한다. 새 테이블은 RLS ON, anon/authenticated/PUBLIC 권한 없음이며 기존 SQL 기반 Edge 인증 모델을 사용한다.

- `enl_historical_followups`: 독립 조치, incident FK RESTRICT, 상태/기한/버전 + JSON.
- `enl_historical_followup_audit`: 생성/시작/저장/제출/보완/완료의 사용자와 변경 전후 스냅샷. 기존 incident audit constraint 변경 없음.
- `enl_historical_followup_files`: 새 첨부 메타데이터. 기존 private bucket 안의 `historical-followups/` 경로를 사용한다.
- row/advisory lock + 낙관적 버전 + mutation UUID로 충돌과 중복 처리를 차단한다.
- 조치·감사·푸시/메일 outbox는 같은 트랜잭션에 기록한다. pg_net 푸시 dispatch 및 기존 email dispatch는 커밋 이후 전송한다.
- legacy attachment sign은 새 경로를 거부한다. 신규 endpoint는 조치 접근권한을 확인한 뒤 5분 signed URL을 발급한다.
- 첨부 선택 후 저장 취소 시 이미 업로드된 준비 파일은 사고 본문에 연결하지 않는다. 운영파일 자동 삭제는 하지 않는다.

## 알림
요구/보완/완료: 담당 사업장의 활성 현장소장·파트장·서무. 결과 제출: 활성 안전관리자. 지정 담당자를 표시하되 해당 현장 권한자도 공동 처리 가능하다. 기존 push/email ON/OFF를 존중하며 후속조치 긴급 중요도는 기존 긴급사고 강제 알림으로 변환하지 않는다.

이벤트: historical_followup_requested / historical_followup_submitted / historical_followup_revision / historical_followup_completed. 작성 저장과 조치 시작은 감사만 남긴다. 과거사고 이관등록은 종전 무알림을 유지한다.

이메일은 후속조치 요구사항과 기한을 별도 양식으로 표시하며 로그인 후 조치로 이동한다. 발송 시점에 수신자가 현장 이동/권한 변경된 경우 제외한다.

## QA와 배포
운영 DB 테스트 사고/후속조치/메일을 만들지 않는다. `tests/historical-followup-*`는 실제 Edge handler와 PGlite PostgreSQL, 차단된 네트워크의 Chromium/WebKit을 사용한다. 정상 사고/과거 이관/대시보드/모바일/PWA 기존 workflow도 유지한다.

적용 순서: QA → additive migration 1회 → attachment/push/email 필요한 함수 갱신 → 신규 endpoint → PR merge → Pages 확인. 롤백 필요 시 UI 브랜치를 되돌려 신규 진입을 중지하고 새 테이블/감사자료를 보존한다. 기존 사고 endpoint는 재배포하지 않는다.
