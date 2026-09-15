# AI 안전관리본부 상황실 — Staging 안정화

2026-09-15 / 앱·API `4.4.0-control-room3` / staging Edge v12 ACTIVE.
브랜치 `feature/ai-safety-team-mvp`, Supabase `zgwxzfvvpqgdedyobwmg`만 수정했다. main·운영 DB는 수정하지 않았다.

## 구현

- 3초 polling은 조회만 한다. queued 업무가 있어도 DB write/RPC/AI 호출을 하지 않는다.
- 접수·명시적 재시도·단계 완료 때만 서명된 worker를 호출한다. 단계별 lease 120초, 모델 호출 총 90초, 동시 업무 최대 4건.
- 동일 request ID와 동일 요청자의 진행 중 동일 입력은 중복 생성하지 않는다. 버튼 잠금, 불명확한 접수 실패 시 request ID 재사용.
- 일시적 HTTP 429/5xx만 최대 2회 추가 재시도한다. 지수형 대기·Retry-After·총 90초 예산을 적용한다. 전송/timeout 오류는 이미 수락됐을 가능성이 있어 자동 재전송하지 않는다.
- 명시적인 quota/credit·인증·권한·모델 오류는 자동 재시도하지 않는다. type/code/message, 허용된 rate-limit 헤더, request ID, 시도 횟수를 비밀값 제거 후 저장한다. 화면에는 한국어 안내를 제공한다.
- 실패와 진단정보는 원자적으로 저장하며 retry_not_before를 서버에서 강제한다.
- 매분 DB cron은 만료 lease/2분 이상 인계 대기를 실패로 정리한다. 네트워크나 AI를 호출하지 않는다. 명시적 재시도는 새 업무를 만들고 이전 기록을 보존한다.
- 일반 안전관리 질의 입력과 완료 업무 재검토를 지원한다. 질의는 최소화된 기존 입력, 사고는 최신 staging 사고와 검토 의견을 사용한다.
- 필요한 DOM만 갱신해 카드 identity, 스크롤 기준 이벤트, 상세 메모/포커스를 보존한다. 모바일 safe-area, visible viewport, 주요 버튼 44px을 적용한다.

4개 에이전트는 순차 실행한다. 필요한 단계가 실패하면 해당 업무를 실패 처리하고 이전 완료 결과를 보존한다. 다른 업무와 상황실 조회는 계속된다. 임의 모델 교체·결제·한도 증액은 하지 않았다.

## 검증 범위

- Edge 단위 검사: 개인정보 최소화, 도구의 실제 공식 URL 대조, 위조 서명 거부, usage 추출.
- 모의 HTTP 검사: 일시적 429, quota, 인증/권한/모델, Retry-After 초/날짜, 3회 상한, 90초 예산, 전송 오류 중복 방지.
- queued fixture가 있는 인증 조회 18회: write/RPC/dispatch/AI 호출 모두 0회.
- 실제 staging DB rollback fixture: 4단계/3인계, 접수/claim 중복 방지, lease 만료, 보류/승인, 완료 후 재검토, retry cooldown, 오류 metadata, 질의 source 보존. cron 실제 실행 succeeded 확인.
- UI: Chromium 1440/390, WebKit 390/320. 모의 API이며 실제 AI 검증과 구분한다.
- Safari lifecycle: WebKit standalone 플래그 모사, 세로/가로/키보드 높이, DOM/스크롤/포커스, reload, visibility 복귀, API 연결 끊김/복구.
- 기존 앱: 모든 원격 요청을 가로챈 전체 스크립트의 로그인 화면·메뉴·사고 입력 화면. 실제 사고 저장 DB 검사는 아님.
- CI: Deno typecheck, 위 자동 검사, staging 미리보기 build, 스크린샷 artifact. 최종 실행 결과는 해당 commit의 Actions를 확인한다.

## 실제 AI와 외부 제한

이전 v1 실제 합성 사고 3건과 재시도 1건은 첫 에이전트에서 HTTP 429로 실패했다. 당시 저장된 오류에는 type/code/message/headers가 없어 quota와 RPM/TPM을 구분할 수 없다.
이번 실제 API 진단 명령은 네트워크 EACCES 후 권한 확대 자동 거부(`sandbox_approval: false`)로 실행되지 않았다. **429 원인 미확정**, 모델/프로젝트 접근권한 미확인, 실제 A/B/C/D 성공 E2E 미실행이다. 배포 후 실제 HTTP smoke도 미실행이다. quota 부족이라고 추정하지 않는다.

네트워크 실행이 허용된 환경에서 승인된 임시 staging 안전관리자 계정 파일 `{id, credential}`을 저장소 밖에 준비하고 `ENL_QA_CREDENTIAL_FILE`에 경로를 지정한다. `node ai/qa/live-matrix.mjs`가 모델 접근 진단 후 일반/법령/정보부족/복합 질의, 중복 접수, 보류/승인, 완료 후 재검토를 실제 API로 검사한다. 실패하면 진단정보를 남기고 중단하며 mock으로 대체하지 않는다. 검사 후 임시 계정을 비활성화·인증값 교체한다. 이번 임시 계정은 비활성화·교체했고 로컬 인증 파일도 삭제했다.

로컬 검증: `node ai/qa/edge-unit.mjs`, `node ai/qa/retry-unit.mjs`, `node ai/qa/read-only-poll.mjs`, `node ai/qa/browser.mjs`, `QA_LIFECYCLE=1 node ai/qa/browser.mjs`, `node ai/qa/app-smoke.mjs`.
`python ai/qa/build-staging.py`의 `ai/qa/artifacts/staging`을 독립 프로필 localhost:8729에서 제공한다. 루트 앱의 운영 주소로 QA하지 않는다. 공개 staging 프런트엔드 도메인은 배포하지 않았다.

## 남은 제한

- 실물 iPhone, 설치된 PWA 서비스워커/OS 복귀/실제 키보드는 미검증이다. 연결 복구는 페이지 유지 중 API 통신 모사이며 오프라인 cold start 검사가 아니다.
- 기존 `openAdminPasswordReset is not defined` 시작 오류를 수정했다. AI 모듈 포함/제외 양쪽 시작 오류 0건을 검사한다.
- 상황실은 본사 안전관리자 공동 업무 화면이다. 담당자별 데이터 분리는 구현하지 않았다. worker/manager/executive와 무인증 접근은 거부한다.
- 보안 advisor는 서버 전용 RLS 테이블의 정책 없음 INFO만 반환했다. 브라우저 직접 접근 차단을 위한 구성이다. https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- 타임라인 최근 120건, 최근 완료 60건/주의 상태 최대 200건. 실제 모델 토큰만 표시하며 가격은 추정하지 않는다.

참고: https://developers.openai.com/api/docs/guides/error-codes · https://developers.openai.com/api/docs/guides/rate-limits · https://supabase.com/docs/guides/cron


## 후속 안정화: 비밀번호와 진단 (2026-09-15)

- auth-v411.js의 strict mode에서 미선언 식별자 대입이 앱 초기화를 중단했다. window에 명시적으로 등록하도록 수정했다.
- staging 계정 API는 기존 자체 인증의 서명 세션을 요구한다. 로그인 응답의 sessionToken을 저장하고 인증·계정 API에 X-ENL-Session으로 전달한다. 본인 비밀번호 변경 후 무효화된 토큰과 복귀용 세션을 정리하고 새 로그인으로 안내한다.
- 안전관리자 이외 사용자는 관리자 재설정 화면을 열 수 없다. 기존 서버의 본인 증명·역할 검증은 그대로 유지한다.
- Chromium/WebKit 실제 UI + 상태를 유지하는 모의 API로 로그인, 로그아웃, 잘못된 증명 거부, 재설정, 구 비밀번호 거부, 새 비밀번호 로그인, 본인 변경, reload 후 이전 세션 미복원을 검사했다. `node ai/qa/account-browser.mjs`.
- 이 앱은 이메일 링크/Supabase Auth 계정 방식이 아니다. 본사/현장 자체 계정과 관리자의 비밀번호 재설정 방식을 유지했다. 이메일 발송·링크 수신은 구현하거나 검증하지 않았다. 실제 staging 계정 변경 HTTP E2E는 미검증이다.
- 실패 진단에 error.param, model, job ID, agent, 시작/종료/처리시간을 추가했다. 응답이 있는 실패에는 HTTP status, type/code, 허용된 응답 헤더, attempts/retry_count가 남는다. 네트워크/처리 실패는 HTTP status를 null로 남기며 임의 상태를 만들지 않는다. 성공 metadata에도 status 200과 retry_count를 저장한다.
- 새 AI 호출 없이 기존 staging 실패 기록을 다시 읽었다. 이전 실패 4건의 diagnostic은 모두 null이어서 429 원인을 확정할 새 근거는 없었다. 외부 runner로 권한 거부를 우회하는 작업은 수행하지 않았다.
- 실제 AI 4개 시나리오·429 원인 확정·실물 iPhone 검증이 남아 A/B 종결 조건에 도달하지 않았다.

실물 iPhone 체크 (최대 5개): Safari 로그인/재설정, 홈 화면 PWA 실행, 세로/가로 상세와 키보드, 백그라운드 복귀, 네트워크 재연결과 새로고침.

## 사용자 1회 요청용 진단 경로

control-room4: 업무 상세의 `진단정보 — 전달용` 읽기 전용 입력창에서 JSON 전체를 복사한다. 안전관리자 인증 `get_workflow` 응답의 허용된 진단 항목만 표시하며 질의 원문·인증 헤더·키는 제외한다.
최종 실패는 ai_agent_runs.output_payload._meta.error, 자동 재시도 전 429는 ai_agent_events.metadata.diagnostic에 저장한다. 재시도 후 성공해도 앞선 429 이벤트는 남는다. Retry-After가 제공되지 않으면 전달용 보고서에 null로 표시한다.
진단 한정 검사 `node ai/qa/diagnostics.mjs` 통과: 필수 항목, 재시도 후 성공 기록, 마지막 실패, secret 제외, 상세 화면 표시. 실제 API 호출은 하지 않았다. 사용자 요청에 따라 기존 회귀 QA는 재실행하지 않는다.
