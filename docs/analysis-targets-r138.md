# Shared numeric prevention targets r138

The compact analysis view now shows next-year incident-count and damage-cost targets before its charts and action priorities. A clearly labeled, unsaved 20% example is calculated from the selected year's registered records. Safety users open 목표 설정 to choose reduction percentages or enter maximum counts/amounts directly, including an explicit zero-accident target with no baseline records. Count targets floor fractional results so the requested reduction is met (29 cases at 20% -> at most 23 cases, 6 fewer). Cost inputs are optional in direct mode; an unknown baseline cost never becomes zero.

Targets are stored centrally by next year and selected site/company scope. Safety users save and edit; manager/executive users read the shared goal. Field access remains denied. No goal is automatically saved or presented as approved. Same-year cumulative baseline cutoff, unknown costs, and the distinction from injury rates remain visible. Actual next-year reports are separate; missing records are never treated as goal achievement. The basis is not annualized.

Each save freezes the server-calculated baseline and explicit ceilings into an append-only revision. Later report changes do not move an existing goal. Concurrent target revisions and changed baseline metrics reject stale saves without overwriting the user's input. In-memory unsaved input survives analysis remounts and scope changes. Manual reload explicitly warns before discarding edits. Reads cache for 60 seconds with explicit refresh, no polling and no automatic writes.

Backend: `analysis-targets.ts` behind existing verified actor/device authentication; pure target policy shared with frontend; private RLS-enabled `enl_analysis_targets`, revoked from public/anon/authenticated. No new public policy or security-definer function. Production migration version was obtained from provider history: `20261117052501_analysis_annual_targets`. Edge version 78 deployed with the previously deployed device-runtime unchanged. The existing verifier remains enabled inside the function; verify_jwt stays false as before.

Validation:
- `tests/analysis-targets.cjs`: rounding, invalid inputs, empty/missing baseline, known zero/unknown cost, cutoff/dedup, actual Edge handler + isolated PostgreSQL, roles, shared persistence, history, site isolation, stale saves and RLS.
- `tests/analysis-targets-dom.cjs`: editable percentage preview, shared readonly goals, zero direct target, explicit save, double-submit blocking, conflict input preservation, remount preservation, late response guard.
- `tests/analysis-navigation-dom.cjs`: all four roles and existing dashboard/map/report/document regressions.
- `tests/final-lifecycle.cjs`: 44 checks passed.
- `tests/risk-records.cjs`: original 204-row templates, permissions, history, photo and concurrency checks passed.
- Strategy/aggregation/cache syntax checks.
- Production table privilege query confirms RLS, no anonymous read or authenticated direct insert, and no test goal records. Security advisors show no new warnings; the new private table adds the expected no-policy INFO.

No production incident data or target examples were written during testing. Runtime browser layout/Safari/mobile verification remains unavailable due to the previously reproduced cloud browser Storage.setCookies error. DOM tests do not establish visual-device correctness.
