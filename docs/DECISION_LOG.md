# Decision log — integration/stabilization cycle

## Product baselines

- `ttScore v0.3.5` — accepted baseline.
- `ttscore_team v0.8.12` — accepted baseline.
- Current release candidates: `ttScore v0.4.0` + `ttscore_team v0.9.0 RC6`.
- RC5 is rejected by owner acceptance because its Database Rules denied legal writes.

## Architecture decisions

1. Team mode remains opt-in via `?teamMatch=<id>`; autonomous ttScore remains independent.
2. Shared versioned operational-domain contract remains the boundary for assignment/live/finished transitions.
3. Date/players/bestOf are Team-owned prefill; server/side/handicap remain judge-owned.
4. Team finished transition occurs only after explicit exit from the completed ttScore match, preserving the Undo window.
5. Existing-node Firebase writes use `get() → domain transform → set(candidate)`; existing-node `runTransaction()` is removed.
6. Server-side concurrency is represented by transport-only `_writeRevision`; domain `schemaVersion: 4` is unchanged.
7. Security Rules separate authorization from revision validation: parent `.write` authorizes the allowlisted editor and blocks delete; `_writeRevision/.validate` enforces missing→1 or N→N+1.
8. Create remains `runTransaction()` create-if-absent because `null` has unambiguous create semantics there.
9. Realtime editor continues to use `onValue()` with dirty-draft protection.
10. Current editor credential trust boundary is preserved; Judge/Admin authorization separation is a later product cycle.

## RC6 review disposition

- RC5 production defect: corrected in Rules.
- Runtime JS diff RC5→RC6: none.
- Functional deployment diff: `firebase-database-rules.json` only.
- Open blocker in local regression: 0.
- Remaining evidence gap: authenticated production/official-emulator Rules execution.

## Cycle decision

`STOP` for engineering changes; issue RC6 for owner acceptance. No accepted baseline changes until explicit owner acceptance.


## RC8 — serialize same-client Team writes

**Decision:** serialize the complete existing-node `GET → transform → SET` operation per Team match ID inside `firebase-source.mjs`.

**Reason:** server CAS correctly rejects stale writes, but two legitimate writes from the same page must not race each other and manufacture a conflict. The queue removes only intra-client concurrency; inter-client concurrency remains visible to CAS.


## RC9 — explicit pending-result rebase

Decision: keep stale publication fail-closed and permit binding revision rebase only after explicit `Перечитать Team`, only for the same current individual match identity. Automatic realtime/reconnect does not authorize rebase. Firebase transport CAS and Rules remain unchanged.

## 2026-09-02 — report backup/publication RC1

- Baseline is accepted RC9 (`ttScore 0.4.0 + ttscore_team 0.9.0`).
- New candidate versions: `ttScore 0.5.0 + ttscore_team 0.10.0`.
- Full canonical completed JSON is backed up to a separate `individualMatchReportsV1` branch in existing `ttscore-list` RTDB.
- Backup confirmation is a hard barrier before clearing full local completed-match state.
- reportUrl is applied atomically with Team finish transition.
- Multi-match offline continuity remains deferred; normal internet with recoverable 2–5 minute interruption is the operating assumption.
