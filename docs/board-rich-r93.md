# Rich boards r93

Adds typed rich text, inline PNG/JPEG images, multiple authenticated attachments, title/body search, and Seoul-date filters to the four existing boards. No access scopes or posting roles are widened. No automatic email/push is added.

QA: isolated PGlite server regressions plus Chromium desktop/mobile create, read, edit, image and search flows. Successful run: https://github.com/enlsafety/enlsafety.github.io/actions/runs/42542042445

Deployment order: private prechange snapshot and restore probe; additive document/assets migration; incident-sync Edge platform handler; web release and PWA cache revision. Existing posts/files remain unchanged. Removed rich attachments remain privately retained.

Rollback: restore prior frontend source using a higher cache revision. Keep additive DB structures and all new rich documents/assets. Do not drop columns/tables or overwrite newly edited posts. If server rollback is required, first suspend rich editing and reconcile documents made since release; then restore the prior Edge bundle. Prechange board snapshots are private and have no anon/authenticated grants. They support scoped recovery, not a claim of full-project PITR.
