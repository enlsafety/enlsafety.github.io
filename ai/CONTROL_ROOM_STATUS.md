# AI 안전관리본부 상황실 — Staging

2026-09-15 / 앱·API `4.4.0-control-room1` / Edge 배포 버전 8.
작업 브랜치 `feature/ai-safety-team-mvp`, DB `enl-incident-staging` (`zgwxzfvvpqgdedyobwmg`).
main과 프로덕션 Supabase는 변경하지 않았다.

## 구현

업무지시/검토·상황실 탭, 에이전트 좌석 4개, 상태·단계·진행률·시간,
업무별 인계 흐름, LIVE TIMELINE, 에이전트·업무 상세, 공식 근거,
누락정보·의견 차이, 실제 토큰, 승인·보류·재검토·실패 재시도.

`ai_agent_events`와 서버 전용 `ai_control_transition`을 추가했다.
업무 상태·실행 기록·이벤트·승인 전환은 한 트랜잭션으로 저장한다.
120초 lease와 원자적 claim으로 중복 실행을 막으며 모델 호출은 단계당 90초로 제한한다.
각 단계는 별도 서명된 서버 호출로 인계한다. 인계 누락·만료는 인증 조회에서 복구한다.
만료된 실행은 실패와 재시도 상태를 제공한다. 동시 진행은 최대 4건이다.
재검토는 최신 스테이징 사고와 검토 의견으로 새 업무를 생성하고 이전 기록을 보존한다.

## 검증

| 구분 | 결과 |
|---|---|
| Edge 단위 검증 | 통과: 공개 메시지 추출, 개인정보 최소화, HTTPS 공식 출처, 도구 근거 대조, 실제 usage, 위조 worker 서명 거부 |
| Staging DB 전환 | 통과: fixture 4단계, 인계 3건, 중복 claim/idempotency, 잘못된 lease 거부, 보류/재검토/실패/재시도. 모든 fixture는 rollback |
| PC/iPhone UI | 통과: Chromium 1440/390px, WebKit 390/320px. 갱신, 상세, 메모 보존, 승인/보류/재시도, 비동기 접수, 로그아웃 정리, 잘림 검사 |
| 기존 앱 연결 | 통과: 실제 전체 스크립트의 로그인 화면, 대시보드/사고/조치/현장/사용자 메뉴, 현장 사고등록 화면. 원격 요청을 모두 가로채 운영 데이터 미접촉 |
| 실제 API 권한 | 통과: 무인증·권한위조 조회와 위조 worker 거부, 안전관리자 조회, 입력 payload/인증값 응답 제외 |
| 실제 AI A/B/C | **미통과**: 합성 사고 3건 모두 첫 에이전트에서 OpenAI HTTP 429. 4인 실행 완료와 실제 법령 출처 검증은 확인 불가 |
| 실제 AI D | 통과: 429 → agent/workflow failed → 실패 이벤트 저장. 재시도 시 새 업무 생성·이전 기록 보존. 재시도도 429 |

429의 구체적 원인은 확정하지 않았다. API의 결제/사용 한도 또는 rate limit 확인 후 A/B/C를 재실행해야 한다.
모델 결과를 모의 데이터로 바꿔 성공으로 표시하지 않는다.

## 제한

- 기존 자체 인증에 맞춰 직접 Realtime 구독 대신 안전관리자 인증 API를 3초마다 조회한다.
  숨김 탭 15초, 연결 실패 시 최대 30초이며 마지막 확인 시각을 표시한다.
- 화면이 닫힌 동안 서버 인계에 실패하면 다음 인증 조회에서 재개한다. 별도 상시 scheduler는 없다.
- 가격을 추정하지 않는다. 완료된 Responses API의 토큰만 집계한다.
- 타임라인 최근 120건, 최근 완료 60건/주의 상태 최대 200건 목록. 업무 상세에는 해당 업무 전체 이벤트가 있다.
- 의미상 모순은 최종검증 finding과 처리 의견 차이로 표시하며 모든 충돌 탐지를 보장하지 않는다.
- 실제 iPhone 기기/PWA 설치·푸시와 기존 사고 저장/승인의 실제 DB 회귀시험은 남아 있다.
- 기존 `openAdminPasswordReset is not defined` 시작 오류는 AI 모듈을 제외해도 동일했다. 이번 변경으로 추가되지 않았다.
- DB 보안 점검은 서버 전용 RLS의 정책 없음 안내뿐이었다. 성능 점검의 기존 중복 인덱스·push 인덱스 안내는 범위 밖이라 보존했다.

## 미리보기와 QA 실행

기존 루트 앱에는 운영 주소가 남아 있으므로 feature 체크아웃을 그대로 운영 데이터에 연결해 QA하지 않는다.
`python ai/qa/build-staging.py`는 기존 앱 복사본의 Supabase·앱 이동 주소를 staging/localhost로 바꾼다.
`ai/qa/artifacts/staging`을 **독립 브라우저 프로필에서 localhost:8729**로 제공한다.
GitHub QA artifact에 미리보기와 모의 UI 스크린샷을 포함한다. 공개 스테이징 도메인은 별도로 배포하지 않았다.

- `node ai/qa/edge-unit.mjs`
- `node ai/qa/browser.mjs` (Playwright 1.55.0 Chromium/WebKit)
- `node ai/qa/app-smoke.mjs`
- `ai/qa/transitions.sql` (staging 전용, rollback)
- `node ai/qa/live-read.mjs` (선택적 실제 API 읽기 QA, 외부 임시 계정 파일 필요)

인증정보는 코드·로그·스크린샷에 남기지 않는다. 실제 QA 임시 계정은 검증 후 비활성화한다.

참고: [OpenAI 웹 검색](https://developers.openai.com/api/docs/guides/tools-web-search),
[Supabase 실행 제한](https://supabase.com/docs/guides/functions/limits),
[백그라운드 작업](https://supabase.com/docs/guides/functions/background-tasks).
