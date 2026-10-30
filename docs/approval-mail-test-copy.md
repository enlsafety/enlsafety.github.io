# Temporary safety copies of approval-request emails

Release 4.8.3 adds an opt-in operational switch in `enl_push_config`:
`approval_email_test_copy_enabled` (default false). The user requested temporary
copies to test the production email link after login.

- Enabled: active safety accounts with a registered email and email notifications ON
  receive one copy per incident, approval round and stage (`parallel` or `president`).
- Copies are queued independently of executive email availability and preferences.
- Copies use the original approval-request template and link, with a test-reference
  prefix and a notice explaining that the recipient's permissions still apply.
- No safety push event, account permission or incident data is created or changed.
- Existing events are not replayed. The original one-email-per-push constraint
  remains enforced by a partial unique index. Test copies deduplicate by event key.
- Delivery rechecks the switch, active safety role, email preference, current round
  and current stage. Disabled, outdated or no-longer-required copies are suppressed.

Enable only after the migration and email dispatcher have been deployed:

```sql
update public.enl_push_config set approval_email_test_copy_enabled=true where id=1;
```

Stop test copies without redeploying or changing other notifications:

```sql
update public.enl_push_config set approval_email_test_copy_enabled=false where id=1;
```

The link requires login when logged out. It opens the requested incident and focuses
the approval panel. Safety sees the approval status only; an assigned executive sees
decision controls only during their own turn. Opening a link never submits approval.

Validation: `tests/approval-test-copy.cjs` uses the actual email dispatcher, SQL
migration and a mocked provider. `tests/approval-mail-link-browser.cjs` uses actual
login UI, incident API and report components in isolated Chromium/WebKit sessions.
