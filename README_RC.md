# ttScore 0.5.0 + ttscore_team 0.10.0 — RC1

Baseline: accepted integration RC9 (`ttScore 0.4.0 + ttscore_team 0.9.0`).

## Product change

RC1 adds automatic cloud backup and published personal-match reports for Team mode while preserving existing local JSON/HTML export.

Flow:

1. personal match is completed in ttScore;
2. before full local state is cleared, canonical completed JSON is created and SHA-256 checked;
3. immutable backup is committed to the existing `ttscore-list` Realtime Database under `/individualMatchReportsV1/<teamMatchId>/<recordId>`;
4. only after confirmed backup, ttScore may reset local full match state;
5. the normal Team transition publishes result and `reportUrl` atomically;
6. `?page=report&source=team&teamMatch=...&record=...` reads the backup and renders the normal HTML report;
7. Team report viewer can again save/share the files locally.

No Firebase Storage, Functions, Hosting or separate database is introduced.

## Failure semantics

- backup failure: new match is not started; full completed local state remains; Team is not advanced;
- retry after restored connectivity is idempotent;
- if backup exists but acknowledgement was lost, the same payload is reconciled instead of duplicated;
- different data at the same backup path is fail-closed;
- after confirmed backup, existing RC9 pending-release/CAS/rebase semantics remain in force.

## Verification

- ttscore_team Node: 226/226 PASS
- ttScore Node: 13/13 PASS
- normal Team browser E2E: 19/19 PASS
- pending-rebase browser: 10/10 PASS
- report backup/retry/viewer browser: 15/15 PASS
- autonomous ttScore browser: 6/6 PASS
- realtime editor: PASS
- external revision guard: PASS
- same-client write race: PASS

See `docs/REPORT_BACKUP_AND_PUBLISHED_REPORT.md`, `docs/GENERAL_REVIEW.md`, `docs/OWNER_ACCEPTANCE_CHECKLIST.md`, and `docs/NEXT_CYCLE_BRIEF.md`.
