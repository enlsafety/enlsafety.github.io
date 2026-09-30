# 4.4.25 site administration and dashboard

Baseline main 225439f9dbf80cda33a059e993e60c70c74574d6 / 4.4.24. No open PR at start.

- 전체인원(상용) sums active sites regular_count only; daily_count remains a separate card. Removed duplicate regular-count card. Read-only current master sums: regular415, daily389, active33 / closed1.
- Single legend moved above map at every viewport; no duplicate mobile text.
- Existing create dialog passed null to a default-object-only renderer; fixed at callsite. Added explicit 사업장 추가 / 정보 수정 labels and active/all/closed list filter.
- 운영목록에서 삭제 (계약종료) sets existing active=false through the existing safety-only save API, after confirmation. Records remain editable under 계약종료 filter. Contract month/date can be entered without invented days. No physical deletes or incident mutations.
- Existing site fields not present on form are preserved in save payload. A failed save leaves the form usable and is not reported as success.
- Legacy site-upsert previously synchronized account names/roles/PINs on every site edit. It now calls the existing account synchronization only for new sites or actual contact changes; information/status-only edits preserve accounts.
- No schema changes. No production sample site creation, edits or closure performed. Only existing legacy Edge function needs the contact-change guard deployment.
- New sites enter the directory and KPIs after save. Map points still require verified static address coordinates; unknown addresses remain explicitly marked 좌표 확인 필요 instead of invented positions.

QA: isolated actual create/edit/close/cancel/restore/error forms in Chromium/WebKit; SQL-double test denies personnel/incident access for information/status-only edits; existing contract and dashboard regressions including legend position and regular/daily counts.
