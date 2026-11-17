# Dashboard drill-downs and map sidebar, r132

- Renamed the displayed cost heading to 발생된 피해비용. The total and person/property buttons now sit beside each other at content width instead of stretching across two half-width columns.
- Added two SVG doughnut charts for person/property incident counts and known costs. Legends and segments open a category-specific list in descending cost order, with unknown values after known zero. Cost ratio excludes unknown amounts and labels that basis explicitly.
- Unknown-cost controls open a list directly below the cost section or the missing-information table, depending on which control was used. Each report row opens the existing review flow. Safety editing/correction and HQ read-only permission rules are unchanged.
- Month clicks render their report list directly inside the month card below the chart. Top count-card drills remain at their existing location.
- The map sidebar defaults to current-year incident rankings across active sites, with total, person and property counts. Selecting a site displays compact information and the currently readable current-year reports in the same sidebar. An all-years list link remains available. Aggregate-only report details are not exposed.
- Clicking outside the white map panel clears the selected site and visible marker labels and restores the default map view/ranking. Inside clicks preserve selection. Existing touch confirmation, zoom and pan controls remain.
- The outer map frame/layout dimensions are unchanged; the sidebar content scrolls within the panel. No backend or production data change, extra endpoint, polling timer or chart dependency was added.

Validation: syntax checks, existing aggregation and map unit tests, dashboard Edge authorization tests, release/cache checks, and complete app DOM regression for safety/manager/executive/field passed. DOM coverage includes cost order (including zero and unknown), ratio arc totals, inline placement, actual review opening and role-specific edit button, ranking order/category counts, map selection by ranking and marker, inside/outside clicks, year changes, uploads and document navigation.

Visual limitation: managed-browser tab creation failed with `Storage.setCookies: Invalid cookie fields`; desktop/mobile pixel layout and physical Safari device behavior were not verified. Tests used isolated mocked data and did not alter production reports.
