# Dashboard map 4.4.20

Base: main 55a63a66e344b6e38421d28acaa8c1f2e97e6915 / 4.4.19.

- Markers use deterministic screen-space separation (22px minimum in tested 33-site dataset; maximum display displacement 60px). Coordinates/addresses are unchanged. Thin leader lines show true locations. Paju s34 remains excluded only from current site metrics/map; historical incidents remain intact.
- 100–400% zoom, +/- buttons, reset, pointer drag and Ctrl/Meta-wheel. Marker size remains constant during zoom; positions recalculate on resize.
- Safety, manager (including legacy final) and executive share company metrics, map, filters and charts. Existing incident details stay role-filtered and read-only for manager/executive.
- `enl-incident-sync-v411` adds `dashboard_read`: active HQ database role + existing password proof required before reading site master and whitelisted non-content incident metrics. No schema, RLS, Auth, Storage or incident writes. Existing handlers are unchanged. Legacy `enl-incident-sync` and site-upsert are not redeployed.
- Edge source was retrieved from deployed v19. Existing verify_jwt=false setting is retained because this app uses its existing custom account/credential verification. New endpoint always requires strong credential verification.
- Snapshot refreshes after local incident changes or after 60 seconds on navigation; explicit site refresh remains supported. Late responses for a different user are discarded.
- QA: isolated handler role/auth/query tests; 33-site collision bounds; browser screenshots and routing at 1280/820/390px; existing workflow regressions. Browser fixtures create no operational incidents. Authenticated production user interaction is not simulated using real credentials.
