# Mobile document navigation and dashboard hierarchy, r133

Phone screens hide the document workspace's business-site sidebar, using the existing main-panel site cards, document cards and back controls for navigation. The desktop sidebar is retained. The rule includes short landscape touch screens. Safety administrators retain folder actions in a collapsed mobile-only management control, using the same existing handlers; no role permissions or backend actions changed. List-load errors and retry controls now appear in the main panel so they remain reachable on phones.

Dashboard changes:
- Desktop count/cost summary cards use larger existing pictograms, category accents and a compact internal grid. The map frame geometry rules and approved artwork are unchanged.
- The cost panel groups total, person/property amounts and unknown-cost follow-up on the left. Two doughnut charts are stacked on the right, with red for person incidents and blue for property incidents. Narrow screens stack these regions vertically.
- Monthly bars, event/site/job distributions, priority recommendations, missing-information rows, cost-ordered reports and map site ranking use the same top-three colors and rank labels. Competition ranks are based on counts or known positive costs: ties share a rank and consume positions (1, 1, 3); zero and unknown values remain neutral. Month order remains chronological. Existing map risk colors are unchanged.
- Numbered section headings, grouped rows, contextual backgrounds, restrained shadows and a distinct follow-up action create visual hierarchy without enlarging all text.

Validated: aggregation/ranking unit tests including ties and zeros, complete offline app DOM tests across safety/manager/executive/field, category colors and cost-panel hierarchy, existing month/cost/report/map interactions, main-panel document navigation, role controls, syntax, map unit regressions, read-only dashboard authorization and release/cache checks. No production records were modified.

Limit: browser tab creation again failed with `Storage.setCookies: Invalid cookie fields`. CSS breakpoints and pixel layout could not be visually verified in desktop/mobile browsers. DOM tests do not establish visual/device compatibility.
