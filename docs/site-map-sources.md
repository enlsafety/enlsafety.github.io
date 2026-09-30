# Dashboard site map — 4.4.18

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

`site-locations-v450.js` stores 33 address-matched positions, checked 2026-09-30. Every record contains its source URL, accuracy type and exact registered-address fingerprint. Facility representative points are not represented as parcel-level survey positions. The office point represents the building, not an individual suite.

The original 21 coordinates were mostly Korean Culture and Information Service public cultural-facility data, inspected via Purpleo's public presentation; two are Korea Tourism Organization POIs and one is a building-address lookup independently corroborated by public business-address data. Only coordinates and source metadata are copied; no map tiles, imagery or descriptive text are redistributed.

Facility identity and parcel address match for the main KCISA entries. For 진양밸리, 뉴스프링빌, 프린세스, 비콘힐스 and 360도, facility names and locality/road-address identity establish the match; these are expressly facility POIs, not exact parcel geocodes. Coordinates are invalidated in the UI when the current registered address differs from the fingerprint.

No geocoding runs in users' browsers. Removed the former hard-coded approximate locations and regional fallback. Unverified locations remain selectable in the dashboard but have no geographic point; the UI explicitly labels them `좌표 확인 필요`.

The 4.4.18 continuation starts from main `4549ba1e3270ff4c73a0afbf745c1f0763852d96` (merged PR #20). The 12 missing Excel-address entries are now added; there are no pending locations among the workbook's 33 sites. On the user's explicit instruction, s34 파주CC is contract-ended and excluded from the current dashboard's map, selection, site/headcount and site-risk totals. Its master record and historical incident access remain untouched. Overall incident counts retain all history. No DB status or active flag is changed.

### Newly verified coordinates

| ID / site | Address matching and coordinate basis | Coordinate source |
| --- | --- | --- |
| s03 모나크 | Official directions identify 육령리 197-5 and 대금로1851번길 3-14 as the same club; public facility address agrees. | [Public commercial-area data](https://rlh.purpleo.kr/article/280), [official address](https://monarchcc.co.kr/about/location) |
| s07 파인힐스 | 복다리 산27 ↔ 송광사길 99; charging point inside the facility. | [Charging location](https://roadtriplab.com/evcharging/8883) |
| s12 밀양에스파크 | 미촌리 889 expressly listed; facility representative point. | [Hole19](https://www.hole19golf.com/courses/s-park-resort-country-club-miryang) |
| s15 알펜시아 회원제 | 용산리 425 exactly maps to 솔봉로 325 resort address. This is the workbook's building-address point, not the member course's geometric centre. | [Building address](https://jusoga.com/b/4276038025200860004132005/강원특별자치도-평창군-대관령면-솔봉로-325) |
| s17 파인파크 | 오식도동 507 ↔ 가도로 282; permit CDFH3301052024000002 identifies 파인파크 AT 군산파3 507. | [Local permit data](https://fgt.purpleo.co.kr/view/5659) |
| s19 남한강에스파크 | 법천리 75 ↔ 장뜰길 154; facility charging location. | [Elecvery](https://www.elecvery.com/ko/map/place/DFF737349DA17183A0CE5DBE77D6BC65) |
| s20 청양예미지 | 주정리 65-17 explicitly listed in both golf directory and official driving-range page. | [Goltou](https://goltou.kr/main?no=904&page=golfjang_homepage), [official address](https://www.yemizicc.co.kr/club/driving-range) |
| s22 소피아그린 | Official 현수리 산13 ↔ 소피아그린길 84; facility representative point. | [Mapcarta](https://mapcarta.com/31581844), [official address](https://sophiagreen.co.kr/swp/location) |
| s23 힐데스하임 | 음성 후삼로158번길 101; distinguished from 제천's former Hildesheim (now 킹즈락). | [Hole19](https://www.hole19golf.com/courses/hildesheim-country-club) |
| s24 용평 | 18-hole 용평CC within 용산리 130 resort, distinct from the 9-hole public course. | [Korea Tourism Organization](https://data.visitkorea.or.kr/linkedview/130989) |
| s25 버치힐 | 수하리 142-31 identifies Birch Hill; use its specific POI, not the generic resort point. | [Korea Tourism Organization](https://data.visitkorea.or.kr/page/131725), [address confirmation](https://www.kakao.golf/golf/181) |
| s31 진해 신항 | 제덕동 898 ↔ 수제로 36, former 아라미르; facility charging point. | [Charging location](https://megojigo.com/bbs/board.php?bo_table=evcharging&wr_id=314991) |

Coordinates remain explicitly labelled building or facility representative locations, not surveying-grade parcel/entrance positions. Nearby points are not artificially displaced; the select list provides individual access when dots overlap at national scale.

The single s22 coordinate is attributed to © OpenStreetMap contributors / Mapcarta; OSM way 615390835 is available under [ODbL](https://www.openstreetmap.org/copyright). Attribution is shown on the map and in the site's summary. The other independently sourced records retain their own provenance. Only coordinate facts and attribution are stored; source prose, course maps and tiles are not copied.


## Read-only reconciliation

The supplied workbook is `260813_이앤엘 외주사업장 현황(5).xlsx`, not the `(4)` filename in the task text. All sheets were inspected: one sheet, 33 business-site rows. All 33 names match the current site master; all 33 nonempty addresses already match DB values. DB contains 34 active sites. No address UPDATE or migration was necessary in this continuation. Personnel/headcount differences are not overwritten. No production records are included in QA fixtures.

## QA

`node tests/dashboard-unit.cjs`: prior-year urgent/major incidents, historical exclusions, annual count threshold, inactive/deleted sites, address changes, HTML escaping and coordinate bounds.

`node tests/dashboard-browser.cjs`: isolated fixture using the actual shell, statistics and dashboard modules at 1280/820/390 px. Network writes are prohibited. Checks map placement, selection/card/list integration, Jeju high-risk marker, unmapped selection, statistics filters, stale profile removal and safety-only visibility. Screenshots uploaded as `dashboard-qa` CI artifact. Existing workflow suites remain in place; manual production-mutating QA workflows are not run.

4.4.18 adds checks for all 33 coordinate records and address cards, terminated-site exclusion, historical site access, and no change to incident workflows.
