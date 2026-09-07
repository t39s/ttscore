# Release candidates

## ttScore 0.4.0

- opt-in `?teamMatch=<id>` Team mode;
- Team assignment prefill date/players/bestOf;
- Team auth/adapter loaded only in Team mode;
- binding to concrete individualMatchId + ttScore matchId;
- Live link synchronization;
- durable finished pending until Undo-window is closed;
- automatic next assignment prefill;
- autonomous storage/scoring protocol preserved from v0.3.5.

## ttscore_team 0.9.0

- shared `team-integration-contract.mjs` v1;
- `ttscore-team-adapter.mjs` for direct ttScore access;
- Firebase editor launch action targeting paired `ttScore_0.4.0.html`;
- transaction-safe editor/adapter writes;
- same-result idempotent reconciliation;
- legacy editor bridge retained as fallback;
- schemaVersion remains 4.

Both versions are release candidates, not accepted baselines until owner testing/acceptance.


## RC3 correction

- Restored realtime updates in Firebase editor after direct ttScore Team-state publication.
- Clean editor auto-adopts external Firebase revisions without page reload.
- Dirty manual drafts are protected from silent overwrite and require explicit source refresh.
- RC2 Firebase transaction initial-null fix remains unchanged.
- Runtime diff from RC2: `team/assets/0.9.0/app.mjs` only.


## RC4 correction

- Fixed existing-node Firebase transaction handling used by manual Team editor publication and direct ttScore integration.
- `null` is no longer returned as a transaction candidate.
- A provisional initial-null callback aborts only the current attempt; the node is re-read and the transaction is retried.
- A genuinely missing Team node remains fail-closed.
- RC3 realtime editor behavior is unchanged and reverified without reload.
- Runtime diff from RC3: `team/assets/0.9.0/firebase-source.mjs` only.


## RC5 stabilization

- Replaced existing-node `runTransaction()` writes with SDK `get() → set()` plus transport `_writeRevision`.
- Server-side stale-write rejection delegated to Realtime Database Rules.
- Owner acceptance rejected RC5 because the new parent `.write` revision predicate denied legal writes, including create.


## RC6 correction

- Rules-only production correction; JavaScript/HTML/CSS are unchanged from RC5.
- Restored the accepted allowlist predicate as the parent write-authorization boundary.
- Moved `_writeRevision` transition enforcement to `_writeRevision/.validate`.
- Keeps create/legacy migration `missing → 1` and existing-node CAS `N → N+1`; stale writes remain fail-closed.
- RC5 is rejected; RC6 requires owner acceptance.


## RC8

- Fixed a false `_writeRevision` conflict during Team finalization when Live cleanup and finished transition were initiated concurrently by the same `ttScore` page.
- Added per-Team serialization around the full existing-node conditional-write critical section.
- RC6 Database Rules remain unchanged; external concurrent writers are still fail-closed.


## RC9

- Fixed recovery after a legitimate external reorder of future `planned` Team matches during an active `ttScore` match.
- The initial stale publication remains fail-closed and the final result remains durable in `pendingRelease`.
- Explicit `Перечитать Team` may now rebase that pending binding to the latest operational revision when the same individual match is still current.
- Realtime subscription and reconnect do not silently rebase.
- A second external change after refresh is rejected again.
- RC8 Database Rules and `firebase-source.mjs` are unchanged.

## 0.5.0 / 0.10.0 RC1 — automatic Team report backup

- Full completed canonical ttScore JSON is backed up to existing `ttscore-list` RTDB before local reset.
- Backup is create-only, integrity-addressed by SHA-256 metadata, and retry-idempotent.
- Finished Team transition publishes result and reportUrl together.
- `source=team` opens the backed-up report in ttScore HTML viewer.
- Team remote report can re-export files locally.
- No Storage, Functions or separate database added.
