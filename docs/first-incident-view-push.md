# First incident view push (4.8.5)

A confirmed individual incident view by an active HQ staff member (`manager`, legacy `final`) or executive sends a push to active safety managers. The unit of notification is **incident + viewer**, across report details, corrective-action details, and final PDF. Approval and cause-analysis state do not gate the notification. Existing view history remains intact and is not backfilled.

The browser observes visible incident detail modals, including masked person incidents and urgent deep-link fallback. List fetches and synthetic clicks do not count. It retries failed saves while the report is open, and resumes on reconnect/reopen. Approval decoration no longer owns view tracking. Legacy workflow priming clicks remain for workflow context only.

The authenticated sync `view` and `final_document` actions, and legacy push `management_view` API, all insert into `enl_document_views`. A database trigger creates the push atomically. A canonical unique event key prevents duplicate notifications across simultaneous requests and document types. The legacy endpoint no longer independently queues a second notification.

The server starts dispatch through pg_net after commit, with a minute-level pending-event retry independent of the viewing browser. The existing dispatcher retains per-device delivery deduplication, authenticated internal access, safety push switches and subscription preferences. JSON string preference values are parsed as well as objects. Management-view events do not enter the email bridge. No incident payload, signature, account preference, or existing view row is modified by this release.

## Verification

- Actual sync and push handlers against isolated PostgreSQL: saved cause fields, property/person records, all visible lifecycle states, distinct viewers, repeat/mixed API/PDF views, old history, proof failures, inactive users, invalidated incidents, push-only recipients, OFF settings, dispatch deduplication, transaction rollback and dispatch recovery.
- Browser: common detail UI, actual dashboard row, executive approval queue, urgent fallback, hidden modals, synthetic clicks, retries/reconnect, account switching and reopening after revision.
- Actual email deep link through login and authenticated pull to the approval screen also records the executive view.
- CI runs Chromium desktop and WebKit mobile plus existing lifecycle, auth, PDF, attachment and staging regressions. Notification providers are mocked for tests; no real test push/email is sent.

## Release sequence

Deploy migration `20261030065258_first_incident_view_push.sql` and push Edge function together, then publish the frontend. The canonical report event key also matches the old Edge function during the brief rollout overlap. Verify the trigger, scheduled retry, Edge source, unchanged incident digest and security advisories, then verify public Pages source bytes. Existing open apps should be reloaded to receive the unified tracker.
