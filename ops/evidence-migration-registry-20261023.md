# 2026-10-23 migration registry alignment

Only the three migrations introduced by release 4.7.2 were renamed. Earlier repository/production migration drift is unchanged.

| Repository file | Production registry state |
|---|---|
| `20261023053133_kokmatch_five_tables_rls_20261023.sql` | Recorded version `20261023053133`, name `kokmatch_five_tables_rls_20261023` |
| `20261023053224_enl_evidence_storage_schema_20261023.sql` | Recorded version `20261023053224`, name `enl_evidence_storage_schema_20261023` |
| `20261023064500_evidence_storage_activate.sql` | Applied through the reviewed fixed-SQL Edge runner; manual migration registry marker remains pending |
| `20261023071018_storage_dedup_ledger.sql` | CLI-created private ledger schema record; operational bootstrap uses the fixed-SQL runner, and manual registry marker remains pending. This local file was not remotely applied during registry cleanup. |

The activation was applied to staging, tested through real application APIs, and then applied to production. The temporary runners were replaced with HTTP 410 tombstones. All 76 complete original production row hashes matched the protected backups after activation and again after physical reclamation. Sanitized measurements are in `evidence-storage-verification-20261023.json`.

The activation migration now runs in one explicit transaction. If all three compaction triggers are active, it validates their exact function identities, every dictionary node and root reference, all six foreign keys, all three immutable guards, compacted representation, and the hydrated lifecycle guard, then performs no data changes. Partial activation, missing guards, invalid references, missing foreign keys, or a previously rolled-back representation stop the migration. The first-apply branch embeds `tests/fixtures/evidence-storage-activate.sql` byte-for-byte; that reviewed fixture and the already-tested runner were not edited.

`tests/evidence-activation-migration.cjs` verifies first apply, idempotent reapply, partial and corrupt states, and rollback after a deliberately induced late failure. It also checks that the embedded activation and additive schema still exactly match their reviewed fixtures.

This document is not a migration registry update. No remote writes or registry repair were performed as part of this filename and wrapper cleanup. Before a future migration push, reconcile the pending activation marker and the separately existing earlier drift against the actual registry; do not assume all repository migrations are pending or replay older migrations automatically.

The Storage ledger migration contains only the reviewed private-table/RLS/grant/immutable-trigger schema inside one explicit transaction. It contains no manifest, object path, credential, file deletion, or seed data. First apply and reapply were verified locally: existing run/event rows were unchanged, append-only protection remained effective, both tables retained RLS, and anon/authenticated/service_role retained no table access (8 checks).
