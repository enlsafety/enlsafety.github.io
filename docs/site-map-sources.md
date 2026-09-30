# Dashboard site map — 4.4.17

## Existing work continued

Baseline main: `18cffaae442fc304ef416d481a14749d1895c8de` (4.4.16 / stable-4416-r1).
Continues PR #20 / `feat/dashboard-natural-earth-map-20260930`; does not replay its DB updates.
The existing independent `stats` route is the dashboard. The accident-status `home` route is unchanged.

## Geography

`korea-map-natural-earth-10m.svg` is the existing PR's 760×760 static Natural Earth map (63 KB), with 53 South Korean country polygon parts, including Jeju. It uses Natural Earth 1:10m country and provincial geometry. It is not a hand-drawn outline. The local file avoids runtime map-service calls.

- Country source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_0_countries.geojson
- Boundary source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson
- Public-domain terms: https://www.naturalearthdata.com/about/terms-of-use/
- Projection: equirectangular, longitude multiplied by cos(35.85°), bounds 124.3–132.2° E / 32.8–38.9° N, 26px padding, common fit scale. `mapXY` uses the identical bounds and transform.
- Generalized geography is for national distribution, not navigation or legal boundaries.

## Site positions

`site-locations-v450.js` stores 21 address-matched positions, checked 2026-09-30. Every record contains its source URL, accuracy type and exact registered-address fingerprint. Facility representative points are not represented as parcel-level survey positions. The office point represents the building, not an individual suite.

Most coordinates are Korean Culture and Information Service public cultural-facility data, inspected via Purpleo's public presentation; two are Korea Tourism Organization POIs and one is a building-address lookup independently corroborated by public business-address data. Only coordinates and source metadata are copied; no map tiles, imagery or descriptive text are redistributed.

Facility identity and parcel address match for the main KCISA entries. For 진양밸리, 뉴스프링빌, 프린세스, 비콘힐스 and 360도, facility names and locality/road-address identity establish the match; these are expressly facility POIs, not exact parcel geocodes. Coordinates are invalidated in the UI when the current registered address differs from the fingerprint.

No geocoding runs in users' browsers. Removed the former hard-coded approximate locations and regional fallback. Unverified locations remain selectable in the dashboard but have no geographic point; the UI explicitly labels them `좌표 확인 필요`.

Pending location verification: s03 모나크, s07 파인힐스, s12 밀양에스파크, s15 알펜시아 회원제, s17 파인파크, s19 남한강에스파크, s20 청양예미지, s22 소피아그린, s23 힐데스하임, s24 용평, s25 버치힐, s31 진해 신항, s34 파주CC. Some public sources describe nearby/shared resort facilities; they have not been substituted for the requested site. 파주CC has no registered address and is absent from the provided workbook.

## Read-only reconciliation

The supplied workbook is `260813_이앤엘 외주사업장 현황(5).xlsx`, not the `(4)` filename in the task text. All sheets were inspected: one sheet, 33 business-site rows. All 33 names match the current site master; all 33 nonempty addresses already match DB values. DB contains 34 active sites. No address UPDATE or migration was necessary in this continuation. Personnel/headcount differences are not overwritten. No production records are included in QA fixtures.

## QA

`node tests/dashboard-unit.cjs`: prior-year urgent/major incidents, historical exclusions, annual count threshold, inactive/deleted sites, address changes, HTML escaping and coordinate bounds.

`node tests/dashboard-browser.cjs`: isolated fixture using the actual shell, statistics and dashboard modules at 1280/820/390 px. Network writes are prohibited. Checks map placement, selection/card/list integration, Jeju high-risk marker, unmapped selection, statistics filters, stale profile removal and safety-only visibility. Screenshots uploaded as `dashboard-qa` CI artifact. Existing workflow suites remain in place; manual production-mutating QA workflows are not run.
