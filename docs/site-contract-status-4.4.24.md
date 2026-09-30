# Site contract status / 4.4.24

Baseline main: e8b2883aa9b272150d1ab525264c8cd0fe940c3b (4.4.23).

- Reuse active boolean and start_date text; add nullable contract_end_date text. Both contract boundaries accept month or exact-day precision. Do not repurpose contract_period (safety agency).
- Current site/headcount/unresolved/high-risk KPIs use active sites. Annual totals keep every incident, split by CURRENT site status. All/active/closed filters never delete records. Occurrence status is an immutable registration snapshot, not inferred from current active flag.
- Active high risk: annual count >=5 OR unresolved urgent/major nonhistorical incident. Closed sites are neutral gray even with >=5 incidents.
- Historical picker retains closed sites. Out-of-period or closed/unknown-period registrations require safety confirmation. Server independently checks master and stamps the authenticated actor. Existing unchanged-site/date records retain their snapshot; no existing-payload backfill.
- One nullable column is additive. Two existing Edge functions require deployment: enl-incident-sync (site end persistence), enl-incident-sync-v411 (dashboard fields and authoritative snapshot). Existing custom authentication / verify_jwt=false retained. No RLS, Auth, Storage, notification, global refresh changes.
- Deploy shared root site-contract-v451.js as a second file beside v411 index.ts, byte-identical to the browser helper. Legacy function source is the deployed version 13 plus contract_end_date persistence and preservation of existing month-only start dates from older date-only forms.

PajuCC s34: user confirmed 2026-03 through 2026-04 only. No fabricated exact days. Closed map coordinates: 37.84788,126.8998669, public facility dataset https://qae.purpleo.kr/article/7411 ; address confirmed by official https://m.onetheclub.com/paju/main . Address is 경기도 파주시 법원읍 화합로 306.

All QA data, including three Paju incidents, is isolated in VM/browser fixtures. No test incidents are sent to production. Current database inspection found zero incident rows; this release does not create the user's historical three records.

Validation: existing workflow invariants plus shared contract boundary tests, real Edge handler SQL-double tests, five map device profiles, actual historical form and annual filter tests in Chromium/WebKit. Runtime rollout results are recorded after verification.

## Operations performed 2026-09-30

- Migration site_contract_end_month_precision applied once. Only nullable contract_end_date text added.
- Fresh SELECT confirmed s34 active=true and blank start/address/region, no end column before migration. Compare-and-set updated exactly one row to active=false, start_date=2026-03, contract_end_date=2026-04, verified address above, region=경기 파주, updated_at=2026-09-30 09:19:01.063885+00. Existing agency contract_period remains blank. Personnel/count/source/verification fields unchanged.
- Pre-change site count34, incident count0, incident audit count47; incident payload digest d41d8cd98f00b204e9800998ecf8427e.
- PR27 first full run: all10 workflows PASS, including five dashboard profiles and Chromium/WebKit historical forms. Final follow-up refines mixed date/month bounds and closed-site names when absent from active-only login directory.
