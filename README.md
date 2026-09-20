# ttScore suite 0.1.7

Integrated table-tennis scoring suite.

Components:

- **ttScore 0.8.7** — individual-match scoring, reporting and Team-bound handoff;
- **ttscore_team 0.11.9** — team-match creation, administration, public view and Firebase persistence.

## Entrypoints

- `index.html` — current ttScore entrypoint; byte-identical to `ttscore_0.8.7.html`.
- `team/index.html` — current Team entrypoint; byte-identical to `team/ttscore_team_0.11.9.html`.

The release artifact contains only the current executable versions and the current Team dependency closure. Older deployable runtime versions used for rollback belong on hosting, not inside this release ZIP.

## Team control-tab policy

Within one browser profile, only one **controlling** `ttscore_team` tab may be active at a time:

- `mode=create` — exclusive control lock required;
- `mode=edit` — exclusive control lock required;
- public `view` — no control lock; any number of read-only views may be opened in parallel.

The control lock is implemented with the Web Locks API. If the API is unavailable, `create/edit` fail closed instead of starting without the invariant.

This browser-local rule does not replace Firebase cross-client concurrency protection. Writes from different browsers/devices remain guarded by `_writeRevision` rules.

## Team integration boundary

Automatic Team result/Live mutation requires an exact current Team binding (`teamMatchId`, `individualMatchId`, assignment generation and `ttScoreMatchId`). Names/date/format similarity is not authority.

A standalone/offline ttScore match without a valid Team binding is an emergency workflow. Its score/report/Live are not imported automatically into Team. Administrator restores the final Team score and report manually if required.

## Durable handoff

Team-bound completion uses one durable `pendingRelease` in the ttScore Team session and one Team-side `pendingFinishedMatch` record. Writes and deletes are verified against `localStorage`; failure is fail-closed and remains visible for retry/recovery.

Undo and reassignment advance assignment identity. A delayed report from an older attempt cannot be attached to a later same-score attempt unless the generation proves it is the same lifecycle.

## Current limitations

Two limitations are consciously accepted for this version:

- **KI-001 — dynamic browser-storage failure during an already-running match.** In the rare sequence where `localStorage` becomes unwritable after a successful start and the page then reloads/crashes before a later successful save, the durable local score may lag behind the visible in-memory score. Product risk: **LOW**; decision: **ACCEPT**.
- **KI-002 — legacy v1 pending after Team Undo and a new same-score attempt.** A legacy RC16-format pending can be cleared without modern attempt proof in a narrow manual-Undo sequence. Team sporting state remains correct and no stale result/report is applied. Product risk: **VERY LOW**; decision: **ACCEPT**.

`KNOWN_ISSUES.md` is the normative record with the complete scenarios and assessments.

## Release contents and evidence

- `VERSIONS.md` — compact version history/current component map;
- `RELEASE_NOTES.md` — release changes;
- `KNOWN_ISSUES.md` — normative known limitations;
- `VERIFICATION.md` — verification provenance and rebuild status;
- `docs/GENERAL_REVIEW.md` — completed internal product review summary;
- `docs/` — current product/release documentation;
- `tests/` — test suite used for the reviewed product state;
- `evidence/` — preserved test/static evidence, internal review and rebuild record;
- `MANIFEST_SHA256.txt` — integrity manifest for the release contents.

Publication and rollback rules are documented in `docs/PUBLICATION_AND_ROLLBACK.md`.
