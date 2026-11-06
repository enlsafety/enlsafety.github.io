# Map risk classification r90

The national site map no longer elevates a site solely because an incident has major injury severity or the potentialMajor flag. High risk now requires five or more current-year incidents, or an unresolved incident whose stored management priority is urgent. Existing historical-transfer exclusions and contract-ended site exclusions remain unchanged. Existing counts, year scope, markers, controls and role access remain unchanged.

The reported one-incident condition (approved, severity major, priority important, manual priority source, potentialMajor false) now produces 일반 and a dark marker. This fixes the map overriding the safety manager's explicitly chosen management priority. Incident values and automatic priority recommendation rules are not modified.

The legend identifies the operational urgent criterion rather than describing it as a legal major-disaster determination. It wraps onto two lines to fit the mobile map; the selected-site notice uses 긴급 관리등급.

Validation: updated existing dashboard unit regressions cover manual important + major severity, potential risk alone, urgent priority, closure, annual count boundaries, historical exclusions, inactive sites, marker colors, access roles, coordinates and rendered labels. They run in publication CI. JavaScript syntax and release/cache checks passed. Browser fixtures with synthetic records at 900px and 390px verify ordinary/urgent/3-case/5-case markers and totals, site summary, and legend bounds. No production incident records, permissions or backend code changed.
