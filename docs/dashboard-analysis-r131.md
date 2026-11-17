# Dashboard analysis integration, r131

The incident dashboard now uses the same saved initial-report aggregation and shared chart renderer as the analysis view. Duplicate legacy month charts, category donut and site ranking are removed. The dashboard includes total/person/property counts, entered loss totals with person/property breakdown, monthly events, event types, site counts, priority checks, job distribution and missing information. Unresolved incidents remain available through a list button.

The existing four-card overview and map insertion anchors remain. Map source, assets and platform layout CSS are unchanged. The small cost summary uses rounded ten-thousand/hundred-million won units when needed; the breakdown below the map shows exact entered amounts in won. Unknown costs remain distinct from explicit zero. This keeps detailed money rows out of the overview so they do not expand it.

Year selection uses Korea occurrence dates and survives shell rerenders within the same actor. Drill-down uses the same authorized saved records as the charts. Map metrics retain their existing current-site/current-year definition; the page labels the different scope. No new server endpoint, timer, network request or production data write is introduced. The separate analysis view retains its existing filters and route; year-over-year comparison is not introduced in this release.

Validation completed locally:
- Analysis unit tests: categories, deduplication, invalidation, dates, missing/zero costs and split totals.
- Full application DOM integration for safety, manager, executive and field: dashboard sections occur once, map anchors, month/count drill, year changes across the Korea year boundary, exact split costs, permissions, immutable source and existing document/upload paths.
- Existing map geometry/risk unit tests, read-only dashboard Edge authorization tests, release/cache tests and syntax checks.
- Browser regression fixture updated to use the shared analysis module and saved-report totals.

Browser visual QA could not run: the managed browser failed at tab creation with `Storage.setCookies: Invalid cookie fields`. No desktop/mobile screenshot or physical-device claim is made. DOM tests do not validate pixel geometry. Existing map dimensions and responsive rules were preserved in source.
