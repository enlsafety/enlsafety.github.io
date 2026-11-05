# Integrated home release r44

The integrated home follows the supplied 1672x941 reference. The reference asset supplies the original golf-course banner. The logo is an independent background-free SVG and the feature/calendar illustrations use a transparent 3-by-3 atlas, so card backgrounds never include cropped screenshot rectangles. Text, navigation, cards, search results and records are accessible HTML controls. Identity, dates, counts and records come from the signed-in account and existing scoped data; the example person, records and badges in the reference are not seeded.

## Functional scope

- Existing incident entry, review, role checks and approval engine remain in place.
- Existing module names, permission settings and edit/reorder controls are preserved behind the safety administrator's Edit button.
- MSDS is added as a disabled module under development. Risk assessment, TBM, organization and training keep their existing implementation/access states. This home release does not implement their business workflows.
- Recent work uses the authorized activity API. Approval rows use actual safety/executive actionable incidents.
- Search covers available menu names, currently loaded scoped incidents, notices and today's schedule. Documents and training content are not indexed while those modules are unimplemented.
- The bell opens the existing notification preferences center; no sample unread badge is fabricated.
- Notices and events can be created/edited/archived by safety administrators. Field/worker users see global items and their own site's items; HQ roles see all. Archive retains original content and audit history.
- Favorites are per verified actor. Content changes use revisions and row locks to avoid overwriting concurrent edits. All dates use Asia/Seoul.
- Content tables reside in private schema with RLS and no browser grants; access uses the existing verified Edge API. No new passwords or client credentials are introduced.

## Deployment

Apply `supabase/migrations/20261104234953_integrated_home_content.sql`, deploy `enl-incident-sync-v411` with its existing custom authentication configuration, then publish the static root. The migration is additive and preserves incident/account rows. Legacy cached clients saving the original five modules retain MSDS. PWA release r42 includes the new CSS, JS and reference artwork.

## Validation

Passed isolated actual Edge/PGlite tests: integrated-home-content, platform-foundation and final-lifecycle (44 cases). Release/cache, cause draft, one-page Excel and session proof checks passed. Browser checks used the isolated fixture and managed Chromium preview: notice/event save, favorites, search, module rename/order, role-specific controls, notification center, incident navigation/return, and mobile widths. Native iPhone Safari/PWA hardware was not available. Updated browser regression expectations are included for CI; they are distinct from the manually executed managed browser checks.

`tests/integrated-home-fixture.js` intercepts all external API calls, uses only fictional records and blocks service-worker registration. It is loaded only by the local QA wrapper, never by the production entry.

## Recovery

Revert the static release commit to restore the previous home; retain the additive tables and audit records. Do not drop content tables or reset production incident data. The backend remains compatible with the previous five-module client.

## Visual refinement r43

- Replaced clipped logo and feature/calendar artwork with a background-free vector wordmark and transparent artwork; retained the golf banner.
- Matched navigation pictograms to the reference (warning triangle, shield cross, hard hat, open book and gear), including the blue/green brand shield and four-square section icon.
- Reduced home-only title/body typography and aligned card content explicitly from the top. Existing incident screens retain their own styles.
- Light pastel blue translucent sidebar, native CSS decorative waves, dark legible labels and restrained active/hover states.
- Revised narrow-screen card spacing and tablet columns to avoid description/arrow collisions. Preserved safe-area and hidden-mobile-menu behavior.
- No authentication, backend, account, permission or incident-workflow changes. Static entry and PWA cache keys increment together.

Validation: JS syntax, release/cache asset checks and diff checks passed. Managed Chromium isolated fixture verified search, menu rename/save, support menu, and responsive layout. Native Safari/iPhone hardware was not available.

## Artwork quality r44

The generated PNG atlas had noisy transparent edges even at rest. Replaced the active feature/calendar atlas with a self-contained native SVG using continuous paths and gradients, retaining the nine subjects and color assignments. No raster embedding, external fonts, filters or cross-cell clipping is used. The original PNG remains in the repository for recovery but is no longer requested or precached.

Desktop hover keeps the 2 CSS pixel lift using relative top positioning in two whole-pixel steps. Removed the parent brightness filter and transform animation so the artwork is neither filtered nor scaled during hover. Border and shadow supply selection feedback. Hover motion is limited to fine pointers and disabled for reduced-motion users.

Validation: managed Chromium isolated fixture confirmed resting and actual hovered rendering. Animation-frame samples showed top 0/-1/-2px, filter/transform none, and unchanged artwork dimensions through the transition. Responsive widths 393, 360 and 768 (inner client widths 378, 345 and 753 with scrollbar) had no horizontal overflow or description/arrow collisions. Incident entry/return worked. SVG XML parsing, release/cache checks and diff checks passed. Native Safari and physical iPhone testing was not performed for this revision. No application logic, role rules, accounts or production data were changed.
