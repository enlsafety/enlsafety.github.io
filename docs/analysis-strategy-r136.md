# 사고 종합분석 r136

## Final behavior
- The accident navigation places 종합분석 immediately after 종결 for safety, manager and executive users. Field users retain their existing access restrictions.
- Dashboard metrics, map frame, current-year filters and drill-downs are unchanged.
- The separate analysis view compares a selected year with the prior year over the same calendar window (Korean date). Completed years compare full years. February 29 clamps to February 28 when necessary.
- Prior full-year records remain available as annual context. Missing records are labeled as unavailable, not proof of zero accidents. Future occurrence dates and invalid dates do not enter year-to-date comparisons.
- Monthly paired bars, count changes, person/property cost splits, site trends, site/type recurrence groups, costly incidents, unknown costs, and independent severe/potential-major attention lists link to original reports. Existing report edit permissions apply.
- Next-year proposals tie to the top site/type groups, with practical work changes, measurement suggestions and an annual review sequence. Recommendations are explicitly proposals, not confirmed causes, assigned tasks or approved commitments.
- Incident rate and injury rate are distinguished. Actual annual average workforce, matching insured-worker population and confirmed eligible injured-worker counts are not available in the current incident dataset. No arbitrary rate or target is substituted. This release displays the missing-data requirement rather than fabricating a denominator or adding an unverified reporting data source.
- The initial production aggregate query found only 2026 occurrence years. A later 2027 visit defaults to 2027 and compares 2026 automatically. Historic records can populate prior-year comparisons as they are entered.
- Analysis uses already authorized synchronized records. Opening/filtering adds no network request, writes no production data, and introduces no backend or schema changes. Manual refresh uses the existing sync endpoint.

## Validation
- `node tests/incident-analysis.cjs`
- `node tests/analysis-strategy.cjs`: actual comparison helper, 2026/2027 cutoffs, Korean dates, leap days, empty history, zero baseline, future dates, costs/unknowns, duplicates, site filters, attention lists, read-only inputs.
- `NODE_PATH=/tmp/enl-qa-deps/node_modules node tests/analysis-navigation-dom.cjs`: all four roles, position after closed, separate strategy screen, original report links/edit permissions, escaped evidence, no navigation network call; existing dashboard, map, cost, monthly and document-navigation regressions.
- `NODE_PATH=/tmp/enl-qa-deps/node_modules node tests/sidebar-dom.cjs`
- `node tests/dashboard-unit.cjs`
- `node tests/final-cache.cjs`
- Syntax checks and `git diff --check`.

DOM checks do not establish rendered pixel layout, touch interaction, Safari or PWA device behavior. The managed browser was unavailable during this session because tab creation failed with `Storage.setCookies: Invalid cookie fields`; no browser visual pass is claimed. Responsive CSS is scoped to the strategy screen. No production reports were modified for testing.

Rate reference checked 2026-11-17: https://www.index.go.kr/unify/idx-info.do?idxCd=1514 (e-나라지표 산업재해현황). The app links to the definition and distinguishes its proposed internal incident-per-worker measure from official injury-rate statistics.
