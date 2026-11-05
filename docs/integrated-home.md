# Integrated home release r41

The integrated home follows the supplied 1672x941 reference. The reference asset supplies the original banner, logo, illustrations and decorative artwork through CSS clipping. Text, navigation, cards, search results and records are accessible HTML controls. Identity, dates, counts and records come from the signed-in account and existing scoped data; the example person, records and badges in the reference are not seeded.

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

Apply `supabase/migrations/20261104234953_integrated_home_content.sql`, deploy `enl-incident-sync-v411` with its existing custom authentication configuration, then publish the static root. The migration is additive and preserves incident/account rows. Legacy cached clients saving the original five modules retain MSDS. PWA release r41 includes the new CSS, JS and reference artwork.

## Validation

Passed isolated actual Edge/PGlite tests: integrated-home-content, platform-foundation and final-lifecycle (44 cases). Release/cache, cause draft, one-page Excel and session proof checks passed. Browser checks used the isolated fixture and managed Chromium preview: notice/event save, favorites, search, module rename/order, role-specific controls, notification center, incident navigation/return, and mobile widths. Native iPhone Safari/PWA hardware was not available. Updated browser regression expectations are included for CI; they are distinct from the manually executed managed browser checks.

`tests/integrated-home-fixture.js` intercepts all external API calls, uses only fictional records and blocks service-worker registration. It is loaded only by the local QA wrapper, never by the production entry.

## Recovery

Revert the static release commit to restore the previous home; retain the additive tables and audit records. Do not drop content tables or reset production incident data. The backend remains compatible with the previous five-module client.
