# Compact incident analysis r137

The default view now has four compact KPIs and two desktop panels: same-period annual/monthly comparison, and three site/type focus rows with their prevention action. The focus and action are combined instead of repeated across separate rankings and large planning cards.

Removed the large hero, section jump links, repeated narrative summary, repeated priority section, large planning cards, separate four-step roadmap and duplicate target-setting prose. Detailed cost comparison, supporting reports, prior annual reference, site trends, costly incidents, unknown costs and rate methodology remain accessible through native details/summary disclosure controls. Severe/potential-major flags retain a visible alert summary.

Scoped typography, padding, chart height and spacing were reduced together. Comparison bars are 76px maximum rather than 115px. Large headings and 35px values are replaced by an 18px panel title and 28px main value. Mobile retains two-column KPI cards, stacked panels, scrollable month comparison and at least 40px selector targets. The dashboard CSS and data aggregation logic remain unchanged.

Validation: incident-analysis unit checks, strategy period/date/cost regressions, final cache checks and all-role DOM navigation tests passed. Expanded tests assert two default panels, a maximum of three combined focus/action rows, secondary content collapsed initially, disclosure expansion, report access and unchanged dashboard interactions. No production records changed.

Visual verification remains unverified: managed preview started successfully, but cloud browser tab creation again failed with `Protocol error (Storage.setCookies): Invalid cookie fields`. Preview was stopped. No rendered pixel, Safari or device pass is claimed.
