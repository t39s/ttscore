# RC9 — recovery of pending Team result after legitimate external reorder

## Observed production behavior

Owner acceptance of RC8 confirmed the same-client finalization defect was fixed. A separate external-stale scenario exposed a recovery defect:

1. `ttScore` starts current individual match `m01` and stores its Team binding with operational revision `R1`.
2. While `m01` is in progress, the administrator changes only the order of future `planned` matches in `ttscore_team`.
3. Team operational revision becomes `R2`; the identity of current `m01` is unchanged.
4. At final release, `ttScore` correctly rejects the stale `R1` write and keeps the result in `pendingRelease`.
5. In RC8, pressing `Перечитать Team` reads `R2` but retries the pending result with the original `R1` binding, so the same conflict repeats.

The initial stale-write rejection is correct. The defect is the recovery path after an explicit source refresh.

## Research / invariants

The primary RC8 artifacts were inspected before modification:

- `ttScore_0.4.0.html` stores `pendingRelease.binding` and `pendingRelease.ttScoreState`.
- `reloadTeamContext()` reads the latest assignment but does not update the pending binding.
- `attemptPendingTeamRelease()` always republishes with `pending.binding`.
- `assignmentMatchesBinding()` requires exact `revision` equality.
- `prepareTransition()` remains fail-closed on stale bindings.
- RC8 Firebase `_writeRevision` transport CAS and Database Rules are independent of the operational binding revision and remain valid.

Required invariants:

- stale external writes remain blocked;
- no automatic rebase on realtime subscription or reconnect;
- rebase is allowed only after explicit `Перечитать Team`;
- the individual match identity must remain the same;
- the captured `ttScore` match state and match ID must still match the binding;
- a second external change after rebase must be rejected again;
- the pending result must remain durable until publication succeeds;
- the new administrative order must determine the next `current` match.

## Plan

1. Split binding comparison into identity comparison and identity+revision comparison.
2. Add a contract operation that can rebase a binding to a newer assignment only when identity is unchanged.
3. Expose that operation through the Team adapter.
4. Make explicit `Перечитать Team` opt in to pending rebase.
5. Persist the rebased pending binding before retrying publication.
6. Keep automatic realtime/reconnect reads non-rebasing.
7. Add domain, static, and browser regressions for the owner-reported scenario.

## Development

### `team-integration-contract.mjs`

Added:

- `assignmentMatchesBindingIdentity(assignment, binding)` — compares current assignment identity without revision;
- `rebaseBinding(assignment, binding, state)` — returns a new binding with the latest revision only when the current individual match identity is unchanged and the captured `ttScore` state still matches.

`assignmentMatchesBinding()` remains strict and now composes identity comparison with exact revision equality.

### `ttscore-team-adapter.mjs`

Added `rebaseTeamBinding(...)` as the adapter boundary for the contract operation.

### `ttScore_0.4.0.html`

Added `rebasePendingTeamRelease(assignment)`.

`reloadTeamContext()` now accepts `allowPendingRebase`, default `false`.

Only the `Перечитать Team` button calls:

`reloadTeamContext({ allowPendingRebase: true })`

Automatic reconnect continues to call `reloadTeamContext()` without rebase permission.

Before retrying, the rebased binding is persisted both as the session binding and inside `pendingRelease`. Failure to persist aborts the retry.

## Review

Runtime diff RC8 → RC9 is limited to:

- `ttScore_0.4.0.html`
- `team/assets/0.9.0/team-integration-contract.mjs`
- `team/assets/0.9.0/ttscore-team-adapter.mjs`

Unchanged byte-for-byte from RC8:

- `firebase-database-rules.json`
- `team/assets/0.9.0/firebase-source.mjs`
- scoring/Undo core functions inherited from accepted `ttScore 0.3.5` baseline.

The rebase does not bypass CAS. If Team changes again after the refreshed revision is captured, the strict binding check rejects publication again.

## Verification

Final automated evidence:

- Team Node tests: **215/215 PASS**.
- `ttScore` Node tests: **11/11 PASS**.
- Normal Team browser E2E: **19/19 PASS**.
- Autonomous `ttScore` smoke: **6/6 PASS**.
- Team editor realtime regression: **PASS**.
- External revision-guard regression: **PASS**.
- Same-client write serialization regression: **PASS**.
- New pending-rebase browser scenario: **10/10 PASS**.

The targeted browser scenario proves:

1. external planned-order change causes the first final write to fail closed;
2. pending result remains stored with the stale revision;
3. explicit `Перечитать Team` rebases `R1 → R2`;
4. the retry uses `R2`;
5. the result is published exactly once;
6. the administratively reordered next match becomes `current`;
7. no page errors occur.

## Refinement

Review identified one persistence edge case: retry must not proceed if the rebased pending binding cannot be saved to localStorage. RC9 therefore aborts the retry on persistence failure instead of using an in-memory-only rebase.

A second domain regression verifies that a further Team change after rebase is again rejected until another explicit refresh.

## Decision

**STABILIZE**

RC9 is ready for owner production acceptance. Product versions remain `ttScore 0.4.0` and `ttscore_team 0.9.0`; RC9 is a release-candidate package, not a new accepted baseline.
