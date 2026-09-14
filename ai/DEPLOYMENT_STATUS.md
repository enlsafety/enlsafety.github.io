# 이앤엘 AI 안전관리팀 — Staging 상태

기준일: 2026-09-14
브랜치: `feature/ai-safety-team-mvp`

## 완료

- 4개 에이전트 역할 확정
  - `safety_director` — AI 안전본부장
  - `incident_manager` — 사고관리
  - `legal_reviewer` — 법령검토
  - `final_auditor` — 문서·최종검증
- 사고 검토 고정 워크플로 구현
  - 사고관리 → 법령검토 → 최종검증 → 안전본부장
- 법령검토 공식 출처 제한
  - `law.go.kr`
  - `moel.go.kr`
  - `kosha.or.kr`
- 법적 의무 / 실무 권장 / 불확실 사항 분리
- 법적 최종판단·대외제출·종결 등 Human Approval 적용
- Supabase Staging AI 테이블 구성
  - `ai_workflows`
  - `ai_agent_runs`
  - `ai_findings`
  - `ai_approvals`
- AI 테이블 RLS 활성화 및 브라우저 직접 정책 미개방
- Staging Edge Function `enl-ai-safety-v440` 배포
- 안전관리자 인증 적용
- 사고정보 최소수집 적용
  - 사진 미전송
  - 사고자 이름 미전송
  - 안전검토에 필요한 구조화 정보만 전달
- 기존 사고보고앱 Feature Branch에 `AI 안전팀` 화면 연결
- 승인 / 보류 / 재검토 처리 구현
- DB workflow → agent run → finding → approval 트랜잭션 smoke test 통과
- GitHub Actions `AI Safety MVP Smoke` 구성 및 최초 통과

## 프로덕션 반영 전 남은 필수 단계

1. Staging Supabase Function Secret `OPENAI_API_KEY` 존재 여부 확인 및 필요 시 설정
2. 실제 테스트 사고 1건으로 4개 에이전트 end-to-end 실행
3. 법령검토 결과의 공식 URL 및 최신성 검증
4. 안전관리자 승인/보류/재검토 실제 UI 테스트
5. iPhone Safari/PWA 및 PC 화면 QA
6. 비용·응답시간 측정 후 모델/추론강도 조정
7. Staging 통과 후에만 Production DB/Edge Function 및 `main` 브랜치로 승격

## 배포 원칙

- `OPENAI_API_KEY`는 GitHub 또는 브라우저 코드에 저장하지 않는다.
- Staging 검증 전 Production에 병합하지 않는다.
- AI 오류가 기존 사고접수·승인·종결 기능을 차단하지 않도록 AI 기능은 부가기능으로 유지한다.
- AI가 법정 보고대상을 단독 확정하지 않는다.
- 승인된 결과만 향후 이앤엘 업무사례 지식으로 축적한다.
